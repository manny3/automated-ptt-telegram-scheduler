import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

// 重試配置
const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1 秒
const MAX_DELAY = 10000 // 10 秒

// 測試配置（可以被覆蓋用於測試）
export const TEST_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 10, // 測試時使用更短的延遲
  MAX_DELAY: 100,
}

/**
 * Secret Manager 錯誤類別
 */
export class SecretManagerError extends Error {
  constructor(
    message: string, 
    public statusCode?: number, 
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'SecretManagerError'
  }
}

/**
 * 睡眠工具函數
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 計算指數退避延遲時間（加入隨機抖動）
 */
const calculateDelay = (attempt: number, isTest: boolean = false): number => {
  const baseDelay = isTest ? TEST_CONFIG.BASE_DELAY : BASE_DELAY
  const maxDelay = isTest ? TEST_CONFIG.MAX_DELAY : MAX_DELAY
  
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // 加入抖動（±25% 的延遲）
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(delay + jitter, 0)
}

let secretManagerClient: SecretManagerServiceClient | null = null

/**
 * 取得 Secret Manager 客戶端實例（單例模式）
 */
export function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient({
      // 設定客戶端選項
      fallback: true, // 使用 REST fallback 如果 gRPC 不可用
    })
  }
  return secretManagerClient
}

/**
 * 重設 Secret Manager 客戶端（主要用於測試）
 */
export function resetSecretManagerClient(): void {
  secretManagerClient = null
}

/**
 * 從 Secret Manager 取得密鑰（包含重試邏輯）
 * @param secretName 密鑰名稱
 * @param retries 重試次數
 * @param isTest 是否為測試模式
 * @returns 密鑰值
 */
export async function getSecret(
  secretName: string, 
  retries: number = MAX_RETRIES,
  isTest: boolean = false
): Promise<string> {
  if (!secretName || secretName.trim() === '') {
    throw new SecretManagerError('密鑰名稱不能為空', undefined, false)
  }

  let lastError: Error

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = getSecretManagerClient()
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      
      if (!projectId) {
        throw new SecretManagerError(
          'GOOGLE_CLOUD_PROJECT 環境變數未設定', 
          undefined, 
          false
        )
      }

      const name = `projects/${projectId}/secrets/${secretName}/versions/latest`
      console.log(`正在取得密鑰: ${secretName} (嘗試 ${attempt + 1}/${retries + 1})`)
      
      const [version] = await client.accessSecretVersion({ name })
      
      const payload = version.payload?.data?.toString()
      if (!payload) {
        throw new SecretManagerError(
          `密鑰 ${secretName} 為空或不存在`, 
          404, 
          false
        )
      }
      
      console.log(`成功取得密鑰: ${secretName}`)
      return payload
      
    } catch (error: any) {
      lastError = error
      
      // 處理不同類型的錯誤
      if (error.code === 5) { // NOT_FOUND
        throw new SecretManagerError(
          `密鑰 ${secretName} 不存在`,
          404,
          false
        )
      }
      
      if (error.code === 7) { // PERMISSION_DENIED
        throw new SecretManagerError(
          `沒有權限存取密鑰 ${secretName}`,
          403,
          false
        )
      }
      
      if (error instanceof SecretManagerError && !error.retryable) {
        throw error
      }

      // 如果這是最後一次嘗試，拋出錯誤
      if (attempt === retries) {
        break
      }

      // 計算延遲並等待重試
      const delay = calculateDelay(attempt, isTest)
      console.log(`Secret Manager 請求失敗 (嘗試 ${attempt + 1}/${retries + 1})，${delay}ms 後重試...`)
      await sleep(delay)
    }
  }

  throw new SecretManagerError(
    `取得密鑰 ${secretName} 失敗，經過 ${retries + 1} 次嘗試：${lastError.message}`,
    lastError.code
  )
}

/**
 * 取得 Telegram Bot Token
 * @param isTest 是否為測試模式
 * @returns Telegram Bot Token
 */
export async function getTelegramBotToken(isTest: boolean = false): Promise<string> {
  const secretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || 'telegram-bot-token'
  
  try {
    const token = await getSecret(secretName, MAX_RETRIES, isTest)
    
    // 驗證 Token 格式（Telegram Bot Token 格式：數字:字母數字）
    if (!token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      throw new SecretManagerError(
        `Telegram Bot Token 格式無效`,
        400,
        false
      )
    }
    
    return token
  } catch (error) {
    console.error('取得 Telegram Bot Token 失敗:', error)
    throw error
  }
}

/**
 * 驗證密鑰是否存在且可存取
 * @param secretName 密鑰名稱
 * @returns 是否可存取
 */
export async function validateSecretAccess(secretName: string): Promise<boolean> {
  try {
    await getSecret(secretName)
    return true
  } catch (error) {
    console.error(`密鑰 ${secretName} 存取驗證失敗:`, error)
    return false
  }
}

/**
 * 取得密鑰的中繼資料（不包含實際值）
 * @param secretName 密鑰名稱
 * @returns 密鑰中繼資料
 */
export async function getSecretMetadata(secretName: string): Promise<{
  name: string
  createTime?: string
  labels?: { [key: string]: string }
}> {
  try {
    const client = getSecretManagerClient()
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
    
    if (!projectId) {
      throw new SecretManagerError('GOOGLE_CLOUD_PROJECT 環境變數未設定', undefined, false)
    }

    const name = `projects/${projectId}/secrets/${secretName}`
    const [secret] = await client.getSecret({ name })
    
    return {
      name: secret.name || secretName,
      createTime: secret.createTime?.seconds?.toString(),
      labels: secret.labels || {}
    }
  } catch (error: any) {
    console.error(`取得密鑰中繼資料失敗 ${secretName}:`, error)
    throw new SecretManagerError(`無法取得密鑰中繼資料: ${error.message}`)
  }
}

/**
 * 列出專案中的所有密鑰（僅名稱）
 * @returns 密鑰名稱列表
 */
export async function listSecrets(): Promise<string[]> {
  try {
    const client = getSecretManagerClient()
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
    
    if (!projectId) {
      throw new SecretManagerError('GOOGLE_CLOUD_PROJECT 環境變數未設定', undefined, false)
    }

    const parent = `projects/${projectId}`
    const [secrets] = await client.listSecrets({ parent })
    
    return secrets.map(secret => {
      const nameParts = secret.name?.split('/') || []
      return nameParts[nameParts.length - 1] || ''
    }).filter(name => name !== '')
    
  } catch (error: any) {
    console.error('列出密鑰失敗:', error)
    throw new SecretManagerError(`無法列出密鑰: ${error.message}`)
  }
}