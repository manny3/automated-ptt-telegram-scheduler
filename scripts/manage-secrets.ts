#!/usr/bin/env tsx

/**
 * Secret Manager 管理工具
 * 
 * 此工具提供命令列介面來管理 Secret Manager 中的密鑰，包括：
 * - 列出所有密鑰
 * - 建立新密鑰
 * - 更新密鑰值
 * - 刪除密鑰
 * - 驗證密鑰存取
 */

import { Command } from 'commander'
import { 
  getSecret, 
  getTelegramBotToken, 
  validateSecretAccess,
  getSecretMetadata,
  listSecrets,
  SecretManagerError
} from '../src/lib/secret-manager'

const program = new Command()

// 顏色定義
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// 工具函數
function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

function printSuccess(message: string): void {
  console.log(colorize('✅ ' + message, 'green'))
}

function printError(message: string): void {
  console.error(colorize('❌ ' + message, 'red'))
}

function printWarning(message: string): void {
  console.log(colorize('⚠️  ' + message, 'yellow'))
}

function printInfo(message: string): void {
  console.log(colorize('ℹ️  ' + message, 'blue'))
}

// 命令：列出所有密鑰
program
  .command('list')
  .description('列出專案中的所有密鑰')
  .action(async () => {
    try {
      printInfo('正在列出所有密鑰...')
      
      const secrets = await listSecrets()
      
      if (secrets.length === 0) {
        printWarning('沒有找到任何密鑰')
        return
      }
      
      console.log('\n' + colorize('找到的密鑰:', 'bright'))
      console.log('─'.repeat(50))
      
      for (const secretName of secrets) {
        try {
          const metadata = await getSecretMetadata(secretName)
          const isAccessible = await validateSecretAccess(secretName)
          
          console.log(`${colorize(secretName, 'cyan')}`)
          console.log(`  建立時間: ${metadata.createTime || '未知'}`)
          console.log(`  存取狀態: ${isAccessible ? colorize('可存取', 'green') : colorize('無法存取', 'red')}`)
          
          if (metadata.labels && Object.keys(metadata.labels).length > 0) {
            console.log(`  標籤: ${JSON.stringify(metadata.labels)}`)
          }
          
          console.log()
        } catch (error) {
          console.log(`${colorize(secretName, 'cyan')} - ${colorize('無法取得詳細資訊', 'yellow')}`)
        }
      }
      
      printSuccess(`總共找到 ${secrets.length} 個密鑰`)
      
    } catch (error) {
      printError(`列出密鑰失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：取得密鑰值
program
  .command('get <secretName>')
  .description('取得指定密鑰的值')
  .option('--show-value', '顯示完整密鑰值（預設只顯示前幾個字符）')
  .action(async (secretName: string, options) => {
    try {
      printInfo(`正在取得密鑰: ${secretName}`)
      
      const secretValue = await getSecret(secretName)
      
      if (options.showValue) {
        console.log('\n' + colorize('密鑰值:', 'bright'))
        console.log(secretValue)
      } else {
        const preview = secretValue.length > 10 
          ? secretValue.substring(0, 10) + '...' 
          : secretValue
        console.log('\n' + colorize('密鑰預覽:', 'bright'))
        console.log(preview)
        console.log(colorize(`(總長度: ${secretValue.length} 字符)`, 'yellow'))
        console.log(colorize('使用 --show-value 顯示完整值', 'blue'))
      }
      
      printSuccess('密鑰取得成功')
      
    } catch (error) {
      if (error instanceof SecretManagerError) {
        printError(`取得密鑰失敗: ${error.message}`)
      } else {
        printError(`取得密鑰失敗: ${error instanceof Error ? error.message : String(error)}`)
      }
      process.exit(1)
    }
  })

// 命令：驗證密鑰存取
program
  .command('validate <secretName>')
  .description('驗證是否可以存取指定密鑰')
  .action(async (secretName: string) => {
    try {
      printInfo(`正在驗證密鑰存取: ${secretName}`)
      
      const isAccessible = await validateSecretAccess(secretName)
      
      if (isAccessible) {
        printSuccess('密鑰可以正常存取')
        
        // 取得額外資訊
        try {
          const metadata = await getSecretMetadata(secretName)
          console.log('\n' + colorize('密鑰資訊:', 'bright'))
          console.log(`名稱: ${metadata.name}`)
          console.log(`建立時間: ${metadata.createTime || '未知'}`)
          
          if (metadata.labels && Object.keys(metadata.labels).length > 0) {
            console.log(`標籤: ${JSON.stringify(metadata.labels, null, 2)}`)
          }
        } catch (metadataError) {
          printWarning('無法取得密鑰中繼資料')
        }
      } else {
        printError('無法存取密鑰')
        console.log('\n可能的原因:')
        console.log('- 密鑰不存在')
        console.log('- 沒有存取權限')
        console.log('- 服務帳戶設定錯誤')
        process.exit(1)
      }
      
    } catch (error) {
      printError(`驗證失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：測試 Telegram Bot Token
program
  .command('test-telegram')
  .description('測試 Telegram Bot Token 的取得和格式驗證')
  .action(async () => {
    try {
      printInfo('正在測試 Telegram Bot Token...')
      
      const secretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || 'telegram-bot-token'
      printInfo(`使用密鑰名稱: ${secretName}`)
      
      // 驗證存取
      const isAccessible = await validateSecretAccess(secretName)
      if (!isAccessible) {
        printError('無法存取 Telegram Bot Token 密鑰')
        process.exit(1)
      }
      
      // 取得 Token
      const token = await getTelegramBotToken()
      
      // 驗證格式
      const tokenRegex = /^(\d+):([A-Za-z0-9_-]+)$/
      const match = token.match(tokenRegex)
      
      if (match) {
        const [, botId, tokenPart] = match
        printSuccess('Telegram Bot Token 格式正確')
        console.log('\n' + colorize('Token 資訊:', 'bright'))
        console.log(`Bot ID: ${botId}`)
        console.log(`Token 部分長度: ${tokenPart.length} 字符`)
        console.log(`完整 Token 長度: ${token.length} 字符`)
      } else {
        printError('Telegram Bot Token 格式無效')
        process.exit(1)
      }
      
      printSuccess('Telegram Bot Token 測試完成')
      
    } catch (error) {
      if (error instanceof SecretManagerError) {
        printError(`測試失敗: ${error.message}`)
      } else {
        printError(`測試失敗: ${error instanceof Error ? error.message : String(error)}`)
      }
      process.exit(1)
    }
  })

// 命令：檢查環境設定
program
  .command('check-env')
  .description('檢查 Secret Manager 相關的環境變數設定')
  .action(() => {
    console.log(colorize('環境變數檢查:', 'bright'))
    console.log('─'.repeat(50))
    
    const envVars = [
      'GOOGLE_CLOUD_PROJECT',
      'TELEGRAM_BOT_TOKEN_SECRET_NAME',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ]
    
    let allSet = true
    
    for (const envVar of envVars) {
      const value = process.env[envVar]
      if (value) {
        console.log(`${colorize('✅', 'green')} ${envVar}: ${value}`)
      } else {
        console.log(`${colorize('❌', 'red')} ${envVar}: ${colorize('未設定', 'yellow')}`)
        if (envVar !== 'GOOGLE_APPLICATION_CREDENTIALS') {
          allSet = false
        }
      }
    }
    
    console.log()
    
    if (allSet) {
      printSuccess('所有必要的環境變數都已設定')
    } else {
      printWarning('某些環境變數未設定')
      console.log('\n建議設定:')
      console.log('export GOOGLE_CLOUD_PROJECT=your-project-id')
      console.log('export TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token')
    }
    
    // 檢查 gcloud 設定
    console.log('\n' + colorize('gcloud 設定檢查:', 'bright'))
    console.log('─'.repeat(50))
    
    try {
      const { execSync } = require('child_process')
      
      const project = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim()
      const account = execSync('gcloud config get-value account', { encoding: 'utf8' }).trim()
      
      console.log(`${colorize('✅', 'green')} 目前專案: ${project}`)
      console.log(`${colorize('✅', 'green')} 目前帳戶: ${account}`)
      
    } catch (error) {
      printWarning('無法取得 gcloud 設定資訊')
    }
  })

// 命令：產生設定範例
program
  .command('generate-config')
  .description('產生 Secret Manager 設定範例')
  .action(() => {
    console.log(colorize('Secret Manager 設定範例:', 'bright'))
    console.log('─'.repeat(50))
    
    console.log('\n' + colorize('1. 環境變數設定 (.env):', 'cyan'))
    console.log('GOOGLE_CLOUD_PROJECT=your-project-id')
    console.log('TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token')
    
    console.log('\n' + colorize('2. TypeScript 使用範例:', 'cyan'))
    console.log(`
import { getTelegramBotToken, validateSecretAccess } from './lib/secret-manager'

async function example() {
  try {
    // 驗證存取
    const isAccessible = await validateSecretAccess('telegram-bot-token')
    if (!isAccessible) {
      throw new Error('無法存取 Telegram Bot Token')
    }
    
    // 取得 Token
    const token = await getTelegramBotToken()
    console.log('Token 取得成功')
    
    // 使用 Token...
  } catch (error) {
    console.error('錯誤:', error.message)
  }
}`)
    
    console.log('\n' + colorize('3. Cloud Function 環境變數:', 'cyan'))
    console.log('gcloud functions deploy my-function \\')
    console.log('  --set-env-vars GOOGLE_CLOUD_PROJECT=your-project-id,TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token')
    
    console.log('\n' + colorize('4. Cloud Run 環境變數:', 'cyan'))
    console.log('gcloud run deploy my-service \\')
    console.log('  --set-env-vars GOOGLE_CLOUD_PROJECT=your-project-id,TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token')
  })

// 設定程式資訊
program
  .name('manage-secrets')
  .description('Secret Manager 管理工具')
  .version('1.0.0')

// 解析命令列參數
program.parse()

// 如果沒有提供命令，顯示說明
if (!process.argv.slice(2).length) {
  program.outputHelp()
}