/**
 * Secret Manager 驗證 API 路由
 * 
 * 此 API 端點用於驗證 Secret Manager 中的密鑰是否可以正常存取
 * 主要用於前端檢查 Telegram Bot Token 設定狀態
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  validateSecretAccess, 
  getTelegramBotToken, 
  getSecretMetadata,
  SecretManagerError 
} from '@/lib/secret-manager'

interface ValidationResponse {
  success: boolean
  accessible: boolean
  secretName?: string
  metadata?: {
    name: string
    createTime?: string
    labels?: { [key: string]: string }
  }
  tokenValid?: boolean
  error?: string
  message?: string
}

/**
 * 驗證密鑰存取的 API 處理器
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidationResponse>
) {
  // 只允許 GET 請求
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      accessible: false,
      error: 'Method not allowed',
      message: '只允許 GET 請求'
    })
  }

  try {
    const secretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || 'telegram-bot-token'
    
    console.log(`正在驗證密鑰存取: ${secretName}`)
    
    // 驗證密鑰是否可存取
    const isAccessible = await validateSecretAccess(secretName)
    
    if (!isAccessible) {
      return res.status(200).json({
        success: true,
        accessible: false,
        secretName,
        message: '密鑰無法存取，請檢查權限設定'
      })
    }
    
    // 取得密鑰中繼資料
    let metadata
    try {
      metadata = await getSecretMetadata(secretName)
    } catch (metadataError) {
      console.warn('無法取得密鑰中繼資料:', metadataError)
    }
    
    // 驗證 Telegram Bot Token 格式
    let tokenValid = false
    try {
      const token = await getTelegramBotToken()
      tokenValid = true
      console.log('Telegram Bot Token 格式驗證成功')
    } catch (tokenError) {
      console.error('Telegram Bot Token 驗證失敗:', tokenError)
      
      if (tokenError instanceof SecretManagerError) {
        return res.status(200).json({
          success: true,
          accessible: true,
          secretName,
          metadata,
          tokenValid: false,
          error: tokenError.message,
          message: '密鑰可存取但 Token 格式無效'
        })
      }
    }
    
    // 成功回應
    return res.status(200).json({
      success: true,
      accessible: true,
      secretName,
      metadata,
      tokenValid,
      message: tokenValid 
        ? 'Telegram Bot Token 設定正確且可正常存取'
        : '密鑰可存取但 Token 驗證失敗'
    })
    
  } catch (error) {
    console.error('Secret Manager 驗證錯誤:', error)
    
    if (error instanceof SecretManagerError) {
      return res.status(500).json({
        success: false,
        accessible: false,
        error: error.message,
        message: 'Secret Manager 操作失敗'
      })
    }
    
    return res.status(500).json({
      success: false,
      accessible: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      message: '伺服器內部錯誤'
    })
  }
}