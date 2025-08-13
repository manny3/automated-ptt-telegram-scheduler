/**
 * 端到端測試：完整的用戶工作流程
 * 
 * 測試從配置創建到文章發送的完整流程
 */

import { jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

// Mock external dependencies
jest.mock('@google-cloud/firestore')
jest.mock('@google-cloud/secret-manager')
jest.mock('cloudscraper')

// Import handlers after mocking
import configurationsHandler from '@/pages/api/configurations'
import executionsHandler from '@/pages/api/executions/[configId]'

describe('完整用戶工作流程 E2E 測試', () => {
  let mockFirestore: any
  let mockSecretManager: any
  let mockCloudScraper: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Firestore
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }

    const { Firestore } = require('@google-cloud/firestore')
    Firestore.mockImplementation(() => mockFirestore)

    // Mock Secret Manager
    mockSecretManager = {
      accessSecretVersion: jest.fn(),
    }

    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')
    SecretManagerServiceClient.mockImplementation(() => mockSecretManager)

    // Mock CloudScraper
    mockCloudScraper = {
      get: jest.fn(),
    }

    const cloudscraper = require('cloudscraper')
    cloudscraper.mockImplementation(() => mockCloudScraper)
  })

  describe('配置創建到執行的完整流程', () => {
    it('應該成功創建配置並執行爬取任務', async () => {
      // Step 1: 創建配置
      const configurationData = {
        name: 'E2E Test Configuration',
        pttBoard: 'Gossiping',
        keywords: ['測試', '新聞'],
        postCount: 10,
        schedule: {
          type: 'interval',
          intervalMinutes: 60,
        },
        telegramChatId: '123456789',
      }

      // Mock Firestore add for configuration creation
      const mockConfigDoc = {
        id: 'test-config-id',
        data: () => ({
          ...configurationData,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        exists: true,
      }

      mockFirestore.add.mockResolvedValue({
        get: () => Promise.resolve(mockConfigDoc),
      })

      // Create configuration
      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: configurationData,
      })

      await configurationsHandler(createReq, createRes)

      expect(createRes._getStatusCode()).toBe(200)
      const createData = JSON.parse(createRes._getData())
      expect(createData.success).toBe(true)
      expect(createData.data.name).toBe(configurationData.name)

      // Step 2: 模擬 PTT 爬取
      const mockPttResponse = `
        <html>
          <body>
            <div class="r-ent">
              <div class="title">
                <a href="/bbs/Gossiping/M.1234567890.A.123.html">測試文章標題</a>
              </div>
              <div class="meta">
                <div class="author">testuser</div>
                <div class="date">12/01</div>
              </div>
            </div>
          </body>
        </html>
      `

      mockCloudScraper.get.mockResolvedValue({
        body: mockPttResponse,
        statusCode: 200,
      })

      // Step 3: 模擬 Telegram Bot Token 檢索
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Step 4: 模擬執行記錄創建
      const mockExecutionDoc = {
        id: 'test-execution-id',
        data: () => ({
          configurationId: 'test-config-id',
          timestamp: new Date(),
          status: 'success',
          articlesFound: 1,
          articlesSent: 1,
          executionTime: 2000,
        }),
        exists: true,
      }

      mockFirestore.get.mockResolvedValue({
        exists: true,
        data: () => mockConfigDoc.data(),
      })

      mockFirestore.add.mockResolvedValue({
        get: () => Promise.resolve(mockExecutionDoc),
      })

      // Mock execution history query
      mockFirestore.get.mockResolvedValue({
        docs: [mockExecutionDoc],
        forEach: (callback: any) => {
          callback(mockExecutionDoc)
        },
      })

      // Step 5: 檢查執行歷史
      const { req: historyReq, res: historyRes } = createMocks({
        method: 'GET',
        query: { configId: 'test-config-id' },
      })

      await executionsHandler(historyReq, historyRes)

      expect(historyRes._getStatusCode()).toBe(200)
      const historyData = JSON.parse(historyRes._getData())
      expect(historyData.success).toBe(true)
      expect(historyData.data.executions).toHaveLength(1)
      expect(historyData.data.executions[0].status).toBe('success')
    })

    it('應該處理 PTT 爬取失敗的情況', async () => {
      // Mock PTT 爬取失敗
      mockCloudScraper.get.mockRejectedValue(new Error('PTT connection failed'))

      // Mock Secret Manager
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Mock 執行記錄創建（失敗狀態）
      const mockFailedExecutionDoc = {
        id: 'test-failed-execution-id',
        data: () => ({
          configurationId: 'test-config-id',
          timestamp: new Date(),
          status: 'error',
          articlesFound: 0,
          articlesSent: 0,
          executionTime: 500,
          errorMessage: 'PTT connection failed',
        }),
        exists: true,
      }

      mockFirestore.get.mockResolvedValue({
        docs: [mockFailedExecutionDoc],
        forEach: (callback: any) => {
          callback(mockFailedExecutionDoc)
        },
      })

      // 檢查執行歷史包含錯誤記錄
      const { req: historyReq, res: historyRes } = createMocks({
        method: 'GET',
        query: { configId: 'test-config-id' },
      })

      await executionsHandler(historyReq, historyRes)

      expect(historyRes._getStatusCode()).toBe(200)
      const historyData = JSON.parse(historyRes._getData())
      expect(historyData.success).toBe(true)
      expect(historyData.data.executions[0].status).toBe('error')
      expect(historyData.data.executions[0].errorMessage).toBe('PTT connection failed')
    })

    it('應該處理 Telegram 發送失敗的情況', async () => {
      // Mock 成功的 PTT 爬取
      const mockPttResponse = `
        <html>
          <body>
            <div class="r-ent">
              <div class="title">
                <a href="/bbs/Gossiping/M.1234567890.A.123.html">測試文章標題</a>
              </div>
              <div class="meta">
                <div class="author">testuser</div>
                <div class="date">12/01</div>
              </div>
            </div>
          </body>
        </html>
      `

      mockCloudScraper.get.mockResolvedValue({
        body: mockPttResponse,
        statusCode: 200,
      })

      // Mock Secret Manager
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Mock 部分成功的執行記錄（找到文章但發送失敗）
      const mockPartialExecutionDoc = {
        id: 'test-partial-execution-id',
        data: () => ({
          configurationId: 'test-config-id',
          timestamp: new Date(),
          status: 'partial',
          articlesFound: 1,
          articlesSent: 0,
          executionTime: 1500,
          errorMessage: 'Telegram delivery failed',
          details: {
            scrapingDuration: 1000,
            telegramDeliveryDuration: 500,
            articles: [
              {
                title: '測試文章標題',
                author: 'testuser',
                url: 'https://ptt.cc/bbs/Gossiping/M.1234567890.A.123.html',
                sent: false,
                error: 'Telegram API rate limit exceeded',
              },
            ],
          },
        }),
        exists: true,
      }

      mockFirestore.get.mockResolvedValue({
        docs: [mockPartialExecutionDoc],
        forEach: (callback: any) => {
          callback(mockPartialExecutionDoc)
        },
      })

      // 檢查執行歷史包含部分成功記錄
      const { req: historyReq, res: historyRes } = createMocks({
        method: 'GET',
        query: { configId: 'test-config-id' },
      })

      await executionsHandler(historyReq, historyRes)

      expect(historyRes._getStatusCode()).toBe(200)
      const historyData = JSON.parse(historyRes._getData())
      expect(historyData.success).toBe(true)
      expect(historyData.data.executions[0].status).toBe('partial')
      expect(historyData.data.executions[0].articlesFound).toBe(1)
      expect(historyData.data.executions[0].articlesSent).toBe(0)
    })
  })

  describe('多配置並發執行測試', () => {
    it('應該能夠處理多個配置的並發執行', async () => {
      const configurations = [
        {
          id: 'config-1',
          name: 'Config 1',
          pttBoard: 'Gossiping',
          keywords: ['新聞'],
        },
        {
          id: 'config-2',
          name: 'Config 2',
          pttBoard: 'Tech_Job',
          keywords: ['工作'],
        },
        {
          id: 'config-3',
          name: 'Config 3',
          pttBoard: 'Stock',
          keywords: ['股票'],
        },
      ]

      // Mock 多個配置的執行記錄
      const mockExecutions = configurations.map((config, index) => ({
        id: `execution-${index + 1}`,
        data: () => ({
          configurationId: config.id,
          configurationName: config.name,
          timestamp: new Date(Date.now() - index * 60000), // 每分鐘一個
          status: index % 2 === 0 ? 'success' : 'error',
          articlesFound: index + 1,
          articlesSent: index % 2 === 0 ? index + 1 : 0,
          executionTime: 1000 + index * 500,
        }),
        exists: true,
      }))

      mockFirestore.get.mockResolvedValue({
        docs: mockExecutions,
        forEach: (callback: any) => {
          mockExecutions.forEach(callback)
        },
      })

      // 測試並發執行歷史查詢
      const historyPromises = configurations.map(async (config) => {
        const { req, res } = createMocks({
          method: 'GET',
          query: { configId: config.id },
        })

        await executionsHandler(req, res)
        return JSON.parse(res._getData())
      })

      const results = await Promise.all(historyPromises)

      // 驗證所有查詢都成功
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.data.executions).toBeDefined()
      })
    })
  })

  describe('錯誤恢復和重試測試', () => {
    it('應該在暫時性錯誤後重試成功', async () => {
      // Mock 第一次失敗，第二次成功的 PTT 爬取
      mockCloudScraper.get
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          body: '<html><body><div class="r-ent"><div class="title"><a href="/test">Test Article</a></div></div></body></html>',
          statusCode: 200,
        })

      // Mock Secret Manager
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Mock 重試後成功的執行記錄
      const mockRetrySuccessDoc = {
        id: 'test-retry-success-id',
        data: () => ({
          configurationId: 'test-config-id',
          timestamp: new Date(),
          status: 'success',
          articlesFound: 1,
          articlesSent: 1,
          executionTime: 3000, // 較長的執行時間（包含重試）
        }),
        exists: true,
      }

      mockFirestore.get.mockResolvedValue({
        docs: [mockRetrySuccessDoc],
        forEach: (callback: any) => {
          callback(mockRetrySuccessDoc)
        },
      })

      const { req: historyReq, res: historyRes } = createMocks({
        method: 'GET',
        query: { configId: 'test-config-id' },
      })

      await executionsHandler(historyReq, historyRes)

      expect(historyRes._getStatusCode()).toBe(200)
      const historyData = JSON.parse(historyRes._getData())
      expect(historyData.success).toBe(true)
      expect(historyData.data.executions[0].status).toBe('success')
      expect(historyData.data.executions[0].executionTime).toBeGreaterThan(2000)
    })
  })

  describe('資料完整性測試', () => {
    it('應該確保執行記錄的資料完整性', async () => {
      const mockCompleteExecutionDoc = {
        id: 'test-complete-execution-id',
        data: () => ({
          configurationId: 'test-config-id',
          configurationName: 'Complete Test Config',
          timestamp: new Date(),
          status: 'success',
          articlesFound: 3,
          articlesSent: 3,
          executionTime: 2500,
          pttBoard: 'Gossiping',
          keywords: ['測試', '新聞'],
          telegramChatId: '123456789',
          details: {
            scrapingDuration: 1500,
            telegramDeliveryDuration: 1000,
            articles: [
              {
                title: '測試文章 1',
                author: 'user1',
                url: 'https://ptt.cc/test1',
                sent: true,
              },
              {
                title: '測試文章 2',
                author: 'user2',
                url: 'https://ptt.cc/test2',
                sent: true,
              },
              {
                title: '測試文章 3',
                author: 'user3',
                url: 'https://ptt.cc/test3',
                sent: true,
              },
            ],
          },
        }),
        exists: true,
      }

      mockFirestore.get.mockResolvedValue({
        docs: [mockCompleteExecutionDoc],
        forEach: (callback: any) => {
          callback(mockCompleteExecutionDoc)
        },
      })

      const { req: historyReq, res: historyRes } = createMocks({
        method: 'GET',
        query: { configId: 'test-config-id' },
      })

      await executionsHandler(historyReq, historyRes)

      expect(historyRes._getStatusCode()).toBe(200)
      const historyData = JSON.parse(historyRes._getData())
      const execution = historyData.data.executions[0]

      // 驗證所有必要欄位都存在
      expect(execution.id).toBeDefined()
      expect(execution.configurationId).toBe('test-config-id')
      expect(execution.configurationName).toBe('Complete Test Config')
      expect(execution.timestamp).toBeDefined()
      expect(execution.status).toBe('success')
      expect(execution.articlesFound).toBe(3)
      expect(execution.articlesSent).toBe(3)
      expect(execution.executionTime).toBe(2500)
      expect(execution.pttBoard).toBe('Gossiping')
      expect(execution.keywords).toEqual(['測試', '新聞'])
      expect(execution.telegramChatId).toBe('123456789')

      // 驗證詳細資訊
      expect(execution.details).toBeDefined()
      expect(execution.details.scrapingDuration).toBe(1500)
      expect(execution.details.telegramDeliveryDuration).toBe(1000)
      expect(execution.details.articles).toHaveLength(3)
      
      execution.details.articles.forEach((article: any, index: number) => {
        expect(article.title).toBe(`測試文章 ${index + 1}`)
        expect(article.author).toBe(`user${index + 1}`)
        expect(article.url).toBe(`https://ptt.cc/test${index + 1}`)
        expect(article.sent).toBe(true)
      })
    })
  })
})