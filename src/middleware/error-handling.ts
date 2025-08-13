/**
 * 全域錯誤處理中介軟體
 * 
 * 提供統一的錯誤處理、日誌記錄和監控整合
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logger'
import { metricsCollector, alertManager, AlertLevel } from '@/lib/monitoring'
import { errorRecoveryManager } from '@/lib/error-recovery'

// 錯誤分類
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  INTERNAL = 'internal',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
}

// 錯誤嚴重程度
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// 錯誤上下文
export interface ErrorContext {
  requestId?: string
  userId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  timestamp?: string
  category?: ErrorCategory
  severity?: ErrorSeverity
  retryable?: boolean
  metadata?: Record<string, any>
}

// 錯誤分析器
export class ErrorAnalyzer {
  static analyzeError(error: any, context: ErrorContext = {}): {
    category: ErrorCategory
    severity: ErrorSeverity
    retryable: boolean
    statusCode: number
  } {
    // 根據錯誤類型和訊息分析錯誤
    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code || error.status || error.statusCode

    // 驗證錯誤
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') ||
        errorCode === 400) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        retryable: false,
        statusCode: 400,
      }
    }

    // 認證錯誤
    if (errorMessage.includes('unauthorized') ||
        errorMessage.includes('authentication') ||
        errorCode === 401) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        statusCode: 401,
      }
    }

    // 授權錯誤
    if (errorMessage.includes('forbidden') ||
        errorMessage.includes('permission') ||
        errorCode === 403) {
      return {
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        statusCode: 403,
      }
    }

    // 資源不存在
    if (errorMessage.includes('not found') ||
        errorCode === 404) {
      return {
        category: ErrorCategory.NOT_FOUND,
        severity: ErrorSeverity.LOW,
        retryable: false,
        statusCode: 404,
      }
    }

    // 速率限制
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorCode === 429) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        statusCode: 429,
      }
    }

    // 資料庫錯誤
    if (errorMessage.includes('database') ||
        errorMessage.includes('firestore') ||
        errorMessage.includes('connection') ||
        errorCode === 'UNAVAILABLE') {
      return {
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        statusCode: 503,
      }
    }

    // 網路錯誤
    if (errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('econnreset') ||
        errorCode === 'TIMEOUT') {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        statusCode: 503,
      }
    }

    // 外部服務錯誤
    if (errorMessage.includes('external') ||
        errorMessage.includes('api') ||
        (errorCode >= 500 && errorCode < 600)) {
      return {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        statusCode: 502,
      }
    }

    // 預設為內部錯誤
    return {
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.CRITICAL,
      retryable: false,
      statusCode: 500,
    }
  }

  static shouldTriggerAlert(
    category: ErrorCategory,
    severity: ErrorSeverity,
    errorCount: number = 1
  ): boolean {
    // 嚴重錯誤總是觸發警報
    if (severity === ErrorSeverity.CRITICAL) {
      return true
    }

    // 高嚴重程度錯誤在多次發生時觸發警報
    if (severity === ErrorSeverity.HIGH && errorCount >= 3) {
      return true
    }

    // 中等嚴重程度錯誤在大量發生時觸發警報
    if (severity === ErrorSeverity.MEDIUM && errorCount >= 10) {
      return true
    }

    // 特定類別的錯誤
    if (category === ErrorCategory.DATABASE && errorCount >= 5) {
      return true
    }

    return false
  }
}

// 錯誤處理中介軟體
export class ErrorHandlingMiddleware {
  private static errorCounts: Map<string, number> = new Map()
  private static lastCleanup: number = Date.now()
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 分鐘

  static async handleError(
    error: any,
    req: NextApiRequest,
    res: NextApiResponse,
    context: ErrorContext = {}
  ): Promise<void> {
    const startTime = Date.now()
    
    // 建立完整的錯誤上下文
    const fullContext: ErrorContext = {
      requestId: req.headers['x-request-id'] as string || 
                Math.random().toString(36).substring(7),
      endpoint: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'] as string,
      ip: req.headers['x-forwarded-for'] as string || 
          req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      ...context,
    }

    // 分析錯誤
    const analysis = ErrorAnalyzer.analyzeError(error, fullContext)
    fullContext.category = analysis.category
    fullContext.severity = analysis.severity
    fullContext.retryable = analysis.retryable

    // 記錄錯誤指標
    metricsCollector.increment('api_errors_total', 1, {
      endpoint: fullContext.endpoint || 'unknown',
      method: fullContext.method || 'unknown',
      category: analysis.category,
      severity: analysis.severity,
      statusCode: analysis.statusCode.toString(),
    })

    // 更新錯誤計數
    const errorKey = `${analysis.category}_${fullContext.endpoint}`
    const currentCount = this.errorCounts.get(errorKey) || 0
    this.errorCounts.set(errorKey, currentCount + 1)

    // 記錄到日誌系統
    const logLevel = analysis.severity === ErrorSeverity.CRITICAL ? 'critical' :
                    analysis.severity === ErrorSeverity.HIGH ? 'error' :
                    analysis.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info'

    await logger[logLevel](`API Error: ${error.message}`, {
      component: 'api-error-handler',
      action: 'handle_error',
      ...fullContext,
      errorAnalysis: analysis,
      stack: error.stack,
    }, error)

    // 檢查是否需要觸發警報
    if (ErrorAnalyzer.shouldTriggerAlert(
      analysis.category,
      analysis.severity,
      currentCount
    )) {
      await this.triggerAlert(error, fullContext, analysis, currentCount)
    }

    // 嘗試錯誤恢復
    if (analysis.retryable && analysis.category === ErrorCategory.DATABASE) {
      await this.attemptRecovery(fullContext)
    }

    // 清理舊的錯誤計數
    this.cleanupErrorCounts()

    // 記錄處理時間
    const processingTime = Date.now() - startTime
    metricsCollector.timing('error_handling_duration', processingTime, {
      category: analysis.category,
      severity: analysis.severity,
    })

    // 發送錯誤回應
    if (!res.headersSent) {
      const errorResponse = {
        success: false,
        error: {
          code: analysis.category.toUpperCase(),
          message: this.sanitizeErrorMessage(error.message, analysis.severity),
          timestamp: fullContext.timestamp,
          requestId: fullContext.requestId,
          ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: fullContext,
          }),
        },
      }

      res.status(analysis.statusCode).json(errorResponse)
    }
  }

  private static async triggerAlert(
    error: any,
    context: ErrorContext,
    analysis: any,
    errorCount: number
  ): Promise<void> {
    const alertLevel = analysis.severity === ErrorSeverity.CRITICAL ? AlertLevel.CRITICAL :
                      analysis.severity === ErrorSeverity.HIGH ? AlertLevel.ERROR :
                      AlertLevel.WARNING

    await alertManager.trigger(
      alertLevel,
      `API Error: ${analysis.category}`,
      `${errorCount} occurrences of ${analysis.category} error in ${context.endpoint}`,
      'api-error-handler',
      {
        errorMessage: error.message,
        errorCount,
        endpoint: context.endpoint,
        category: analysis.category,
        severity: analysis.severity,
        retryable: analysis.retryable,
        context,
      }
    )
  }

  private static async attemptRecovery(context: ErrorContext): Promise<void> {
    try {
      // 嘗試重設相關的斷路器
      if (context.category === ErrorCategory.DATABASE) {
        const circuitBreaker = errorRecoveryManager.getCircuitBreaker('database')
        if (circuitBreaker.getState() === 'open') {
          await logger.info('Attempting to reset database circuit breaker', {
            component: 'error-recovery',
            action: 'reset_circuit_breaker',
            context,
          })
        }
      }
    } catch (recoveryError) {
      await logger.error('Error recovery attempt failed', {
        component: 'error-recovery',
        action: 'recovery_failed',
        context,
      }, recoveryError as Error)
    }
  }

  private static sanitizeErrorMessage(message: string, severity: ErrorSeverity): string {
    // 在生產環境中隱藏敏感的錯誤訊息
    if (process.env.NODE_ENV === 'production' && severity === ErrorSeverity.CRITICAL) {
      return 'An internal error occurred. Please try again later.'
    }

    // 移除敏感資訊
    return message
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***')
  }

  private static cleanupErrorCounts(): void {
    const now = Date.now()
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      // 清理 1 小時前的錯誤計數
      const cutoff = now - (60 * 60 * 1000)
      for (const [key, timestamp] of this.errorCounts.entries()) {
        if (timestamp < cutoff) {
          this.errorCounts.delete(key)
        }
      }
      this.lastCleanup = now
    }
  }
}

// 中介軟體工廠函數
export function withComprehensiveErrorHandling() {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        await handler(req, res)
      } catch (error: any) {
        await ErrorHandlingMiddleware.handleError(error, req, res)
      }
    }
  }
}

// 特定錯誤類型的中介軟體
export function withDatabaseErrorHandling() {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return withComprehensiveErrorHandling()(async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        await handler(req, res)
      } catch (error: any) {
        // 為資料庫錯誤添加額外的上下文
        const context: ErrorContext = {
          category: ErrorCategory.DATABASE,
          metadata: {
            operation: req.method,
            collection: req.url?.split('/').pop(),
          },
        }
        
        await ErrorHandlingMiddleware.handleError(error, req, res, context)
      }
    })
  }
}

export function withExternalServiceErrorHandling(serviceName: string) {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return withComprehensiveErrorHandling()(async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        await handler(req, res)
      } catch (error: any) {
        const context: ErrorContext = {
          category: ErrorCategory.EXTERNAL_SERVICE,
          metadata: {
            serviceName,
            operation: req.method,
          },
        }
        
        await ErrorHandlingMiddleware.handleError(error, req, res, context)
      }
    })
  }
}