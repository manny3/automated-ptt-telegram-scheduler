/**
 * 錯誤處理中介軟體測試
 */

import { jest } from '@jest/globals'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  ErrorAnalyzer,
  ErrorCategory,
  ErrorSeverity,
  ErrorHandlingMiddleware,
  withComprehensiveErrorHandling,
  withDatabaseErrorHandling,
  withExternalServiceErrorHandling,
} from '../error-handling'

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    critical: jest.fn(),
  },
}))

jest.mock('@/lib/monitoring', () => ({
  metricsCollector: {
    increment: jest.fn(),
    timing: jest.fn(),
  },
  alertManager: {
    trigger: jest.fn(),
  },
  AlertLevel: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
  },
}))

jest.mock('@/lib/error-recovery', () => ({
  errorRecoveryManager: {
    getCircuitBreaker: jest.fn().mockReturnValue({
      getState: jest.fn().mockReturnValue('closed'),
    }),
  },
}))

describe('錯誤處理中介軟體', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  describe('ErrorAnalyzer', () => {
    it('應該正確分析驗證錯誤', () => {
      const error = new Error('Validation failed: invalid email')
      const analysis = ErrorAnalyzer.analyzeError(error)

      expect(analysis.category).toBe(ErrorCategory.VALIDATION)
      expect(analysis.severity).toBe(ErrorSeverity.LOW)
      expect(analysis.retryable).toBe(false)
      expect(analysis.statusCode).toBe(400)
    })

    it('應該正確分析認證錯誤', () => {
      const error = { message: 'Unauthorized access', code: 401 }
      const analysis = ErrorAnalyzer.analyzeError(error)

      expect(analysis.category).toBe(ErrorCategory.AUTHENTICATION)
      expect(analysis.severity).toBe(ErrorSeverity.MEDIUM)
      expect(analysis.retryable).toBe(false)
      expect(analysis.statusCode).toBe(401)
    })

    it('應該正確分析資料庫錯誤', () => {
      const error = { message: 'Database connection failed', code: 'UNAVAILABLE' }
      const analysis = ErrorAnalyzer.analyzeError(error)

      expect(analysis.category).toBe(ErrorCategory.DATABASE)
      expect(analysis.severity).toBe(ErrorSeverity.HIGH)
      expect(analysis.retryable).toBe(true)
      expect(analysis.statusCode).toBe(503)
    })

    it('應該正確分析網路錯誤', () => {
      const error = new Error('Network timeout occurred')
      const analysis = ErrorAnalyzer.analyzeError(error)

      expect(analysis.category).toBe(ErrorCategory.NETWORK)
      expect(analysis.severity).toBe(ErrorSeverity.MEDIUM)
      expect(analysis.retryable).toBe(true)
      expect(analysis.statusCode).toBe(503)
    })

    it('應該將未知錯誤分類為內部錯誤', () => {
      const error = new Error('Something went wrong')
      const analysis = ErrorAnalyzer.analyzeError(error)

      expect(analysis.category).toBe(ErrorCategory.INTERNAL)
      expect(analysis.severity).toBe(ErrorSeverity.CRITICAL)
      expect(analysis.retryable).toBe(false)
      expect(analysis.statusCode).toBe(500)
    })

    describe('shouldTriggerAlert', () => {
      it('應該為嚴重錯誤觸發警報', () => {
        const shouldAlert = ErrorAnalyzer.shouldTriggerAlert(
          ErrorCategory.INTERNAL,
          ErrorSeverity.CRITICAL,
          1
        )
        expect(shouldAlert).toBe(true)
      })

      it('應該為多次高嚴重程度錯誤觸發警報', () => {
        const shouldAlert = ErrorAnalyzer.shouldTriggerAlert(
          ErrorCategory.DATABASE,
          ErrorSeverity.HIGH,
          3
        )
        expect(shouldAlert).toBe(true)
      })

      it('應該為大量中等嚴重程度錯誤觸發警報', () => {
        const shouldAlert = ErrorAnalyzer.shouldTriggerAlert(
          ErrorCategory.RATE_LIMIT,
          ErrorSeverity.MEDIUM,
          10
        )
        expect(shouldAlert).toBe(true)
      })

      it('應該為少量低嚴重程度錯誤不觸發警報', () => {
        const shouldAlert = ErrorAnalyzer.shouldTriggerAlert(
          ErrorCategory.VALIDATION,
          ErrorSeverity.LOW,
          5
        )
        expect(shouldAlert).toBe(false)
      })
    })
  })

  describe('ErrorHandlingMiddleware', () => {
    let mockReq: Partial<NextApiRequest>
    let mockRes: Partial<NextApiResponse>

    beforeEach(() => {
      mockReq = {
        url: '/api/test',
        method: 'GET',
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '127.0.0.1',
        },
        connection: { remoteAddress: '127.0.0.1' } as any,
      }

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      }
    })

    it('應該處理錯誤並發送適當的回應', async () => {
      const error = new Error('Test error')
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL',
            message: 'Test error',
          }),
        })
      )
    })

    it('應該記錄錯誤指標', async () => {
      const { metricsCollector } = require('@/lib/monitoring')
      const error = new Error('Test error')
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(metricsCollector.increment).toHaveBeenCalledWith(
        'api_errors_total',
        1,
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'GET',
          category: ErrorCategory.INTERNAL,
          severity: ErrorSeverity.CRITICAL,
        })
      )
    })

    it('應該記錄到日誌系統', async () => {
      const { logger } = require('@/lib/logger')
      const error = new Error('Test error')
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(logger.critical).toHaveBeenCalledWith(
        'API Error: Test error',
        expect.objectContaining({
          component: 'api-error-handler',
          action: 'handle_error',
          endpoint: '/api/test',
          method: 'GET',
        }),
        error
      )
    })

    it('應該在生產環境中隱藏敏感錯誤訊息', async () => {
      process.env.NODE_ENV = 'production'
      const error = new Error('Database password is invalid')
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'An internal error occurred. Please try again later.',
          }),
        })
      )
    })

    it('應該在開發環境中包含錯誤詳情', async () => {
      process.env.NODE_ENV = 'development'
      const error = new Error('Test error')
      error.stack = 'Error stack trace'
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: 'Error stack trace',
            details: expect.any(Object),
          }),
        })
      )
    })

    it('應該在已發送標頭時不發送回應', async () => {
      mockRes.headersSent = true
      const error = new Error('Test error')
      
      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
    })
  })

  describe('中介軟體包裝器', () => {
    let mockHandler: jest.Mock
    let mockReq: Partial<NextApiRequest>
    let mockRes: Partial<NextApiResponse>

    beforeEach(() => {
      mockHandler = jest.fn()
      mockReq = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
      }
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      }
    })

    describe('withComprehensiveErrorHandling', () => {
      it('應該在沒有錯誤時正常執行處理器', async () => {
        mockHandler.mockResolvedValue(undefined)
        const wrappedHandler = withComprehensiveErrorHandling()(mockHandler)

        await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)

        expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes)
        expect(mockRes.status).not.toHaveBeenCalled()
      })

      it('應該捕獲和處理處理器中的錯誤', async () => {
        const error = new Error('Handler error')
        mockHandler.mockRejectedValue(error)
        const wrappedHandler = withComprehensiveErrorHandling()(mockHandler)

        await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)

        expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes)
        expect(mockRes.status).toHaveBeenCalledWith(500)
        expect(mockRes.json).toHaveBeenCalled()
      })
    })

    describe('withDatabaseErrorHandling', () => {
      it('應該為資料庫錯誤添加特定上下文', async () => {
        const error = new Error('Database error')
        mockHandler.mockRejectedValue(error)
        const wrappedHandler = withDatabaseErrorHandling()(mockHandler)

        await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)

        expect(mockRes.status).toHaveBeenCalled()
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'DATABASE',
            }),
          })
        )
      })
    })

    describe('withExternalServiceErrorHandling', () => {
      it('應該為外部服務錯誤添加服務名稱', async () => {
        const error = new Error('External service error')
        mockHandler.mockRejectedValue(error)
        const wrappedHandler = withExternalServiceErrorHandling('telegram-api')(mockHandler)

        await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse)

        expect(mockRes.status).toHaveBeenCalled()
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'EXTERNAL_SERVICE',
            }),
          })
        )
      })
    })
  })

  describe('錯誤訊息清理', () => {
    it('應該移除密碼資訊', async () => {
      const error = new Error('Connection failed: password=secret123')
      const mockReq = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      }

      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Connection failed: password=***',
          }),
        })
      )
    })

    it('應該移除 token 資訊', async () => {
      const error = new Error('API call failed: token=abc123xyz')
      const mockReq = {
        url: '/api/test',
        method: 'GET',
        headers: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      }

      await ErrorHandlingMiddleware.handleError(
        error,
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'API call failed: token=***',
          }),
        })
      )
    })
  })
})