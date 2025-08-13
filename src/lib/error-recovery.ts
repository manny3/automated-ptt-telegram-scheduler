/**
 * 錯誤恢復和自動修復系統
 * 
 * 提供自動錯誤恢復、斷路器模式和降級處理
 */

import { logger } from './logger'
import { alertManager, AlertLevel, metricsCollector } from './monitoring'

// 斷路器狀態
export enum CircuitBreakerState {
  CLOSED = 'closed',     // 正常狀態
  OPEN = 'open',         // 斷路狀態
  HALF_OPEN = 'half_open' // 半開狀態
}

// 斷路器配置
export interface CircuitBreakerConfig {
  failureThreshold: number    // 失敗閾值
  recoveryTimeout: number     // 恢復超時時間（毫秒）
  monitoringPeriod: number    // 監控週期（毫秒）
  halfOpenMaxCalls: number    // 半開狀態最大呼叫次數
}

// 預設斷路器配置
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 分鐘
  monitoringPeriod: 10000, // 10 秒
  halfOpenMaxCalls: 3,
}

// 斷路器類別
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private lastFailureTime: number = 0
  private halfOpenCalls: number = 0

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.halfOpenCalls = 0
        await logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, {
          component: 'circuit-breaker',
          action: 'state_transition',
          circuitName: this.name,
          newState: this.state,
        })
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`)
        await this.recordFailure(error)
        throw error
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        const error = new Error(`Circuit breaker ${this.name} HALF_OPEN call limit exceeded`)
        await this.recordFailure(error)
        throw error
      }
      this.halfOpenCalls++
    }

    try {
      const result = await operation()
      await this.recordSuccess()
      return result
    } catch (error) {
      await this.recordFailure(error as Error)
      throw error
    }
  }

  private async recordSuccess(): Promise<void> {
    const previousState = this.state

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED
      this.failureCount = 0
      this.halfOpenCalls = 0
      
      await logger.info(`Circuit breaker ${this.name} recovered`, {
        component: 'circuit-breaker',
        action: 'recovery',
        circuitName: this.name,
        previousState,
        newState: this.state,
      })
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1)
    }

    metricsCollector.increment('circuit_breaker_success', 1, {
      circuit: this.name,
      state: this.state,
    })
  }

  private async recordFailure(error: Error): Promise<void> {
    this.failureCount++
    this.lastFailureTime = Date.now()

    const previousState = this.state

    if (this.state === CircuitBreakerState.CLOSED && 
        this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      
      await alertManager.trigger(
        AlertLevel.ERROR,
        `Circuit Breaker Opened: ${this.name}`,
        `Circuit breaker ${this.name} has opened due to ${this.failureCount} failures`,
        'circuit-breaker',
        { circuitName: this.name, failureCount: this.failureCount }
      )
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN
    }

    if (previousState !== this.state) {
      await logger.warn(`Circuit breaker ${this.name} state changed`, {
        component: 'circuit-breaker',
        action: 'state_transition',
        circuitName: this.name,
        previousState,
        newState: this.state,
        failureCount: this.failureCount,
      }, error)
    }

    metricsCollector.increment('circuit_breaker_failure', 1, {
      circuit: this.name,
      state: this.state,
    })
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getStats(): {
    state: CircuitBreakerState
    failureCount: number
    lastFailureTime: number
    halfOpenCalls: number
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls,
    }
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.lastFailureTime = 0
    this.halfOpenCalls = 0
  }
}

// 重試策略
export interface RetryStrategy {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
}

// 自動重試裝飾器
export function withAutoRetry(
  strategy: Partial<RetryStrategy> = {},
  retryableErrors: string[] = ['UNAVAILABLE', 'TIMEOUT', 'NETWORK_ERROR']
) {
  const config = { ...DEFAULT_RETRY_STRATEGY, ...strategy }

  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args: any[]) {
      let lastError: Error
      
      for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args)
        } catch (error: any) {
          lastError = error
          
          // 檢查是否為可重試的錯誤
          const isRetryable = retryableErrors.some(code => 
            error.code === code || error.message?.includes(code)
          )
          
          if (!isRetryable || attempt === config.maxAttempts - 1) {
            throw error
          }

          // 計算延遲時間
          const delay = Math.min(
            config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelay
          )

          const finalDelay = config.jitter 
            ? delay + (Math.random() * delay * 0.1) 
            : delay

          await logger.warn(`Retrying ${propertyName} after ${finalDelay}ms`, {
            component: 'auto-retry',
            action: 'retry_attempt',
            method: propertyName,
            attempt: attempt + 1,
            maxAttempts: config.maxAttempts,
            delay: finalDelay,
          }, error)

          await new Promise(resolve => setTimeout(resolve, finalDelay))
        }
      }

      throw lastError!
    }

    return descriptor
  }
}

// 降級處理器
export class FallbackHandler {
  private fallbacks: Map<string, () => Promise<any>> = new Map()

  register(operationName: string, fallback: () => Promise<any>): void {
    this.fallbacks.set(operationName, fallback)
  }

  async execute<T>(
    operationName: string,
    primaryOperation: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    try {
      return await primaryOperation()
    } catch (error) {
      await logger.warn(`Primary operation ${operationName} failed, attempting fallback`, {
        component: 'fallback-handler',
        action: 'fallback_attempt',
        operationName,
      }, error as Error)

      // 嘗試註冊的降級處理器
      const fallback = this.fallbacks.get(operationName)
      if (fallback) {
        try {
          const result = await fallback()
          
          await logger.info(`Fallback successful for ${operationName}`, {
            component: 'fallback-handler',
            action: 'fallback_success',
            operationName,
          })

          metricsCollector.increment('fallback_success', 1, {
            operation: operationName,
          })

          return result
        } catch (fallbackError) {
          await logger.error(`Fallback failed for ${operationName}`, {
            component: 'fallback-handler',
            action: 'fallback_failure',
            operationName,
          }, fallbackError as Error)

          metricsCollector.increment('fallback_failure', 1, {
            operation: operationName,
          })
        }
      }

      // 如果有提供預設資料，使用它
      if (fallbackData !== undefined) {
        await logger.info(`Using fallback data for ${operationName}`, {
          component: 'fallback-handler',
          action: 'fallback_data_used',
          operationName,
        })

        metricsCollector.increment('fallback_data_used', 1, {
          operation: operationName,
        })

        return fallbackData
      }

      // 所有降級選項都失敗，重新拋出原始錯誤
      throw error
    }
  }
}

// 錯誤恢復管理器
export class ErrorRecoveryManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private fallbackHandler = new FallbackHandler()

  getCircuitBreaker(
    name: string, 
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const finalConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config }
      this.circuitBreakers.set(name, new CircuitBreaker(name, finalConfig))
    }
    return this.circuitBreakers.get(name)!
  }

  registerFallback(operationName: string, fallback: () => Promise<any>): void {
    this.fallbackHandler.register(operationName, fallback)
  }

  async executeWithRecovery<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: {
      circuitBreaker?: boolean
      fallback?: () => Promise<T>
      fallbackData?: T
    } = {}
  ): Promise<T> {
    let finalOperation = operation

    // 如果啟用斷路器，包裝操作
    if (options.circuitBreaker !== false) {
      const circuitBreaker = this.getCircuitBreaker(operationName)
      finalOperation = () => circuitBreaker.execute(operation)
    }

    // 如果有降級選項，使用降級處理器
    if (options.fallback || options.fallbackData !== undefined) {
      if (options.fallback) {
        this.fallbackHandler.register(operationName, options.fallback)
      }
      
      return this.fallbackHandler.execute(
        operationName,
        finalOperation,
        options.fallbackData
      )
    }

    return finalOperation()
  }

  getCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      stats[name] = breaker.getStats()
    }
    
    return stats
  }

  resetAllCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset()
    }
    
    logger.info('All circuit breakers reset', {
      component: 'error-recovery',
      action: 'reset_all_circuit_breakers',
      count: this.circuitBreakers.size,
    })
  }
}

// 全域錯誤恢復管理器實例
export const errorRecoveryManager = new ErrorRecoveryManager()

// 便利函數
export function withCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const circuitBreaker = errorRecoveryManager.getCircuitBreaker(name, config)

    descriptor.value = async function(...args: any[]) {
      return circuitBreaker.execute(() => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

export function withFallback<T>(
  fallback: () => Promise<T>,
  fallbackData?: T
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const operationName = `${target.constructor.name}.${propertyName}`

    descriptor.value = async function(...args: any[]) {
      return errorRecoveryManager.executeWithRecovery(
        operationName,
        () => originalMethod.apply(this, args),
        { fallback, fallbackData }
      )
    }

    return descriptor
  }
}