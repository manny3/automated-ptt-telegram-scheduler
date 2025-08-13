#!/usr/bin/env tsx

/**
 * Cloud Scheduler 管理工具
 * 
 * 此工具提供命令列介面來管理 Cloud Scheduler 工作，包括：
 * - 列出所有排程工作
 * - 建立新的排程工作
 * - 更新現有工作
 * - 暫停/恢復工作
 * - 手動觸發工作
 * - 查看執行歷史
 */

import { Command } from 'commander'
import { execSync } from 'child_process'

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

// 執行 gcloud 命令的工具函數
function executeGcloudCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch (error: any) {
    throw new Error(`gcloud 命令執行失敗: ${error.message}`)
  }
}

// 取得專案和地區設定
function getProjectConfig(): { projectId: string; region: string } {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 
    executeGcloudCommand('gcloud config get-value project')
  
  const region = process.env.REGION || 'us-central1'
  
  if (!projectId) {
    throw new Error('無法取得專案 ID，請設定 GOOGLE_CLOUD_PROJECT 環境變數或執行 gcloud config set project')
  }
  
  return { projectId, region }
}

// 命令：列出所有 Scheduler 工作
program
  .command('list')
  .description('列出所有 Cloud Scheduler 工作')
  .option('--region <region>', '指定地區', 'us-central1')
  .action(async (options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      printInfo(`列出專案 ${projectId} 在 ${region} 地區的所有 Scheduler 工作...`)
      
      const command = `gcloud scheduler jobs list --location=${region} --project=${projectId} --format="table(name.basename():label=NAME,schedule:label=SCHEDULE,timeZone:label=TIMEZONE,state:label=STATE,httpTarget.uri.basename():label=TARGET)"`
      
      const result = executeGcloudCommand(command)
      
      if (result.includes('Listed 0 items')) {
        printWarning('沒有找到任何 Scheduler 工作')
      } else {
        console.log('\n' + result)
        printSuccess('工作列表顯示完成')
      }
      
    } catch (error) {
      printError(`列出工作失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：顯示工作詳細資訊
program
  .command('describe <jobName>')
  .description('顯示指定工作的詳細資訊')
  .option('--region <region>', '指定地區', 'us-central1')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      printInfo(`取得工作 ${jobName} 的詳細資訊...`)
      
      const command = `gcloud scheduler jobs describe ${jobName} --location=${region} --project=${projectId}`
      const result = executeGcloudCommand(command)
      
      console.log('\n' + colorize('工作詳細資訊:', 'bright'))
      console.log('─'.repeat(50))
      console.log(result)
      
      printSuccess('詳細資訊顯示完成')
      
    } catch (error) {
      printError(`取得工作資訊失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：手動觸發工作
program
  .command('run <jobName>')
  .description('手動觸發指定的 Scheduler 工作')
  .option('--region <region>', '指定地區', 'us-central1')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      printInfo(`手動觸發工作: ${jobName}`)
      
      const command = `gcloud scheduler jobs run ${jobName} --location=${region} --project=${projectId}`
      executeGcloudCommand(command)
      
      printSuccess('工作觸發成功')
      printInfo('請稍後檢查目標服務的日誌以確認執行結果')
      
    } catch (error) {
      printError(`觸發工作失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：暫停工作
program
  .command('pause <jobName>')
  .description('暫停指定的 Scheduler 工作')
  .option('--region <region>', '指定地區', 'us-central1')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      printInfo(`暫停工作: ${jobName}`)
      
      const command = `gcloud scheduler jobs pause ${jobName} --location=${region} --project=${projectId}`
      executeGcloudCommand(command)
      
      printSuccess('工作已暫停')
      
    } catch (error) {
      printError(`暫停工作失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：恢復工作
program
  .command('resume <jobName>')
  .description('恢復指定的 Scheduler 工作')
  .option('--region <region>', '指定地區', 'us-central1')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      printInfo(`恢復工作: ${jobName}`)
      
      const command = `gcloud scheduler jobs resume ${jobName} --location=${region} --project=${projectId}`
      executeGcloudCommand(command)
      
      printSuccess('工作已恢復')
      
    } catch (error) {
      printError(`恢復工作失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：刪除工作
program
  .command('delete <jobName>')
  .description('刪除指定的 Scheduler 工作')
  .option('--region <region>', '指定地區', 'us-central1')
  .option('--force', '強制刪除，不詢問確認')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      if (!options.force) {
        // 在實際環境中，這裡應該使用適當的提示庫
        printWarning(`即將刪除工作: ${jobName}`)
        printWarning('此操作無法復原！')
        console.log('如要繼續，請使用 --force 選項')
        return
      }
      
      printInfo(`刪除工作: ${jobName}`)
      
      const command = `gcloud scheduler jobs delete ${jobName} --location=${region} --project=${projectId} --quiet`
      executeGcloudCommand(command)
      
      printSuccess('工作已刪除')
      
    } catch (error) {
      printError(`刪除工作失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：更新工作排程
program
  .command('update-schedule <jobName> <schedule>')
  .description('更新指定工作的排程')
  .option('--region <region>', '指定地區', 'us-central1')
  .option('--timezone <timezone>', '時區', 'Asia/Taipei')
  .action(async (jobName: string, schedule: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      const timezone = options.timezone
      
      printInfo(`更新工作 ${jobName} 的排程為: ${schedule}`)
      
      const command = `gcloud scheduler jobs update http ${jobName} --location=${region} --project=${projectId} --schedule='${schedule}' --time-zone='${timezone}'`
      executeGcloudCommand(command)
      
      printSuccess('排程已更新')
      printInfo(`新排程: ${schedule}`)
      printInfo(`時區: ${timezone}`)
      
    } catch (error) {
      printError(`更新排程失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：查看工作日誌
program
  .command('logs <jobName>')
  .description('查看 Scheduler 工作的執行日誌')
  .option('--region <region>', '指定地區', 'us-central1')
  .option('--limit <limit>', '日誌條數限制', '50')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      const limit = options.limit
      
      printInfo(`查看工作 ${jobName} 的執行日誌...`)
      
      // Cloud Scheduler 的日誌查詢
      const logFilter = `resource.type="cloud_scheduler_job" AND resource.labels.job_id="${jobName}" AND resource.labels.location="${region}"`
      const command = `gcloud logging read '${logFilter}' --project=${projectId} --limit=${limit} --format="table(timestamp,severity,jsonPayload.message)" --sort-by="~timestamp"`
      
      try {
        const result = executeGcloudCommand(command)
        
        if (result.trim() === '') {
          printWarning('沒有找到相關日誌')
          printInfo('可能的原因:')
          console.log('- 工作尚未執行過')
          console.log('- 日誌尚未產生')
          console.log('- 工作名稱或地區不正確')
        } else {
          console.log('\n' + colorize('執行日誌:', 'bright'))
          console.log('─'.repeat(50))
          console.log(result)
        }
      } catch (logError) {
        printWarning('無法取得 Scheduler 日誌，嘗試查看目標 Function 日誌...')
        
        // 嘗試查看 Cloud Function 日誌
        const functionName = 'ptt-scraper' // 預設函數名稱
        const functionLogCommand = `gcloud functions logs read ${functionName} --region=${region} --project=${projectId} --limit=${limit} --format="table(timestamp,severity,textPayload)"`
        
        try {
          const functionResult = executeGcloudCommand(functionLogCommand)
          console.log('\n' + colorize('Cloud Function 日誌:', 'bright'))
          console.log('─'.repeat(50))
          console.log(functionResult)
        } catch (functionLogError) {
          printError('無法取得任何相關日誌')
        }
      }
      
    } catch (error) {
      printError(`查看日誌失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：監控工作狀態
program
  .command('monitor <jobName>')
  .description('監控指定工作的狀態和最近執行情況')
  .option('--region <region>', '指定地區', 'us-central1')
  .option('--watch', '持續監控（每 30 秒更新一次）')
  .action(async (jobName: string, options) => {
    try {
      const { projectId } = getProjectConfig()
      const region = options.region
      
      const showStatus = () => {
        try {
          console.clear()
          console.log(colorize(`=== ${jobName} 工作監控 ===`, 'bright'))
          console.log(`時間: ${new Date().toLocaleString('zh-TW')}`)
          console.log()
          
          // 顯示工作基本資訊
          const describeCommand = `gcloud scheduler jobs describe ${jobName} --location=${region} --project=${projectId} --format="table(name.basename():label=NAME,schedule:label=SCHEDULE,state:label=STATE,lastAttemptTime:label=LAST_ATTEMPT)"`
          const describeResult = executeGcloudCommand(describeCommand)
          
          console.log(colorize('工作狀態:', 'cyan'))
          console.log(describeResult)
          console.log()
          
          // 顯示最近的執行結果
          const statusCommand = `gcloud scheduler jobs describe ${jobName} --location=${region} --project=${projectId} --format="value(status.code,status.message,lastAttemptTime)"`
          const statusResult = executeGcloudCommand(statusCommand)
          
          if (statusResult) {
            const [code, message, lastAttempt] = statusResult.split('\t')
            console.log(colorize('最近執行:', 'cyan'))
            console.log(`狀態碼: ${code || '未知'}`)
            console.log(`訊息: ${message || '無'}`)
            console.log(`時間: ${lastAttempt || '從未執行'}`)
          }
          
          if (options.watch) {
            console.log()
            console.log(colorize('按 Ctrl+C 停止監控', 'yellow'))
          }
          
        } catch (error) {
          printError(`監控更新失敗: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      
      showStatus()
      
      if (options.watch) {
        const interval = setInterval(showStatus, 30000) // 每 30 秒更新
        
        // 處理 Ctrl+C
        process.on('SIGINT', () => {
          clearInterval(interval)
          console.log('\n監控已停止')
          process.exit(0)
        })
      }
      
    } catch (error) {
      printError(`監控失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：檢查環境設定
program
  .command('check-env')
  .description('檢查 Cloud Scheduler 相關的環境設定')
  .action(async () => {
    try {
      console.log(colorize('Cloud Scheduler 環境檢查:', 'bright'))
      console.log('─'.repeat(50))
      
      // 檢查 gcloud 設定
      try {
        const project = executeGcloudCommand('gcloud config get-value project')
        const account = executeGcloudCommand('gcloud config get-value account')
        
        console.log(`${colorize('✅', 'green')} gcloud 專案: ${project}`)
        console.log(`${colorize('✅', 'green')} gcloud 帳戶: ${account}`)
      } catch (error) {
        console.log(`${colorize('❌', 'red')} gcloud 設定錯誤: ${error}`)
      }
      
      // 檢查環境變數
      const envVars = [
        'GOOGLE_CLOUD_PROJECT',
        'REGION'
      ]
      
      console.log('\n環境變數:')
      for (const envVar of envVars) {
        const value = process.env[envVar]
        if (value) {
          console.log(`${colorize('✅', 'green')} ${envVar}: ${value}`)
        } else {
          console.log(`${colorize('⚠️', 'yellow')} ${envVar}: 未設定（將使用預設值）`)
        }
      }
      
      // 檢查必要的 API
      console.log('\n檢查 API 啟用狀態:')
      const apis = [
        'cloudscheduler.googleapis.com',
        'cloudfunctions.googleapis.com',
        'appengine.googleapis.com'
      ]
      
      const { projectId } = getProjectConfig()
      
      for (const api of apis) {
        try {
          const result = executeGcloudCommand(`gcloud services list --enabled --filter="name:${api}" --format="value(name)" --project=${projectId}`)
          if (result.includes(api)) {
            console.log(`${colorize('✅', 'green')} ${api}: 已啟用`)
          } else {
            console.log(`${colorize('❌', 'red')} ${api}: 未啟用`)
          }
        } catch (error) {
          console.log(`${colorize('❌', 'red')} ${api}: 檢查失敗`)
        }
      }
      
      // 檢查 App Engine 應用程式
      console.log('\nApp Engine 應用程式:')
      try {
        executeGcloudCommand(`gcloud app describe --project=${projectId}`)
        console.log(`${colorize('✅', 'green')} App Engine 應用程式已建立`)
      } catch (error) {
        console.log(`${colorize('❌', 'red')} App Engine 應用程式不存在（Cloud Scheduler 需要）`)
      }
      
    } catch (error) {
      printError(`環境檢查失敗: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  })

// 命令：產生設定範例
program
  .command('generate-examples')
  .description('產生 Cloud Scheduler 設定和使用範例')
  .action(() => {
    console.log(colorize('Cloud Scheduler 設定範例:', 'bright'))
    console.log('─'.repeat(50))
    
    console.log('\n' + colorize('1. 建立基本 HTTP 工作:', 'cyan'))
    console.log(`gcloud scheduler jobs create http my-job \\
  --location=us-central1 \\
  --schedule="*/15 * * * *" \\
  --time-zone="Asia/Taipei" \\
  --uri="https://us-central1-project.cloudfunctions.net/my-function" \\
  --http-method=POST \\
  --headers="Content-Type=application/json" \\
  --message-body='{}'`)
    
    console.log('\n' + colorize('2. 常用排程格式:', 'cyan'))
    console.log('每 15 分鐘: "*/15 * * * *"')
    console.log('每小時: "0 * * * *"')
    console.log('每天上午 9 點: "0 9 * * *"')
    console.log('工作日上午 9 點: "0 9 * * 1-5"')
    console.log('每週一上午 9 點: "0 9 * * 1"')
    console.log('每月 1 日上午 9 點: "0 9 1 * *"')
    
    console.log('\n' + colorize('3. 管理命令範例:', 'cyan'))
    console.log('列出所有工作: npx tsx scripts/manage-scheduler.ts list')
    console.log('手動觸發: npx tsx scripts/manage-scheduler.ts run my-job')
    console.log('暫停工作: npx tsx scripts/manage-scheduler.ts pause my-job')
    console.log('恢復工作: npx tsx scripts/manage-scheduler.ts resume my-job')
    console.log('更新排程: npx tsx scripts/manage-scheduler.ts update-schedule my-job "0 */2 * * *"')
    console.log('查看日誌: npx tsx scripts/manage-scheduler.ts logs my-job')
    console.log('監控狀態: npx tsx scripts/manage-scheduler.ts monitor my-job --watch')
    
    console.log('\n' + colorize('4. 環境變數設定:', 'cyan'))
    console.log('export GOOGLE_CLOUD_PROJECT=your-project-id')
    console.log('export REGION=us-central1')
    
    console.log('\n' + colorize('5. IAM 權限設定:', 'cyan'))
    console.log(`# 為 Cloud Scheduler 設定 Cloud Functions 調用權限
gcloud functions add-iam-policy-binding FUNCTION_NAME \\
  --region=REGION \\
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \\
  --role="roles/cloudfunctions.invoker"`)
  })

// 設定程式資訊
program
  .name('manage-scheduler')
  .description('Cloud Scheduler 管理工具')
  .version('1.0.0')

// 解析命令列參數
program.parse()

// 如果沒有提供命令，顯示說明
if (!process.argv.slice(2).length) {
  program.outputHelp()
}