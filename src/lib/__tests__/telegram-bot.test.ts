import axios from 'axios'
import {
  TelegramBotClient,
  TelegramBotError,
  formatArticleForTelegram,
  formatArticlesForTelegram,
  splitLongMessage,
  groupArticlesForMessages,
  sendArticlesToTelegram,
  testTelegramBot
} from '../telegram-bot'
import { PTTArticle } from '@/types'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Telegram Bot Integration', () => {
  let telegramClient: TelegramBotClient

  const mockArticles: PTTArticle[] = [
    {
      title: '[徵才] Python 後端工程師',
      author: 'testuser1',
      date: '12/25',
      link: 'https://www.ptt.cc/bbs/Tech_Job/M.1234567890.A.123.html',
      board: 'Tech_Job'
    },
    {
      title: '[心得] 面試經驗分享',
      author: 'testuser2',
      date: '12/24',
      link: 'https://www.ptt.cc/bbs/Tech_Job/M.1234567891.A.124.html',
      board: 'Tech_Job'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    telegramClient = new TelegramBotClient('test-token', true) // 使用測試模式
  })

  describe('formatArticleForTelegram', () => {
    it('應該正確格式化單篇文章', () => {
      const article = mockArticles[0]
      const formatted = formatArticleForTelegram(article)

      expect(formatted).toContain('📰 **[徵才] Python 後端工程師**')
      expect(formatted).toContain('👤 作者：testuser1')
      expect(formatted).toContain('📅 日期：12/25')
      expect(formatted).toContain('📋 看板：Tech_Job')
      expect(formatted).toContain('🔗 連結：https://www.ptt.cc/bbs/Tech_Job/M.1234567890.A.123.html')
    })
  })

  describe('formatArticlesForTelegram', () => {
    it('應該正確格式化多篇文章', () => {
      const formatted = formatArticlesForTelegram(mockArticles, 'Tech_Job')

      expect(formatted).toContain('📋 **Tech_Job** 看板最新文章 (2 篇)')
      expect(formatted).toContain('1. **[徵才] Python 後端工程師**')
      expect(formatted).toContain('2. **[心得] 面試經驗分享**')
      expect(formatted).toContain('👤 testuser1 | 📅 12/25')
      expect(formatted).toContain('👤 testuser2 | 📅 12/24')
    })

    it('應該處理空文章陣列', () => {
      const formatted = formatArticlesForTelegram([], 'Tech_Job')

      expect(formatted).toBe('📋 **Tech_Job** 看板目前沒有符合條件的文章')
    })
  })

  describe('splitLongMessage', () => {
    it('應該保持短訊息不變', () => {
      const shortMessage = '這是一則短訊息'
      const result = splitLongMessage(shortMessage, 100)

      expect(result).toEqual([shortMessage])
    })

    it('應該分割長訊息', () => {
      const longMessage = 'A'.repeat(5000)
      const result = splitLongMessage(longMessage, 4096)

      expect(result.length).toBeGreaterThan(1)
      expect(result[0].length).toBeLessThanOrEqual(4096)
    })

    it('應該按行分割訊息', () => {
      const message = 'Line 1\n' + 'B'.repeat(4090) + '\nLine 3'
      const result = splitLongMessage(message, 4096)

      expect(result.length).toBeGreaterThan(1)
      result.forEach(msg => {
        expect(msg.length).toBeLessThanOrEqual(4096)
      })
    })
  })

  describe('groupArticlesForMessages', () => {
    it('應該將文章分組為適當大小的訊息', () => {
      const manyArticles = Array.from({ length: 10 }, (_, i) => ({
        ...mockArticles[0],
        title: `[徵才] 工程師職位 ${i + 1}`,
        author: `user${i + 1}`
      }))

      const messages = groupArticlesForMessages(manyArticles, 'Tech_Job')

      expect(messages.length).toBeGreaterThan(1)
      messages.forEach(message => {
        expect(message.length).toBeLessThanOrEqual(4096)
      })
    })

    it('應該處理空文章陣列', () => {
      const messages = groupArticlesForMessages([], 'Tech_Job')

      expect(messages).toEqual(['📋 **Tech_Job** 看板目前沒有符合條件的文章'])
    })
  })

  describe('TelegramBotClient', () => {
    describe('sendMessage', () => {
      it('應該成功發送訊息', async () => {
        mockedAxios.post.mockResolvedValueOnce({
          data: { ok: true, result: {} }
        })

        await telegramClient.sendMessage('123456789', '測試訊息')

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-token/sendMessage',
          {
            chat_id: '123456789',
            text: '測試訊息',
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        )
      })

      it('應該處理無效聊天 ID 錯誤', async () => {
        const error = {
          response: { 
            status: 400,
            data: { description: 'Bad Request: chat not found' }
          },
          message: 'Bad Request: chat not found'
        }
        mockedAxios.post.mockRejectedValueOnce(error)

        await expect(telegramClient.sendMessage('invalid', '測試訊息'))
          .rejects.toThrow('無效的聊天 ID 或訊息格式')
      })

      it('應該處理 Bot 被封鎖錯誤', async () => {
        const error = {
          response: { 
            status: 403,
            data: { description: 'Forbidden: bot was blocked by the user' }
          },
          message: 'Forbidden: bot was blocked by the user'
        }
        mockedAxios.post.mockRejectedValueOnce(error)

        await expect(telegramClient.sendMessage('123456789', '測試訊息'))
          .rejects.toThrow('Bot 被封鎖或沒有發送權限')
      })

      it('應該處理速率限制', async () => {
        const rateLimitError = {
          response: { 
            status: 429,
            data: { 
              description: 'Too Many Requests',
              parameters: { retry_after: 1 }
            }
          },
          message: 'Too Many Requests'
        }
        
        mockedAxios.post
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce({ data: { ok: true, result: {} } })

        await telegramClient.sendMessage('123456789', '測試訊息')

        expect(mockedAxios.post).toHaveBeenCalledTimes(2)
      })

      it('應該在網路錯誤時重試', async () => {
        mockedAxios.post
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ data: { ok: true, result: {} } })

        await telegramClient.sendMessage('123456789', '測試訊息')

        expect(mockedAxios.post).toHaveBeenCalledTimes(3)
      })

      it('應該在達到最大重試次數後失敗', async () => {
        mockedAxios.post.mockRejectedValue(new Error('Network error'))

        await expect(telegramClient.sendMessage('123456789', '測試訊息'))
          .rejects.toThrow('發送訊息失敗，經過')
      })
    })

    describe('sendArticleBatch', () => {
      it('應該成功發送文章批次', async () => {
        mockedAxios.post.mockResolvedValue({ data: { ok: true, result: {} } })

        await telegramClient.sendArticleBatch('123456789', mockArticles, 'Tech_Job')

        expect(mockedAxios.post).toHaveBeenCalledTimes(1)
        const [url, payload] = mockedAxios.post.mock.calls[0]
        expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage')
        expect(payload.chat_id).toBe('123456789')
        expect(payload.text).toContain('📋 **Tech_Job** 看板最新文章')
      })

      it('應該處理空聊天 ID', async () => {
        await expect(telegramClient.sendArticleBatch('', mockArticles, 'Tech_Job'))
          .rejects.toThrow('聊天室 ID 不能為空')
      })

      it('應該處理空文章陣列', async () => {
        await telegramClient.sendArticleBatch('123456789', [], 'Tech_Job')

        expect(mockedAxios.post).not.toHaveBeenCalled()
      })

      it('應該分割大量文章為多則訊息', async () => {
        const manyArticles = Array.from({ length: 10 }, (_, i) => ({
          ...mockArticles[0],
          title: `[徵才] 很長的職位標題 ${i + 1}`.repeat(10),
          author: `user${i + 1}`
        }))

        mockedAxios.post.mockResolvedValue({ data: { ok: true, result: {} } })

        await telegramClient.sendArticleBatch('123456789', manyArticles, 'Tech_Job')

        // 應該分割為多則訊息，但不一定是每篇文章一則訊息
        expect(mockedAxios.post).toHaveBeenCalledTimes(2)
      })
    })

    describe('testConnection', () => {
      it('應該在連接成功時返回 true', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } })

        const result = await telegramClient.testConnection('123456789')

        expect(result).toBe(true)
        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-token/sendMessage',
          expect.objectContaining({
            chat_id: '123456789',
            text: '🤖 測試訊息：Bot 連接正常！'
          })
        )
      })

      it('應該在連接失敗時返回 false', async () => {
        mockedAxios.post.mockRejectedValue(new Error('Connection failed'))

        const result = await telegramClient.testConnection('123456789')

        expect(result).toBe(false)
      })
    })

    describe('getBotInfo', () => {
      it('應該返回 Bot 資訊', async () => {
        const botInfo = { id: 123456789, username: 'test_bot' }
        mockedAxios.get.mockResolvedValueOnce({ 
          data: { ok: true, result: botInfo } 
        })

        const result = await telegramClient.getBotInfo()

        expect(result).toEqual(botInfo)
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-token/getMe'
        )
      })

      it('應該處理取得 Bot 資訊失敗', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('API error'))

        await expect(telegramClient.getBotInfo())
          .rejects.toThrow('取得 Bot 資訊失敗')
      })
    })
  })

  describe('便利函數', () => {
    describe('sendArticlesToTelegram', () => {
      it('應該建立 Bot 實例並發送文章', async () => {
        mockedAxios.post.mockResolvedValue({ data: { ok: true, result: {} } })

        await sendArticlesToTelegram('test-token', '123456789', mockArticles, 'Tech_Job')

        expect(mockedAxios.post).toHaveBeenCalled()
        const [url, payload] = mockedAxios.post.mock.calls[0]
        expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage')
        expect(payload.chat_id).toBe('123456789')
      })
    })

    describe('testTelegramBot', () => {
      it('應該測試 Bot 連接', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } })

        const result = await testTelegramBot('test-token', '123456789')

        expect(result).toBe(true)
        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-token/sendMessage',
          expect.objectContaining({
            chat_id: '123456789',
            text: '🤖 測試訊息：Bot 連接正常！'
          })
        )
      })
    })
  })

  describe('TelegramBotError', () => {
    it('應該建立具有正確屬性的錯誤', () => {
      const error = new TelegramBotError('測試錯誤', 400, false, true)

      expect(error.message).toBe('測試錯誤')
      expect(error.statusCode).toBe(400)
      expect(error.retryable).toBe(false)
      expect(error.rateLimited).toBe(true)
      expect(error.name).toBe('TelegramBotError')
    })

    it('應該預設 retryable 為 true', () => {
      const error = new TelegramBotError('測試錯誤')

      expect(error.retryable).toBe(true)
      expect(error.rateLimited).toBe(false)
    })
  })
})