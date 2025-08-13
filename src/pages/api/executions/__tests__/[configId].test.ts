/**
 * 執行歷史 API 測試
 */

import { jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import handler from '../[configId]'

// Mock dependencies
jest.mock('@/lib/firestore', () => ({
  db: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    get: jest.fn(),
  },
}))

jest.mock('@/lib/database-error-handler', () => ({
  dbWrapper: {
    execute: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/monitoring', () => ({
  metricsCollector: {
    increment: jest.fn(),
  },
}))

describe('/api/executions/[configId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('應該成功取得執行歷史', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    // Mock 配置存在檢查
    dbWrapper.execute
      .mockResolvedValueOnce(true) // 配置存在
      .mockResolvedValueOnce([ // 執行記錄
        {
          id: 'exec1',
          configurationId: 'config1',
          configurationName: 'Test Config',
          timestamp: '2023-12-01T10:00:00Z',
          status: 'success',
          articlesFound: 5,
          articlesSent: 5,
          executionTime: 2000,
          pttBoard: 'Gossiping',
          keywords: ['test'],
          telegramChatId: '123456789',
        },
      ])
      .mockResolvedValueOnce(1) // 總數

    const { req, res } = createMocks({
      method: 'GET',
      query: { configId: 'config1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.executions).toHaveLength(1)
    expect(data.data.stats.totalExecutions).toBe(1)
  })

  it('應該在配置不存在時返回 404', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    // Mock 配置不存在
    dbWrapper.execute.mockResolvedValueOnce(false)

    const { req, res } = createMocks({
      method: 'GET',
      query: { configId: 'nonexistent' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(404)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('應該驗證查詢參數', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { 
        configId: 'config1',
        limit: '150', // 超過最大限制
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('BAD_REQUEST')
  })

  it('應該支援狀態過濾', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    dbWrapper.execute
      .mockResolvedValueOnce(true) // 配置存在
      .mockResolvedValueOnce([]) // 執行記錄
      .mockResolvedValueOnce(0) // 總數

    const { req, res } = createMocks({
      method: 'GET',
      query: { 
        configId: 'config1',
        status: 'success',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.query.status).toBe('success')
  })

  it('應該支援日期範圍過濾', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    dbWrapper.execute
      .mockResolvedValueOnce(true) // 配置存在
      .mockResolvedValueOnce([]) // 執行記錄
      .mockResolvedValueOnce(0) // 總數

    const { req, res } = createMocks({
      method: 'GET',
      query: { 
        configId: 'config1',
        startDate: '2023-12-01',
        endDate: '2023-12-31',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.query.startDate).toBe('2023-12-01')
    expect(data.data.query.endDate).toBe('2023-12-31')
  })

  it('應該支援排序和分頁', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    dbWrapper.execute
      .mockResolvedValueOnce(true) // 配置存在
      .mockResolvedValueOnce([]) // 執行記錄
      .mockResolvedValueOnce(0) // 總數

    const { req, res } = createMocks({
      method: 'GET',
      query: { 
        configId: 'config1',
        sortBy: 'articlesFound',
        sortOrder: 'asc',
        limit: '10',
        offset: '20',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.pagination.limit).toBe(10)
    expect(data.data.pagination.offset).toBe(20)
  })

  it('應該拒絕非 GET 請求', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { configId: 'config1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('METHOD_NOT_ALLOWED')
  })

  it('應該處理資料庫錯誤', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    // Mock 資料庫錯誤
    dbWrapper.execute.mockRejectedValueOnce(new Error('Database connection failed'))

    const { req, res } = createMocks({
      method: 'GET',
      query: { configId: 'config1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(false)
  })

  it('應該計算正確的統計資料', async () => {
    const { dbWrapper } = require('@/lib/database-error-handler')
    
    const mockExecutions = [
      {
        id: 'exec1',
        status: 'success',
        articlesFound: 5,
        articlesSent: 5,
        executionTime: 2000,
      },
      {
        id: 'exec2',
        status: 'error',
        articlesFound: 3,
        articlesSent: 0,
        executionTime: 1000,
      },
      {
        id: 'exec3',
        status: 'partial',
        articlesFound: 4,
        articlesSent: 2,
        executionTime: 1500,
      },
    ]

    dbWrapper.execute
      .mockResolvedValueOnce(true) // 配置存在
      .mockResolvedValueOnce(mockExecutions) // 執行記錄
      .mockResolvedValueOnce(3) // 總數

    const { req, res } = createMocks({
      method: 'GET',
      query: { configId: 'config1' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    
    const stats = data.data.stats
    expect(stats.totalExecutions).toBe(3)
    expect(stats.successCount).toBe(1)
    expect(stats.errorCount).toBe(1)
    expect(stats.partialCount).toBe(1)
    expect(stats.totalArticlesFound).toBe(12)
    expect(stats.totalArticlesSent).toBe(7)
    expect(stats.averageExecutionTime).toBe(1500)
  })
})