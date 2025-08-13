/**
 * 健康檢查 API 端點
 * 用於 Docker 健康檢查和負載平衡器探測
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, withMonitoring } from '@/lib/api-error-handler'
import { healthChecker, metricsCollector, alertManager } from '@/lib/monitoring'
import { dbHealthChecker } from '@/lib/database-error-handler'
import { validateSecretAccess } from '@/lib/secret-manager'
import { errorRecoveryManager } from '@/lib/error-recovery'
import { withComprehensiveErrorHandling } from '@/middleware/error-handling'

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
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage
    activeHandles: number
    activeRequests: number
  }
  checks?: Record<string, { healthy: boolean; lastCheck: Date; error?: string }>
}

async function healthHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const detailed = req.query.detailed === 'true'
  const includeMetrics = req.query.metrics === 'true'
  
  const healthData: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }

  // 設定快取標頭
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  if (detailed) {
    // 檢查服務連接狀態
    healthData.services = {
      database: 'unknown',
      secretManager: 'unknown'
    }

    // 檢查資料庫連接
    try {
      const dbHealthy = await dbHealthChecker.checkHealth()
      healthData.services.database = dbHealthy ? 'connected' : 'disconnected'
    } catch (error) {
      healthData.services.database = 'disconnected'
    }

    // 檢查 Secret Manager 存取
    try {
      const secretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || 'telegram-bot-token'
      const secretAccessible = await validateSecretAccess(secretName)
      healthData.services.secretManager = secretAccessible ? 'accessible' : 'inaccessible'
    } catch (error) {
      healthData.services.secretManager = 'inaccessible'
    }

    // 執行所有健康檢查
    const healthSummary = healthChecker.getHealthSummary()
    healthData.checks = healthSummary.checks
    
    // 如果任何服務不健康，設定整體狀態為不健康
    if (healthData.services.database === 'disconnected' || 
        healthData.services.secretManager === 'inaccessible' ||
        !healthSummary.overall) {
      healthData.status = 'unhealthy'
    }
  }

  if (includeMetrics) {
    // 包含系統指標
    healthData.metrics = {
      memoryUsage: process.memoryUsage(),
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
    }
  }

  // 記錄健康檢查指標
  metricsCollector.increment('health_check_requests', 1, {
    detailed: detailed.toString(),
    status: healthData.status,
  })

  const statusCode = healthData.status === 'healthy' ? 200 : 503
  ;(res as any).success(healthData, `Service is ${healthData.status}`)
}

export default withMonitoring()(
  withMethodValidation(['GET'])(
    withErrorHandler(healthHandler)
  )
)