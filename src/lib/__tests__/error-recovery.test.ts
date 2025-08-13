/**
 * 錯誤恢復系統測試
 * 
 * 測試斷路器、重試邏輯和降級處理
 */

import { jest } from '@jest/globals'
import {
  CircuitBreaker,
  CircuitBreakerState,
  FallbackHandler,
  ErrorRecoveryManager,
  withAutoRetry,
  withCircuitBreaker,
  withFallback,
  errorRecoveryManager
} from '../error-recovery'

// Mock logger and monitoring
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('../monitoring', () => ({
  alertManager: {
    trigger: jest.fn(),
  },
  metricsCollector: {
    increment: jest.fn(),
  },
}))

describe('錯誤恢復系統', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CircuitBreaker', () => {
    it('應該在正常狀態下執行操作', async () => {
      const circuitBreaker = new CircuitBreaker('test-circuit')
      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await circuitBreaker.execute(mockOperation)

      expect(result).toBe('success')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('應該在失敗次數達到閾值時開啟斷路器', async () => {
      const circuitBreaker = new CircuitBreaker('test-circuit', {
        failureThreshold: 2,
        recoveryTimeout: 1000,
        monitoringPeriod: 100,
        halfOpenMaxCalls: 1,
      })

      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'))

      // 第一次失敗
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)

      // 第二次失敗，應該開啟斷路器
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

      // 第三次呼叫應該直接被斷路器拒絕
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker test-circuit is OPEN')
      expect(mockOperation).toHaveBeenCalledTimes(2) // 只呼叫了前兩次
    })

    it('應該在恢復超時後轉換到半開狀態', async () => {
      const circuitBreaker = new CircuitBreaker('test-circuit', {
        failureThreshold: 1,
        recoveryTimeout: 100, // 100ms
        monitoringPeriod: 50,
        halfOpenMaxCalls: 1,
      })

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Initial failure'))
        .mockResolvedValueOnce('recovery success')

      // 觸發失敗，開啟斷路器
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Initial failure')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

      // 等待恢復超時
      await new Promise(resolve => setTimeout(resolve, 150))

      // 下次呼叫應該轉換到半開狀態並成功
      const result = await circuitBreaker.execute(mockOperation)
      expect(result).toBe('recovery success')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
    })

    it('應該在半開狀態失敗時重新開啟', async () => {
      const circuitBreaker = new CircuitBreaker('test-circuit', {
        failureThreshold: 1,
        recoveryTimeout: 100,
        monitoringPeriod: 50,
        halfOpenMaxCalls: 1,
      })

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Initial failure'))
        .mockRejectedValueOnce(new Error('Recovery failure'))

      // 觸發失敗，開啟斷路器
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Initial failure')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

      // 等待恢復超時
      await new Promise(resolve => setTimeout(resolve, 150))

      // 半開狀態下的失敗應該重新開啟斷路器
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Recovery failure')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)
    })

    it('應該提供正確的統計資料', () => {
      const circuitBreaker = new CircuitBreaker('test-circuit')
      const stats = circuitBreaker.getStats()

      expect(stats).toEqual({
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenCalls: 0,
      })
    })

    it('應該支援重設功能', async () => {
      const circuitBreaker = new CircuitBreaker('test-circuit', { failureThreshold: 1 })
      const mockOperation = jest.fn().mockRejectedValue(new Error('Failure'))

      // 觸發失敗
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Failure')
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

      // 重設斷路器
      circuitBreaker.reset()
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
      expect(circuitBreaker.getStats().failureCount).toBe(0)
    })
  })

  describe('withAutoRetry 裝飾器', () => {
    it('應該在可重試錯誤時自動重試', async () => {
      class TestService {
        @withAutoRetry({ maxAttempts: 3, baseDelay: 10 }, ['UNAVAILABLE'])
        async testMethod() {
          throw new Error('UNAVAILABLE')
        }
      }

      const service = new TestService()
      const spy = jest.spyOn(service, 'testMethod')

      await expect(service.testMethod()).rejects.toThrow('UNAVAILABLE')
      expect(spy).toHaveBeenCalledTimes(3) // 初始 + 2 次重試
    })

    it('應該在不可重試錯誤時立即失敗', async () => {
      class TestService {
        @withAutoRetry({ maxAttempts: 3 }, ['UNAVAILABLE'])
        async testMethod() {
          throw new Error('INVALID_ARGUMENT')
        }
      }

      const service = new TestService()
      const spy = jest.spyOn(service, 'testMethod')

      await expect(service.testMethod()).rejects.toThrow('INVALID_ARGUMENT')
      expect(spy).toHaveBeenCalledTimes(1) // 只呼叫一次
    })

    it('應該在重試成功時返回結果', async () => {
      class TestService {
        private attempts = 0

        @withAutoRetry({ maxAttempts: 3, baseDelay: 10 }, ['UNAVAILABLE'])
        async testMethod() {
          this.attempts++
          if (this.attempts < 3) {
            throw new Error('UNAVAILABLE')
          }
          return 'success'
        }
      }

      const service = new TestService()
      const result = await service.testMethod()

      expect(result).toBe('success')
    })
  })

  describe('FallbackHandler', () => {
    it('應該在主要操作成功時返回結果', async () => {
      const fallbackHandler = new FallbackHandler()
      const primaryOperation = jest.fn().mockResolvedValue('primary success')

      const result = await fallbackHandler.execute(
        'test-operation',
        primaryOperation
      )

      expect(result).toBe('primary success')
      expect(primaryOperation).toHaveBeenCalledTimes(1)
    })

    it('應該在主要操作失敗時使用註冊的降級處理器', async () => {
      const fallbackHandler = new FallbackHandler()
      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'))
      const fallbackOperation = jest.fn().mockResolvedValue('fallback success')

      fallbackHandler.register('test-operation', fallbackOperation)

      const result = await fallbackHandler.execute(
        'test-operation',
        primaryOperation
      )

      expect(result).toBe('fallback success')
      expect(primaryOperation).toHaveBeenCalledTimes(1)
      expect(fallbackOperation).toHaveBeenCalledTimes(1)
    })

    it('應該在主要操作失敗時使用降級資料', async () => {
      const fallbackHandler = new FallbackHandler()
      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'))

      const result = await fallbackHandler.execute(
        'test-operation',
        primaryOperation,
        'fallback data'
      )

      expect(result).toBe('fallback data')
      expect(primaryOperation).toHaveBeenCalledTimes(1)
    })

    it('應該在所有降級選項都失敗時拋出原始錯誤', async () => {
      const fallbackHandler = new FallbackHandler()
      const primaryError = new Error('Primary failed')
      const primaryOperation = jest.fn().mockRejectedValue(primaryError)
      const fallbackOperation = jest.fn().mockRejectedValue(new Error('Fallback failed'))

      fallbackHandler.register('test-operation', fallbackOperation)

      await expect(fallbackHandler.execute(
        'test-operation',
        primaryOperation
      )).rejects.toThrow('Primary failed')
    })
  })

  describe('ErrorRecoveryManager', () => {
    it('應該建立和管理斷路器', () => {
      const manager = new ErrorRecoveryManager()
      
      const breaker1 = manager.getCircuitBreaker('test-1')
      const breaker2 = manager.getCircuitBreaker('test-1') // 相同名稱
      const breaker3 = manager.getCircuitBreaker('test-2') // 不同名稱

      expect(breaker1).toBe(breaker2) // 應該是同一個實例
      expect(breaker1).not.toBe(breaker3) // 應該是不同實例
    })

    it('應該註冊降級處理器', async () => {
      const manager = new ErrorRecoveryManager()
      const fallbackOperation = jest.fn().mockResolvedValue('fallback result')
      
      manager.registerFallback('test-operation', fallbackOperation)

      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'))
      
      const result = await manager.executeWithRecovery(
        'test-operation',
        primaryOperation,
        { circuitBreaker: false }
      )

      expect(result).toBe('fallback result')
    })

    it('應該同時使用斷路器和降級處理', async () => {
      const manager = new ErrorRecoveryManager()
      const fallbackOperation = jest.fn().mockResolvedValue('fallback result')
      
      manager.registerFallback('test-operation', fallbackOperation)

      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'))
      
      const result = await manager.executeWithRecovery(
        'test-operation',
        primaryOperation,
        { circuitBreaker: true, fallback: fallbackOperation }
      )

      expect(result).toBe('fallback result')
    })

    it('應該提供斷路器統計資料', () => {
      const manager = new ErrorRecoveryManager()
      
      manager.getCircuitBreaker('test-1')
      manager.getCircuitBreaker('test-2')

      const stats = manager.getCircuitBreakerStats()
      
      expect(Object.keys(stats)).toEqual(['test-1', 'test-2'])
      expect(stats['test-1'].state).toBe(CircuitBreakerState.CLOSED)
    })

    it('應該重設所有斷路器', () => {
      const manager = new ErrorRecoveryManager()
      
      const breaker1 = manager.getCircuitBreaker('test-1')
      const breaker2 = manager.getCircuitBreaker('test-2')

      // 模擬一些狀態變更
      breaker1.reset = jest.fn()
      breaker2.reset = jest.fn()

      manager.resetAllCircuitBreakers()

      expect(breaker1.reset).toHaveBeenCalled()
      expect(breaker2.reset).toHaveBeenCalled()
    })
  })

  describe('裝飾器整合', () => {
    it('withCircuitBreaker 應該正確包裝方法', async () => {
      class TestService {
        @withCircuitBreaker('test-circuit')
        async testMethod() {
          return 'success'
        }
      }

      const service = new TestService()
      const result = await service.testMethod()

      expect(result).toBe('success')
    })

    it('withFallback 應該正確包裝方法', async () => {
      class TestService {
        @withFallback(async () => 'fallback result')
        async testMethod() {
          throw new Error('Method failed')
        }
      }

      const service = new TestService()
      const result = await service.testMethod()

      expect(result).toBe('fallback result')
    })
  })
})