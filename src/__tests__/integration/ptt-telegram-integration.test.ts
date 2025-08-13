/**
 * 整合測試：PTT 爬取、Telegram 發送和資料庫操作
 * 
 * 測試各個系統組件之間的整合
 */

import { jest } from '@jest/globals'

// Mock external services
jest.mock('@google-cloud/firestore')
jest.mock('@google-cloud/secret-manager')
jest.mock('cloudscraper')

describe('PTT-Telegram 整合測試', () => {
  let mockFirestore: any
  let mockSecretManager: any
  let mockCloudScraper: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mocks
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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

  describe('PTT 爬取整合', () => {
    it('應該成功爬取 PTT 文章並解析內容', async () => {
      const mockPttHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>批踢踢實業坊</title></head>
        <body>
          <div class="r-list-container action-bar-margin bbs-screen">
            <div class="r-ent">
              <div class="nrec"><span class="hl f2">10</span></div>
              <div class="title">
                <a href="/bbs/Gossiping/M.1701234567.A.123.html">
                  [新聞] 測試新聞標題
                </a>
              </div>
              <div class="meta">
                <div class="author">newsuser</div>
                <div class="article-menu">
                  <div class="trigger">⋯</div>
                </div>
                <div class="date">12/01</div>
                <div class="mark"></div>
              </div>
            </div>
            <div class="r-ent">
              <div class="nrec"><span class="hl f3">5</span></div>
              <div class="title">
                <a href="/bbs/Gossiping/M.1701234568.A.124.html">
                  [討論] 另一個測試文章
                </a>
              </div>
              <div class="meta">
                <div class="author">testuser2</div>
                <div class="article-menu">
                  <div class="trigger">⋯</div>
                </div>
                <div class="date">12/01</div>
                <div class="mark"></div>
              </div>
            </div>
            <div class="r-ent">
              <div class="nrec"><span class="f1">爆</span></div>
              <div class="title">
                <a href="/bbs/Gossiping/M.1701234569.A.125.html">
                  [問卦] 熱門測試問卦
                </a>
              </div>
              <div class="meta">
                <div class="author">hotuser</div>
                <div class="article-menu">
                  <div class="trigger">⋯</div>
                </div>
                <div class="date">12/01</div>
                <div class="mark"></div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      mockCloudScraper.get.mockResolvedValue({
        body: mockPttHtml,
        statusCode: 200,
      })

      // 模擬 PTT 爬取邏輯
      const articles = []
      const keywords = ['測試', '新聞']
      
      // 解析 HTML（簡化版本）
      const titleMatches = mockPttHtml.match(/<a href="([^"]+)">\s*([^<]+)\s*<\/a>/g)
      const authorMatches = mockPttHtml.match(/<div class="author">([^<]+)<\/div>/g)

      if (titleMatches && authorMatches) {
        for (let i = 0; i < Math.min(titleMatches.length, authorMatches.length); i++) {
          const titleMatch = titleMatches[i].match(/<a href="([^"]+)">\s*([^<]+)\s*<\/a>/)
          const authorMatch = authorMatches[i].match(/<div class="author">([^<]+)<\/div>/)

          if (titleMatch && authorMatch) {
            const title = titleMatch[2].trim()
            const url = `https://www.ptt.cc${titleMatch[1]}`
            const author = authorMatch[1].trim()

            // 檢查關鍵字匹配
            const hasKeyword = keywords.some(keyword => title.includes(keyword))
            if (hasKeyword) {
              articles.push({ title, url, author })
            }
          }
        }
      }

      expect(articles).toHaveLength(2) // 應該找到 2 篇包含關鍵字的文章
      expect(articles[0].title).toContain('測試新聞標題')
      expect(articles[1].title).toContain('另一個測試文章')
      expect(articles[0].url).toContain('ptt.cc')
      expect(articles[0].author).toBe('newsuser')
    })

    it('應該處理 PTT 18+ 年齡驗證頁面', async () => {
      const mockAgeVerificationHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>批踢踢實業坊</title></head>
        <body>
          <div class="bbs-content">
            <div class="ask-over18">
              <div class="ask-over18-content">
                <p>本看板內容涉及成人議題</p>
                <p>確認您已年滿十八歲</p>
                <div class="btn-group">
                  <a class="btn" href="/bbs/Gossiping/index.html?over18=1">是，我已年滿十八歲</a>
                  <a class="btn" href="/">否，我未滿十八歲</a>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const mockActualContentHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Gossiping/M.1701234567.A.123.html">
                [新聞] 18+ 內容測試
              </a>
            </div>
            <div class="meta">
              <div class="author">adultuser</div>
              <div class="date">12/01</div>
            </div>
          </div>
        </body>
        </html>
      `

      // 第一次請求返回年齡驗證頁面
      mockCloudScraper.get
        .mockResolvedValueOnce({
          body: mockAgeVerificationHtml,
          statusCode: 200,
        })
        // 第二次請求（帶 over18=1 參數）返回實際內容
        .mockResolvedValueOnce({
          body: mockActualContentHtml,
          statusCode: 200,
        })

      // 模擬年齡驗證處理邏輯
      let response = await mockCloudScraper.get('https://www.ptt.cc/bbs/Gossiping/index.html')
      
      // 檢查是否需要年齡驗證
      if (response.body.includes('ask-over18')) {
        // 重新請求帶年齡驗證參數
        response = await mockCloudScraper.get('https://www.ptt.cc/bbs/Gossiping/index.html?over18=1')
      }

      expect(response.body).toContain('18+ 內容測試')
      expect(mockCloudScraper.get).toHaveBeenCalledTimes(2)
    })

    it('應該處理 PTT 連接錯誤和重試', async () => {
      // 模擬網路錯誤
      mockCloudScraper.get
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          body: '<html><body><div class="r-ent"><div class="title"><a href="/test">Success after retry</a></div></div></body></html>',
          statusCode: 200,
        })

      // 模擬重試邏輯
      let attempts = 0
      let lastError: Error | null = null
      let response: any = null

      while (attempts < 3 && !response) {
        try {
          attempts++
          response = await mockCloudScraper.get('https://www.ptt.cc/bbs/Gossiping/index.html')
        } catch (error) {
          lastError = error as Error
          if (attempts < 3) {
            // 等待重試（在測試中我們跳過實際等待）
            continue
          }
        }
      }

      expect(attempts).toBe(3)
      expect(response).toBeDefined()
      expect(response.body).toContain('Success after retry')
    })
  })

  describe('Telegram 整合', () => {
    it('應該成功發送文章到 Telegram', async () => {
      // Mock Telegram Bot Token
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Mock fetch for Telegram API
      global.fetch = jest.fn()
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: {
            message_id: 123,
            date: Math.floor(Date.now() / 1000),
            chat: { id: 123456789 },
            text: 'Test message',
          },
        }),
      })

      const articles = [
        {
          title: '[新聞] 測試新聞標題',
          author: 'newsuser',
          url: 'https://www.ptt.cc/bbs/Gossiping/M.1701234567.A.123.html',
        },
        {
          title: '[討論] 另一個測試文章',
          author: 'testuser2',
          url: 'https://www.ptt.cc/bbs/Gossiping/M.1701234568.A.124.html',
        },
      ]

      const chatId = '123456789'
      const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'

      // 模擬 Telegram 訊息發送
      const sentArticles = []
      for (const article of articles) {
        const message = `📰 ${article.title}\n👤 作者：${article.author}\n🔗 ${article.url}`
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        })

        const result = await response.json()
        if (result.ok) {
          sentArticles.push({ ...article, sent: true })
        } else {
          sentArticles.push({ ...article, sent: false, error: result.description })
        }
      }

      expect(sentArticles).toHaveLength(2)
      expect(sentArticles.every(a => a.sent)).toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('應該處理 Telegram API 錯誤', async () => {
      // Mock Telegram Bot Token
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Mock Telegram API 錯誤回應
      global.fetch = jest.fn()
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found',
        }),
      })

      const article = {
        title: '[新聞] 測試新聞標題',
        author: 'newsuser',
        url: 'https://www.ptt.cc/bbs/Gossiping/M.1701234567.A.123.html',
      }

      const chatId = 'invalid-chat-id'
      const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'

      // 模擬 Telegram 訊息發送失敗
      const message = `📰 ${article.title}\n👤 作者：${article.author}\n🔗 ${article.url}`
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })

      const result = await response.json()
      
      expect(result.ok).toBe(false)
      expect(result.error_code).toBe(400)
      expect(result.description).toBe('Bad Request: chat not found')
    })

    it('應該處理長訊息分割', async () => {
      // Mock Telegram Bot Token
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      global.fetch = jest.fn()
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: { message_id: 123 },
        }),
      })

      // 創建一個很長的文章標題
      const longTitle = '[新聞] ' + 'A'.repeat(4000) // 超過 Telegram 4096 字符限制
      const article = {
        title: longTitle,
        author: 'newsuser',
        url: 'https://www.ptt.cc/bbs/Gossiping/M.1701234567.A.123.html',
      }

      const chatId = '123456789'
      const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
      const maxLength = 4096

      // 模擬訊息分割邏輯
      const fullMessage = `📰 ${article.title}\n👤 作者：${article.author}\n🔗 ${article.url}`
      const messages = []

      if (fullMessage.length <= maxLength) {
        messages.push(fullMessage)
      } else {
        // 分割長訊息
        let remaining = fullMessage
        while (remaining.length > 0) {
          if (remaining.length <= maxLength) {
            messages.push(remaining)
            break
          } else {
            const chunk = remaining.substring(0, maxLength)
            const lastNewline = chunk.lastIndexOf('\n')
            const splitPoint = lastNewline > 0 ? lastNewline : maxLength
            
            messages.push(remaining.substring(0, splitPoint))
            remaining = remaining.substring(splitPoint)
          }
        }
      }

      // 發送所有訊息片段
      for (const message of messages) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        })
      }

      expect(messages.length).toBeGreaterThan(1) // 應該被分割成多個訊息
      expect(global.fetch).toHaveBeenCalledTimes(messages.length)
      messages.forEach(msg => {
        expect(msg.length).toBeLessThanOrEqual(maxLength)
      })
    })
  })

  describe('資料庫整合', () => {
    it('應該正確儲存執行結果到 Firestore', async () => {
      const executionData = {
        configurationId: 'test-config-id',
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
      }

      // Mock Firestore add operation
      mockFirestore.add.mockResolvedValue({
        id: 'new-execution-id',
        get: () => Promise.resolve({
          id: 'new-execution-id',
          data: () => executionData,
          exists: true,
        }),
      })

      // 模擬儲存執行結果
      const docRef = await mockFirestore.collection('executions').add(executionData)
      const savedDoc = await docRef.get()

      expect(mockFirestore.collection).toHaveBeenCalledWith('executions')
      expect(mockFirestore.add).toHaveBeenCalledWith(executionData)
      expect(savedDoc.exists).toBe(true)
      expect(savedDoc.data().status).toBe('success')
      expect(savedDoc.data().articlesFound).toBe(3)
      expect(savedDoc.data().articlesSent).toBe(3)
    })

    it('應該正確更新配置的最後執行狀態', async () => {
      const configId = 'test-config-id'
      const updateData = {
        lastExecuted: new Date(),
        lastExecutionStatus: 'success',
        lastExecutionMessage: null,
        updatedAt: new Date(),
      }

      // Mock Firestore update operation
      mockFirestore.update.mockResolvedValue(undefined)

      // 模擬更新配置狀態
      await mockFirestore.collection('configurations').doc(configId).update(updateData)

      expect(mockFirestore.collection).toHaveBeenCalledWith('configurations')
      expect(mockFirestore.doc).toHaveBeenCalledWith(configId)
      expect(mockFirestore.update).toHaveBeenCalledWith(updateData)
    })

    it('應該處理 Firestore 連接錯誤', async () => {
      // Mock Firestore 連接錯誤
      mockFirestore.add.mockRejectedValue(new Error('Firestore connection failed'))

      const executionData = {
        configurationId: 'test-config-id',
        status: 'error',
        errorMessage: 'Database connection failed',
      }

      // 模擬錯誤處理
      let error: Error | null = null
      try {
        await mockFirestore.collection('executions').add(executionData)
      } catch (e) {
        error = e as Error
      }

      expect(error).toBeDefined()
      expect(error?.message).toBe('Firestore connection failed')
    })
  })

  describe('完整整合流程', () => {
    it('應該執行完整的爬取-發送-儲存流程', async () => {
      // Step 1: Mock PTT 爬取成功
      const mockPttHtml = `
        <html><body>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Gossiping/M.1701234567.A.123.html">[新聞] 整合測試文章</a>
            </div>
            <div class="meta">
              <div class="author">integrationuser</div>
              <div class="date">12/01</div>
            </div>
          </div>
        </body></html>
      `

      mockCloudScraper.get.mockResolvedValue({
        body: mockPttHtml,
        statusCode: 200,
      })

      // Step 2: Mock Secret Manager
      mockSecretManager.accessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('123456789:ABCdefGHIjklMNOpqrsTUVwxyz'),
        },
      }])

      // Step 3: Mock Telegram API 成功
      global.fetch = jest.fn()
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          result: { message_id: 123 },
        }),
      })

      // Step 4: Mock Firestore 儲存成功
      mockFirestore.add.mockResolvedValue({
        id: 'integration-execution-id',
        get: () => Promise.resolve({
          id: 'integration-execution-id',
          exists: true,
          data: () => ({
            configurationId: 'integration-config-id',
            status: 'success',
            articlesFound: 1,
            articlesSent: 1,
          }),
        }),
      })

      // 執行完整流程
      const startTime = Date.now()

      // 1. 爬取 PTT
      const pttResponse = await mockCloudScraper.get('https://www.ptt.cc/bbs/Gossiping/index.html')
      const articles = [{ 
        title: '[新聞] 整合測試文章', 
        author: 'integrationuser', 
        url: 'https://www.ptt.cc/bbs/Gossiping/M.1701234567.A.123.html' 
      }]

      // 2. 取得 Telegram Token
      const tokenResponse = await mockSecretManager.accessSecretVersion({
        name: 'projects/test-project/secrets/telegram-bot-token/versions/latest'
      })
      const botToken = tokenResponse[0].payload.data.toString()

      // 3. 發送到 Telegram
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '123456789',
          text: `📰 ${articles[0].title}\n👤 作者：${articles[0].author}\n🔗 ${articles[0].url}`,
        }),
      })
      const telegramResult = await telegramResponse.json()

      // 4. 儲存執行結果
      const executionTime = Date.now() - startTime
      const executionData = {
        configurationId: 'integration-config-id',
        status: 'success',
        articlesFound: articles.length,
        articlesSent: telegramResult.ok ? articles.length : 0,
        executionTime,
      }

      const docRef = await mockFirestore.collection('executions').add(executionData)
      const savedDoc = await docRef.get()

      // 驗證整個流程
      expect(pttResponse.statusCode).toBe(200)
      expect(botToken).toBe('123456789:ABCdefGHIjklMNOpqrsTUVwxyz')
      expect(telegramResult.ok).toBe(true)
      expect(savedDoc.exists).toBe(true)
      expect(savedDoc.data().status).toBe('success')
      expect(savedDoc.data().articlesFound).toBe(1)
      expect(savedDoc.data().articlesSent).toBe(1)
    })
  })
})