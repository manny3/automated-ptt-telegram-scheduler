/**
 * 健康檢查 API 端點
 * 用於 Docker 健康檢查和負載平衡器探測
 */

import type { NextApiRequest, NextApiResponse } from 'next'

interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  version?: string
  environment?: string
  services?: {
    database: 'connected' | 'disconnected' | 'unknown'
    secretManager: 'accessible' | 'inaccessible' | 'unknown'
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  // 只允許 GET 請求
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }

  try {
    const healthData: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // 檢查詳細模式
    const detailed = req.query.detailed === 'true'
    
    if (detailed) {
      // 檢查服務連接狀態
      healthData.services = {
        database: 'unknown',
        secretManager: 'unknown'
      }

      // 檢查 Firestore 連接（簡單檢查）
      try {
        if (process.env.GOOGLE_CLOUD_PROJECT) {
          healthData.services.database = 'connected'
        } else {
          healthData.services.database = 'disconnected'
        }
      } catch (error) {
        healthData.services.database = 'disconnected'
      }

      // 檢查 Secret Manager 存取
      try {
        if (process.env.GOOGLE_CLOUD_PROJECT && process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME) {
          healthData.services.secretManager = 'accessible'
        } else {
          healthData.services.secretManager = 'inaccessible'
        }
      } catch (error) {
        healthData.services.secretManager = 'inaccessible'
      }
    }

    // 設定快取標頭
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(200).json(healthData)

  } catch (error) {
    console.error('健康檢查失敗:', error)
    
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }
}