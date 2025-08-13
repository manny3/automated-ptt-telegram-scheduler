/**
 * 資料庫錯誤處理和重試邏輯
 * 
 * 提供 Firestore 操作的錯誤處理、重試機制和連接管理
 */

import { logger, PerformanceTimer } from './logger'

// 重試配置
export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

// 預設重試配置
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 秒
  maxDelay: 10000, // 10 秒
  backoffMultiplier: 2,
  retryableErrors: [
    'UNAVAILABLE',
    'DEADLINE_EXCEEDED',
    'RESOURCE_EXHAUSTED',
    'ABORTED',
    'INTERNAL',
    'UNKNOWN',
  ],
}

// 資料庫錯誤類型
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public retryable: boolean = true,
    public operation?: string,
    public collection?: string
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// 連接錯誤類型
export class ConnectionError extends DatabaseError {
  constructor(message: string, code?: string) {
    super(message, code, true)
    this.name = 'ConnectionError'
  }
}

// 驗證錯誤類型
export class ValidationError extends DatabaseError {
  constructor(message: string, public field?: string) {
    super(message, 'INVALID_ARGUMENT', false)
    this.name = 'ValidationError'
  }
}

// 權限錯誤類型
export class PermissionError extends DatabaseError {
  constructor(message: string) {
    super(message, 'PERMISSION_DENIED', false)
    this.name = 'PermissionError'
  }
}

// 睡眠工具函數
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

// 計算重試延遲時間
function calculateDelay(
  attempt: number, 
  config: RetryConfig, 
  jitter: boolean = true
): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  )
  
  if (jitter) {
    // 加入隨機抖動 (±25%)
    const jitterAmount = delay * 0.25 * (Math.random() * 2 - 1)
    return Math.max(delay + jitterAmount, 0)
  }
  
  return delay
}

// 判斷錯誤是否可重試
function isRetryableError(error: any, config: RetryConfig): boolean {
  if (error instanceof DatabaseError) {
    return error.retryable
  }
  
  const errorCode = error.code || error.status || 'UNKNOWN'
  return config.retryableErrors.includes(errorCode)
}

// 錯誤分類和轉換
function classifyError(error: any, operation?: string, collection?: string): DatabaseError {
  const errorCode = error.code || error.status
  const errorMessage = error.message || 'Unknown database error'
  
  switch (errorCode) {
    case 'PERMISSION_DENIED':
    case 'UNAUTHENTICATED':
      return new PermissionError(`Database permission denied: ${errorMessage}`)
    
    case 'INVALID_ARGUMENT':
    case 'FAILED_PRECONDITION':
      return new ValidationError(`Database validation error: ${errorMessage}`)
    
    case 'NOT_FOUND':
      return new DatabaseError(`Resource not found: ${errorMessage}`, errorCode, false, operation, collection)
    
    case 'ALREADY_EXISTS':
      return new DatabaseError(`Resource already exists: ${errorMessage}`, errorCode, false, operation, collection)
    
    case 'UNAVAILABLE':
    case 'DEADLINE_EXCEEDED':
    case 'RESOURCE_EXHAUSTED':
      return new ConnectionError(`Database connection error: ${errorMessage}`, errorCode)
    
    case 'ABORTED':
    case 'INTERNAL':
    case 'UNKNOWN':
    default:
      return new DatabaseError(`Database error: ${errorMessage}`, errorCode, true, operation, collection)
  }
}

// 資料庫操作包裝器
export class DatabaseOperationWrapper {
  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    collection?: string,
    context?: Record<string, any>
  ): Promise<T> {
    const timer = new PerformanceTimer(`database.${operationName}`, {
      component: 'database',
      action: operationName,
      collection,
      ...context,
    })

    let lastError: Error
    let attempt = 0

    while (attempt <= this.config.maxRetries) {
      try {
        logger.debug(`Database operation attempt ${attempt + 1}`, {
          component: 'database',
          action: operationName,
          collection,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries + 1,
          ...context,
        })

        const result = await operation()
        
        const duration = await timer.end()
        
        await logger.logDatabaseOperation(
          operationName,
          collection || 'unknown',
          duration,
          { ...context, attempt: attempt + 1 }
        )

        return result
      } catch (error: any) {
        lastError = error
        const dbError = classifyError(error, operationName, collection)
        
        // 記錄錯誤
        await logger.error(`Database operation failed: ${operationName}`, {
          component: 'database',
          action: operationName,
          collection,
          attempt: attempt + 1,
          errorCode: dbError.code,
          retryable: dbError.retryable,
          ...context,
        }, dbError)

        // 如果不可重試或已達最大重試次數，拋出錯誤
        if (!isRetryableError(dbError, this.config) || attempt >= this.config.maxRetries) {
          await timer.end()
          throw dbError
        }

        // 計算延遲時間並等待
        const delay = calculateDelay(attempt, this.config)
        
        await logger.warn(`Retrying database operation after ${delay}ms`, {
          component: 'database',
          action: operationName,
          collection,
          attempt: attempt + 1,
          delay,
          ...context,
        })

        await sleep(delay)
        attempt++
      }
    }

    await timer.end()
    throw classifyError(lastError!, operationName, collection)
  }
}

// 全域資料庫操作包裝器實例
export const dbWrapper = new DatabaseOperationWrapper()

// 裝飾器工廠函數
export function withDatabaseErrorHandling(
  operationName?: string,
  collection?: string,
  config?: Partial<RetryConfig>
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const finalOperationName = operationName || `${target.constructor.name}.${propertyName}`
    const wrapper = config ? new DatabaseOperationWrapper({ ...DEFAULT_RETRY_CONFIG, ...config }) : dbWrapper

    descriptor.value = async function(...args: any[]) {
      return wrapper.execute(
        () => originalMethod.apply(this, args),
        finalOperationName,
        collection,
        { className: target.constructor.name, methodName: propertyName }
      )
    }

    return descriptor
  }
}

// 連接健康檢查
export class DatabaseHealthChecker {
  private lastHealthCheck: Date | null = null
  private isHealthy: boolean = true
  private healthCheckInterval: number = 30000 // 30 秒

  async checkHealth(): Promise<boolean> {
    const now = new Date()
    
    // 如果最近檢查過且狀態良好，直接返回
    if (this.lastHealthCheck && 
        this.isHealthy && 
        (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCheckInterval) {
      return this.isHealthy
    }

    try {
      // 這裡應該執行實際的健康檢查邏輯
      // 例如：嘗試讀取一個測試文件或執行簡單查詢
      const timer = new PerformanceTimer('database.health_check')
      
      // 模擬健康檢查（實際實作中應該替換為真實的檢查）
      await new Promise(resolve => setTimeout(resolve, 100))
      
      await timer.end()
      
      this.isHealthy = true
      this.lastHealthCheck = now
      
      await logger.debug('Database health check passed', {
        component: 'database',
        action: 'health_check',
        status: 'healthy',
      })
      
      return true
    } catch (error) {
      this.isHealthy = false
      this.lastHealthCheck = now
      
      await logger.error('Database health check failed', {
        component: 'database',
        action: 'health_check',
        status: 'unhealthy',
      }, error as Error)
      
      return false
    }
  }

  getHealthStatus(): { healthy: boolean; lastCheck: Date | null } {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
    }
  }
}

// 全域健康檢查器實例
export const dbHealthChecker = new DatabaseHealthChecker()

// 批次操作錯誤處理
export class BatchOperationHandler {
  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    batchName: string,
    options: {
      maxConcurrency?: number
      failFast?: boolean
      collection?: string
    } = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const { maxConcurrency = 5, failFast = false, collection } = options
    const results: Array<{ success: boolean; result?: T; error?: Error }> = []
    
    await logger.info(`Starting batch operation: ${batchName}`, {
      component: 'database',
      action: 'batch_start',
      batchName,
      operationCount: operations.length,
      maxConcurrency,
      collection,
    })

    const timer = new PerformanceTimer(`database.batch.${batchName}`)

    // 分批執行操作
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency)
      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await this.execute(
            operation,
            `${batchName}_item_${i + index}`,
            collection
          )
          return { success: true, result }
        } catch (error) {
          if (failFast) {
            throw error
          }
          return { success: false, error: error as Error }
        }
      })

      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      } catch (error) {
        if (failFast) {
          await timer.end()
          throw error
        }
      }
    }

    const duration = await timer.end()
    const successCount = results.filter(r => r.success).length
    const errorCount = results.length - successCount

    await logger.info(`Batch operation completed: ${batchName}`, {
      component: 'database',
      action: 'batch_complete',
      batchName,
      duration,
      totalOperations: operations.length,
      successCount,
      errorCount,
      collection,
    })

    return results
  }

  private async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    collection?: string
  ): Promise<T> {
    return dbWrapper.execute(operation, operationName, collection)
  }
}

// 全域批次操作處理器實例
export const batchHandler = new BatchOperationHandler()