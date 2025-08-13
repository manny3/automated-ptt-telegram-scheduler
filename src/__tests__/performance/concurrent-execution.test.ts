/**
 * 效能測試：多配置並發執行和效能基準測試
 * 
 * 測試系統在高負載下的效能表現
 */

import { jest } from '@jest/globals'
import { performance } from 'perf_hooks'

// Mock external dependencies
jest.mock('@google-cloud/firestore')
jest.mock('@google-cloud/secret-manager')
jest.mock('cloudscraper')

describe('效能測試', () => {
  let mockFirestore: any
  let mockSecretManager: any
  let mockCloudScraper: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup performance-optimized mocks
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    }

    mockSecretManager = {
      accessSecretVersion: jest.fn(),
    }

    mockCloudScraper = {
      get: jest.fn(),
    }

    // Apply mocks
    const { Firestore } = require('@google-cloud/firestore')
    Firestore.mockImplementation(() => mockFirestore)

    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')
    SecretManagerServiceClient.mockImplementation(() => mockSecretManager)

    const cloudscraper = require('cloudscraper')
    cloudscraper.mockImplementation(() => mockCloudScraper)
  })

  describe('並發執行效能測試', () => {
    it('應該能夠處理 10 個並發配置執行', async () => {
      const configCount = 10
      const articlesPerConfig = 5

      // Mock fast responses
      mockCloudScraper.get.mockImplementation(() => 
        Promise.resolve({
          body: generateMockPttHtml(articlesPerConfig),
          statusCode: 200,
        })
      )

      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 123 } }),
      })

      mockFirestore.add.mockImplementation(() => 
        Promise.resolve({
          id: `exec-${Date.now()}-${Math.random()}`,
          get: () => Promise.resolve({
            exists: true,
            data: () => ({ status: 'success' }),
          }),
        })
      )

      // 創建並發執行任務
      const startTime = performance.now()
      const concurrentTasks = Array.from({ length: configCount }, (_, index) => 
        simulateConfigurationExecution(`config-${index}`, articlesPerConfig)
      )

      const results = await Promise.all(concurrentTasks)
      const endTime = performance.now()
      const totalDuration = endTime - startTime

      // 效能斷言
      expect(results).toHaveLength(configCount)
      expect(results.every(r => r.success)).toBe(true)
      expect(totalDuration).toBeLessThan(5000) // 應該在 5 秒內完成
      
      // 驗證並發呼叫
      expect(mockCloudScraper.get).toHaveBeenCalledTimes(configCount)
      expect(mockSecretManager.accessSecretVersion).toHaveBeenCalledTimes(configCount)
      expect(global.fetch).toHaveBeenCalledTimes(configCount * articlesPerConfig)
      expect(mockFirestore.add).toHaveBeenCalledTimes(configCount)

      console.log(`並發執行 ${configCount} 個配置耗時: ${totalDuration.toFixed(2)}ms`)
      console.log(`平均每個配置耗時: ${(totalDuration / configCount).toFixed(2)}ms`)
    })

    it('應該能夠處理 50 個並發配置執行', async () => {
      const configCount = 50
      const articlesPerConfig = 3

      // Mock optimized responses
      mockCloudScraper.get.mockImplementation(() => 
        Promise.resolve({
          body: generateMockPttHtml(articlesPerConfig),
          statusCode: 200,
        })
      )

      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 123 } }),
      })

      mockFirestore.add.mockResolvedValue({
        id: 'mock-exec-id',
        get: () => Promise.resolve({
          exists: true,
          data: () => ({ status: 'success' }),
        }),
      })

      // 分批執行以避免過載
      const batchSize = 10
      const batches = []
      for (let i = 0; i < configCount; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, configCount - i) }, (_, index) => 
          simulateConfigurationExecution(`config-${i + index}`, articlesPerConfig)
        )
        batches.push(batch)
      }

      const startTime = performance.now()
      const batchResults = []
      
      for (const batch of batches) {
        const batchResult = await Promise.all(batch)
        batchResults.push(...batchResult)
      }
      
      const endTime = performance.now()
      const totalDuration = endTime - startTime

      // 效能斷言
      expect(batchResults).toHaveLength(configCount)
      expect(batchResults.every(r => r.success)).toBe(true)
      expect(totalDuration).toBeLessThan(15000) // 應該在 15 秒內完成

      console.log(`分批執行 ${configCount} 個配置耗時: ${totalDuration.toFixed(2)}ms`)
      console.log(`平均每個配置耗時: ${(totalDuration / configCount).toFixed(2)}ms`)
    })

    it('應該在部分失敗時保持整體效能', async () => {
      const configCount = 20
      const failureRate = 0.3 // 30% 失敗率

      // Mock 部分失敗的回應
      mockCloudScraper.get.mockImplementation(() => {
        if (Math.random() < failureRate) {
          return Promise.reject(new Error('Simulated PTT failure'))
        }
        return Promise.resolve({
          body: generateMockPttHtml(3),
          statusCode: 200,
        })
      })

      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      global.fetch = jest.fn().mockImplementation(() => {
        if (Math.random() < failureRate) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ ok: false, description: 'Simulated Telegram failure' }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: { message_id: 123 } }),
        })
      })

      mockFirestore.add.mockResolvedValue({
        id: 'mock-exec-id',
        get: () => Promise.resolve({
          exists: true,
          data: () => ({ status: 'partial' }),
        }),
      })

      const startTime = performance.now()
      const concurrentTasks = Array.from({ length: configCount }, (_, index) => 
        simulateConfigurationExecutionWithRetry(`config-${index}`, 3)
      )

      const results = await Promise.allSettled(concurrentTasks)
      const endTime = performance.now()
      const totalDuration = endTime - startTime

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      // 效能斷言
      expect(results).toHaveLength(configCount)
      expect(successCount).toBeGreaterThan(0) // 至少有一些成功
      expect(totalDuration).toBeLessThan(10000) // 即使有失敗也應該在 10 秒內完成

      console.log(`部分失敗情況下執行 ${configCount} 個配置:`)
      console.log(`成功: ${successCount}, 失敗: ${failureCount}`)
      console.log(`總耗時: ${totalDuration.toFixed(2)}ms`)
    })
  })

  describe('記憶體使用效能測試', () => {
    it('應該在大量資料處理時保持合理的記憶體使用', async () => {
      const largeDataSize = 1000
      const articlesPerConfig = 100

      // Mock 大量資料回應
      mockCloudScraper.get.mockResolvedValue({
        body: generateMockPttHtml(articlesPerConfig),
        statusCode: 200,
      })

      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 123 } }),
      })

      // Mock 大量執行記錄
      const mockExecutions = Array.from({ length: largeDataSize }, (_, index) => ({
        id: `exec-${index}`,
        data: () => ({
          configurationId: 'test-config',
          timestamp: new Date(Date.now() - index * 60000),
          status: index % 3 === 0 ? 'success' : index % 3 === 1 ? 'error' : 'partial',
          articlesFound: Math.floor(Math.random() * 10),
          articlesSent: Math.floor(Math.random() * 8),
          executionTime: 1000 + Math.random() * 2000,
        }),
        exists: true,
      }))

      mockFirestore.get.mockResolvedValue({
        docs: mockExecutions,
        forEach: (callback: any) => {
          mockExecutions.forEach(callback)
        },
      })

      const initialMemory = process.memoryUsage()
      const startTime = performance.now()

      // 模擬大量資料處理
      const processedData = mockExecutions.map(exec => {
        const data = exec.data()
        return {
          ...data,
          formattedTimestamp: new Date(data.timestamp).toISOString(),
          statusIcon: data.status === 'success' ? '✅' : data.status === 'error' ? '❌' : '⚠️',
          duration: `${data.executionTime}ms`,
        }
      })

      const endTime = performance.now()
      const finalMemory = process.memoryUsage()
      const processingTime = endTime - startTime

      // 記憶體使用分析
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreasePerItem = memoryIncrease / largeDataSize

      expect(processedData).toHaveLength(largeDataSize)
      expect(processingTime).toBeLessThan(1000) // 應該在 1 秒內處理完成
      expect(memoryIncreasePerItem).toBeLessThan(1024) // 每項資料增加的記憶體應該小於 1KB

      console.log(`處理 ${largeDataSize} 筆資料:`)
      console.log(`處理時間: ${processingTime.toFixed(2)}ms`)
      console.log(`記憶體增加: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log(`每筆資料記憶體增加: ${memoryIncreasePerItem.toFixed(2)} bytes`)
    })
  })

  describe('API 回應時間效能測試', () => {
    it('應該在合理時間內回應執行歷史查詢', async () => {
      const executionCount = 500

      // Mock 大量執行記錄
      const mockExecutions = Array.from({ length: executionCount }, (_, index) => ({
        id: `exec-${index}`,
        data: () => ({
          configurationId: 'perf-test-config',
          timestamp: new Date(Date.now() - index * 60000),
          status: ['success', 'error', 'partial'][index % 3],
          articlesFound: Math.floor(Math.random() * 10),
          articlesSent: Math.floor(Math.random() * 8),
          executionTime: 1000 + Math.random() * 2000,
        }),
        exists: true,
      }))

      mockFirestore.get
        .mockResolvedValueOnce({ exists: true }) // 配置存在檢查
        .mockResolvedValueOnce({ // 執行記錄查詢
          docs: mockExecutions.slice(0, 50), // 分頁限制
          forEach: (callback: any) => {
            mockExecutions.slice(0, 50).forEach(callback)
          },
        })
        .mockResolvedValueOnce({ // 總數查詢
          data: () => ({ count: executionCount }),
        })

      const startTime = performance.now()

      // 模擬 API 查詢處理
      const configExists = await mockFirestore.collection('configurations').doc('perf-test-config').get()
      expect(configExists.exists).toBe(true)

      const executionsSnapshot = await mockFirestore.collection('executions')
        .where('configurationId', '==', 'perf-test-config')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()

      const executions = []
      executionsSnapshot.forEach((doc: any) => {
        executions.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      const countSnapshot = await mockFirestore.collection('executions')
        .where('configurationId', '==', 'perf-test-config')
        .count()
        .get()

      const totalCount = countSnapshot.data().count

      const endTime = performance.now()
      const queryTime = endTime - startTime

      // 效能斷言
      expect(executions).toHaveLength(50)
      expect(totalCount).toBe(executionCount)
      expect(queryTime).toBeLessThan(100) // 應該在 100ms 內完成查詢

      console.log(`查詢 ${executionCount} 筆記錄中的 50 筆耗時: ${queryTime.toFixed(2)}ms`)
    })

    it('應該高效處理複雜篩選查詢', async () => {
      const totalExecutions = 1000
      const filteredExecutions = 100

      // Mock 複雜篩選查詢
      mockFirestore.get
        .mockResolvedValueOnce({ exists: true }) // 配置存在檢查
        .mockResolvedValueOnce({ // 篩選查詢
          docs: Array.from({ length: filteredExecutions }, (_, index) => ({
            id: `filtered-exec-${index}`,
            data: () => ({
              configurationId: 'filter-test-config',
              timestamp: new Date(Date.now() - index * 3600000), // 每小時一個
              status: 'success',
              articlesFound: 5,
              articlesSent: 5,
              executionTime: 2000,
            }),
            exists: true,
          })),
          forEach: (callback: any) => {
            for (let i = 0; i < filteredExecutions; i++) {
              callback({
                id: `filtered-exec-${i}`,
                data: () => ({
                  configurationId: 'filter-test-config',
                  timestamp: new Date(Date.now() - i * 3600000),
                  status: 'success',
                  articlesFound: 5,
                  articlesSent: 5,
                  executionTime: 2000,
                }),
              })
            }
          },
        })
        .mockResolvedValueOnce({ // 篩選總數查詢
          data: () => ({ count: filteredExecutions }),
        })

      const startTime = performance.now()

      // 模擬複雜篩選查詢
      const configExists = await mockFirestore.collection('configurations').doc('filter-test-config').get()
      
      const filteredSnapshot = await mockFirestore.collection('executions')
        .where('configurationId', '==', 'filter-test-config')
        .where('status', '==', 'success')
        .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 3600000)) // 最近 7 天
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()

      const filteredResults = []
      filteredSnapshot.forEach((doc: any) => {
        filteredResults.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      const filteredCountSnapshot = await mockFirestore.collection('executions')
        .where('configurationId', '==', 'filter-test-config')
        .where('status', '==', 'success')
        .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 3600000))
        .count()
        .get()

      const endTime = performance.now()
      const complexQueryTime = endTime - startTime

      // 效能斷言
      expect(configExists.exists).toBe(true)
      expect(filteredResults.length).toBeLessThanOrEqual(50)
      expect(complexQueryTime).toBeLessThan(200) // 複雜查詢應該在 200ms 內完成

      console.log(`複雜篩選查詢耗時: ${complexQueryTime.toFixed(2)}ms`)
      console.log(`篩選結果: ${filteredResults.length} 筆`)
    })
  })

  // 輔助函數
  function generateMockPttHtml(articleCount: number): string {
    const articles = Array.from({ length: articleCount }, (_, index) => `
      <div class="r-ent">
        <div class="title">
          <a href="/bbs/Gossiping/M.170123456${index}.A.12${index}.html">
            [新聞] 效能測試文章 ${index + 1}
          </a>
        </div>
        <div class="meta">
          <div class="author">perfuser${index}</div>
          <div class="date">12/0${(index % 9) + 1}</div>
        </div>
      </div>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="r-list-container">
          ${articles}
        </div>
      </body>
      </html>
    `
  }

  async function simulateConfigurationExecution(configId: string, articleCount: number): Promise<{ success: boolean; duration: number }> {
    const startTime = performance.now()

    try {
      // 1. PTT 爬取
      await mockCloudScraper.get(`https://www.ptt.cc/bbs/Gossiping/index.html`)

      // 2. Secret Manager
      await mockSecretManager.accessSecretVersion({
        name: 'projects/test-project/secrets/telegram-bot-token/versions/latest'
      })

      // 3. Telegram 發送
      for (let i = 0; i < articleCount; i++) {
        await fetch('https://api.telegram.org/bot123456789:token/sendMessage', {
          method: 'POST',
          body: JSON.stringify({ chat_id: '123', text: `Article ${i}` }),
        })
      }

      // 4. 資料庫儲存
      await mockFirestore.collection('executions').add({
        configurationId: configId,
        status: 'success',
        articlesFound: articleCount,
        articlesSent: articleCount,
      })

      const endTime = performance.now()
      return { success: true, duration: endTime - startTime }
    } catch (error) {
      const endTime = performance.now()
      return { success: false, duration: endTime - startTime }
    }
  }

  async function simulateConfigurationExecutionWithRetry(configId: string, articleCount: number, maxRetries: number = 3): Promise<{ success: boolean; duration: number }> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await simulateConfigurationExecution(configId, articleCount)
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries - 1) {
          // 簡短等待後重試
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    throw lastError
  }
})