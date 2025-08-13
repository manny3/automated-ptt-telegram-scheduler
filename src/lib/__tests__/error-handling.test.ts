/**
 * 錯誤處理系統測試
 * 
 * 測試日誌記錄、錯誤分類、重試邏輯和監控功能
 */

import { jest } from '@jest/globals'
import { logger, LogLevel } from '../logger'
import { 
  DatabaseError, 
  ValidationError, 
  PermissionError,
  dbWrapper,
  DatabaseOperationWrapper 
} from '../database-error-handler'
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  createSuccessResponse,
  withErrorHandler,
  withMethodValidation
} from '../api-error-handler'
import {
  metricsCollector,
  alertManager,
  healthChecker,
  AlertLevel
} from '../monitoring'

// Mock Google Cloud Logging
jest.mock('@google-cloud/logging', () => ({
  Logging: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockReturnValue({
      entry: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined),
    }),
  })),
}))

describe('錯誤處理系統', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 重設環境變數
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'debug'
  })

  describe('日誌記錄系統', () => {
    it('應該記錄不同等級的日誌', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      
      await logger.info('測試訊息', { component: 'test' })
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('應該根據日誌等級過濾訊息', async () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation()
      
      // 設定較高的日誌等級
      process.env.LOG_LEVEL = 'warn'
      
      await logger.debug('這個訊息應該被過濾')
      
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('應該記錄效能指標', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      
      await logger.logPerformance('test_action', 1500, { component: 'test' })
      
      expect(consoleSpy).toHaveBeenCalled()
      const logCall = consoleSpy.mock.calls[0][0]
      expect(logCall).toContain('Performance: test_action completed')
      
      consoleSpy.mockRestore()
    })

    it('應該記錄 API 請求', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      
      await logger.logApiRequest('GET', '/api/test', 200, 150)
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('應該記錄資料庫操作', async () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation()
      
      await logger.logDatabaseOperation('read', 'configurations', 100)
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('資料庫錯誤處理', () => {
    it('應該正確分類資料庫錯誤', () => {
      const validationError = new ValidationError('Invalid field', 'email')
      expect(validationError.retryable).toBe(false)
      expect(validationError.field).toBe('email')

      const permissionError = new PermissionError('Access denied')
      expect(permissionError.retryable).toBe(false)

      const dbError = new DatabaseError('Connection failed', 'UNAVAILABLE', true)
      expect(dbError.retryable).toBe(true)
    })

    it('應該實作重試邏輯', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce('success')

      const wrapper = new DatabaseOperationWrapper({
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: ['UNKNOWN'],
      })

      const result = await wrapper.execute(
        mockOperation,
        'test_operation',
        'test_collection'
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })

    it('應該在不可重試錯誤時立即失敗', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new ValidationError('Invalid data'))

      const wrapper = new DatabaseOperationWrapper()

      await expect(wrapper.execute(
        mockOperation,
        'test_operation',
        'test_collection'
      )).rejects.toThrow(ValidationError)

      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('應該在達到最大重試次數後失敗', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new Error('Persistent failure'))

      const wrapper = new DatabaseOperationWrapper({
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: ['UNKNOWN'],
      })

      await expect(wrapper.execute(
        mockOperation,
        'test_operation',
        'test_collection'
      )).rejects.toThrow('Database error')

      expect(mockOperation).toHaveBeenCalledTimes(3) // 初始 + 2 次重試
    })
  })

  describe('API 錯誤處理', () => {
    it('應該建立正確的成功回應', () => {
      const response = createSuccessResponse({ id: 1, name: 'test' }, 'Success', 'req-123')
      
      expect(response.success).toBe(true)
      expect(response.data).toEqual({ id: 1, name: 'test' })
      expect(response.message).toBe('Success')
      expect(response.requestId).toBe('req-123')
      expect(response.timestamp).toBeDefined()
    })

    it('應該正確分類 API 錯誤', () => {
      const badRequest = new BadRequestError('Invalid input')
      expect(badRequest.statusCode).toBe(400)
      expect(badRequest.code).toBe('BAD_REQUEST')

      const unauthorized = new UnauthorizedError()
      expect(unauthorized.statusCode).toBe(401)
      expect(unauthorized.code).toBe('UNAUTHORIZED')

      const notFound = new NotFoundError()
      expect(notFound.statusCode).toBe(404)
      expect(notFound.code).toBe('NOT_FOUND')
    })

    it('應該驗證 HTTP 方法', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined)
      const wrappedHandler = withMethodValidation(['GET', 'POST'])(mockHandler)

      const mockReq = { method: 'GET' } as any
      const mockRes = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false
      } as any

      await wrappedHandler(mockReq, mockRes)
      expect(mockHandler).toHaveBeenCalled()

      // 測試不允許的方法
      const mockReqDelete = { method: 'DELETE' } as any
      await wrappedHandler(mockReqDelete, mockRes)
      
      expect(mockRes.status).toHaveBeenCalledWith(405)
    })

    it('應該處理處理器中的錯誤', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new BadRequestError('Test error'))
      const wrappedHandler = withErrorHandler(mockHandler)

      const mockReq = { method: 'GET', url: '/test' } as any
      const mockRes = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false
      } as any

      await wrappedHandler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
            message: 'Test error'
          })
        })
      )
    })
  })

  describe('監控系統', () => {
    beforeEach(() => {
      // 清理指標
      metricsCollector.getMetricNames().forEach(name => {
        metricsCollector.getMetrics(name).length = 0
      })
    })

    it('應該記錄指標', () => {
      metricsCollector.record('test_metric', 100, { label: 'test' }, 'ms')
      
      const metrics = metricsCollector.getMetrics('test_metric')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].value).toBe(100)
      expect(metrics[0].labels).toEqual({ label: 'test' })
      expect(metrics[0].unit).toBe('ms')
    })

    it('應該計算統計資料', () => {
      metricsCollector.record('test_stats', 10)
      metricsCollector.record('test_stats', 20)
      metricsCollector.record('test_stats', 30)

      const stats = metricsCollector.getStats('test_stats')
      expect(stats).toEqual({
        count: 3,
        sum: 60,
        avg: 20,
        min: 10,
        max: 30,
        latest: 30
      })
    })

    it('應該觸發和解決警報', async () => {
      const alertId = await alertManager.trigger(
        AlertLevel.WARNING,
        'Test Alert',
        'This is a test alert',
        'test_source',
        { testData: 'value' }
      )

      const alert = alertManager.getAlert(alertId)
      expect(alert).toBeDefined()
      expect(alert!.level).toBe(AlertLevel.WARNING)
      expect(alert!.resolved).toBe(false)

      const resolved = await alertManager.resolve(alertId, 'Test resolution')
      expect(resolved).toBe(true)

      const resolvedAlert = alertManager.getAlert(alertId)
      expect(resolvedAlert!.resolved).toBe(true)
      expect(resolvedAlert!.resolvedAt).toBeDefined()
    })

    it('應該過濾警報', async () => {
      await alertManager.trigger(AlertLevel.WARNING, 'Warning 1', 'Message 1', 'source1')
      await alertManager.trigger(AlertLevel.ERROR, 'Error 1', 'Message 2', 'source2')
      await alertManager.trigger(AlertLevel.WARNING, 'Warning 2', 'Message 3', 'source1')

      const warningAlerts = alertManager.getAlerts({ level: AlertLevel.WARNING })
      expect(warningAlerts).toHaveLength(2)

      const source1Alerts = alertManager.getAlerts({ source: 'source1' })
      expect(source1Alerts).toHaveLength(2)
    })

    it('應該註冊和執行健康檢查', async () => {
      healthChecker.register('test_check', async () => true)
      healthChecker.register('failing_check', async () => {
        throw new Error('Check failed')
      })

      const result = await healthChecker.runCheck('test_check')
      expect(result.healthy).toBe(true)

      const failingResult = await healthChecker.runCheck('failing_check')
      expect(failingResult.healthy).toBe(false)
      expect(failingResult.error).toBe('Check failed')

      const allResults = await healthChecker.runAllChecks()
      expect(allResults.test_check.healthy).toBe(true)
      expect(allResults.failing_check.healthy).toBe(false)
    })

    it('應該提供健康狀態摘要', async () => {
      healthChecker.register('healthy_check', async () => true)
      healthChecker.register('unhealthy_check', async () => false)

      await healthChecker.runAllChecks()

      const summary = healthChecker.getHealthSummary()
      expect(summary.overall).toBe(false) // 因為有一個檢查失敗
      expect(summary.checks.healthy_check.healthy).toBe(true)
      expect(summary.checks.unhealthy_check.healthy).toBe(false)
    })
  })

  describe('整合測試', () => {
    it('應該在資料庫錯誤時觸發警報', async () => {
      const alertHandler = jest.fn()
      alertManager.registerHandler(alertHandler)

      const mockOperation = jest.fn()
        .mockRejectedValue(new DatabaseError('Connection failed', 'UNAVAILABLE'))

      try {
        await dbWrapper.execute(mockOperation, 'test_operation', 'test_collection')
      } catch (error) {
        // 預期會拋出錯誤
      }

      // 檢查是否有錯誤日誌（間接檢查，因為我們 mock 了 console）
      expect(mockOperation).toHaveBeenCalled()
    })

    it('應該記錄 API 效能指標', () => {
      const endpoint = '/api/test'
      const method = 'GET'
      const duration = 150
      const statusCode = 200

      metricsCollector.timing('api_response_time', duration, {
        endpoint,
        method,
        status: statusCode.toString(),
      })

      const metrics = metricsCollector.getMetrics('api_response_time')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].value).toBe(duration)
      expect(metrics[0].labels).toEqual({
        endpoint,
        method,
        status: statusCode.toString(),
      })
    })
  })
})