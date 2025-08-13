import axios, { AxiosResponse } from 'axios'
import { PTTArticle } from '@/types'

// Telegram API 限制
const TELEGRAM_MESSAGE_MAX_LENGTH = 4096
const TELEGRAM_RATE_LIMIT_DELAY = 1000 // 1 秒
const MAX_ARTICLES_PER_MESSAGE = 5

// 重試配置
const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1 秒
const MAX_DELAY = 10000 // 10 秒

// 測試配置（可以被覆蓋用於測試）
export const TEST_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 10, // 測試時使用更短的延遲
  MAX_DELAY: 100,
}

/**
 * Telegram Bot 錯誤類別
 */
export class TelegramBotError extends Error {
  constructor(
    message: string, 
    public statusCode?: number, 
    public retryable: boolean = true,
    public rateLimited: boolean = false
  ) {
    super(message)
    this.name = 'TelegramBotError'
  }
}

/**
 * 睡眠工具函數
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 計算指數退避延遲時間（加入隨機抖動）
 */
const calculateDelay = (attempt: number, isTest: boolean = false): number => {
  const baseDelay = isTest ? TEST_CONFIG.BASE_DELAY : BASE_DELAY
  const maxDelay = isTest ? TEST_CONFIG.MAX_DELAY : MAX_DELAY
  
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // 加入抖動（±25% 的延遲）
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(delay + jitter, 0)
}

/**
 * 格式化單篇文章為 Telegram 訊息
 */
export function formatArticleForTelegram(article: PTTArticle): string {
  const { title, author, date, link, board } = article
  
  return `📰 **${title}**
👤 作者：${author}
📅 日期：${date}
📋 看板：${board}
🔗 連結：${link}

---`
}

/**
 * 格式化多篇文章為 Telegram 訊息
 */
export function formatArticlesForTelegram(articles: PTTArticle[], boardName: string): string {
  if (articles.length === 0) {
    return `📋 **${boardName}** 看板目前沒有符合條件的文章`
  }

  let message = `📋 **${boardName}** 看板最新文章 (${articles.length} 篇)\n\n`
  
  articles.forEach((article, index) => {
    message += `${index + 1}. **${article.title}**\n`
    message += `   👤 ${article.author} | 📅 ${article.date}\n`
    message += `   🔗 ${article.link}\n\n`
  })
  
  return message.trim()
}

/**
 * 將長訊息分割成多個較短的訊息
 */
export function splitLongMessage(message: string, maxLength: number = TELEGRAM_MESSAGE_MAX_LENGTH): string[] {
  if (message.length <= maxLength) {
    return [message]
  }

  const messages: string[] = []
  const lines = message.split('\n')
  let currentMessage = ''

  for (const line of lines) {
    // 如果加入這一行會超過限制
    if (currentMessage.length + line.length + 1 > maxLength) {
      if (currentMessage.trim()) {
        messages.push(currentMessage.trim())
        currentMessage = ''
      }
      
      // 如果單行就超過限制，需要進一步分割
      if (line.length > maxLength) {
        const chunks = line.match(new RegExp(`.{1,${maxLength - 10}}`, 'g')) || []
        chunks.forEach((chunk, index) => {
          if (index === chunks.length - 1) {
            currentMessage = chunk
          } else {
            messages.push(chunk + '...')
          }
        })
      } else {
        currentMessage = line
      }
    } else {
      currentMessage += (currentMessage ? '\n' : '') + line
    }
  }

  if (currentMessage.trim()) {
    messages.push(currentMessage.trim())
  }

  return messages.length > 0 ? messages : [message.substring(0, maxLength)]
}

/**
 * 將文章陣列分組，避免單一訊息過長
 */
export function groupArticlesForMessages(articles: PTTArticle[], boardName: string): string[] {
  if (articles.length === 0) {
    return [formatArticlesForTelegram([], boardName)]
  }

  const messages: string[] = []
  let currentBatch: PTTArticle[] = []

  for (const article of articles) {
    const testBatch = [...currentBatch, article]
    const testMessage = formatArticlesForTelegram(testBatch, boardName)
    
    // 如果加入這篇文章會讓訊息過長，或者已達到最大文章數
    if (testMessage.length > TELEGRAM_MESSAGE_MAX_LENGTH || testBatch.length > MAX_ARTICLES_PER_MESSAGE) {
      if (currentBatch.length > 0) {
        messages.push(formatArticlesForTelegram(currentBatch, boardName))
        currentBatch = [article]
      } else {
        // 單篇文章就過長的情況
        const longMessage = formatArticlesForTelegram([article], boardName)
        messages.push(...splitLongMessage(longMessage))
      }
    } else {
      currentBatch = testBatch
    }
  }

  if (currentBatch.length > 0) {
    messages.push(formatArticlesForTelegram(currentBatch, boardName))
  }

  return messages
}

/**
 * Telegram Bot API 回應介面
 */
interface TelegramApiResponse {
  ok: boolean
  result?: any
  error_code?: number
  description?: string
  parameters?: {
    retry_after?: number
  }
}

/**
 * Telegram Bot 類別
 */
export class TelegramBotClient {
  private token: string
  private baseUrl: string
  private isTest: boolean

  constructor(token: string, isTest: boolean = false) {
    this.token = token
    this.baseUrl = `https://api.telegram.org/bot${token}`
    this.isTest = isTest
  }

  /**
   * 發送單一訊息（包含重試邏輯）
   */
  async sendMessage(chatId: string, message: string, retries: number = MAX_RETRIES): Promise<void> {
    let lastError: Error

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response: AxiosResponse<TelegramApiResponse> = await axios.post(
          `${this.baseUrl}/sendMessage`,
          {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        )

        if (!response.data.ok) {
          throw new Error(response.data.description || 'Unknown Telegram API error')
        }
        
        console.log(`訊息成功發送到聊天室 ${chatId}`)
        return
      } catch (error: any) {
        lastError = error
        
        // 處理不同類型的錯誤
        if (error.response?.status === 400) {
          // 無效的聊天 ID 或訊息格式錯誤
          throw new TelegramBotError(
            `無效的聊天 ID 或訊息格式：${error.response?.data?.description || error.message}`,
            400,
            false
          )
        }
        
        if (error.response?.status === 403) {
          // Bot 被封鎖或沒有權限
          throw new TelegramBotError(
            `Bot 被封鎖或沒有發送權限：${error.response?.data?.description || error.message}`,
            403,
            false
          )
        }
        
        if (error.response?.status === 429) {
          // 速率限制
          const retryAfter = error.response?.data?.parameters?.retry_after || TELEGRAM_RATE_LIMIT_DELAY / 1000
          console.log(`遇到速率限制，等待 ${retryAfter} 秒後重試...`)
          await sleep(retryAfter * 1000)
          continue // 不計入重試次數
        }

        // 如果這是最後一次嘗試，拋出錯誤
        if (attempt === retries) {
          break
        }

        // 計算延遲並等待重試
        const delay = calculateDelay(attempt, this.isTest)
        console.log(`Telegram 請求失敗 (嘗試 ${attempt + 1}/${retries + 1})，${delay}ms 後重試...`)
        await sleep(delay)
      }
    }

    throw new TelegramBotError(
      `發送訊息失敗，經過 ${retries + 1} 次嘗試：${lastError.message}`,
      lastError.response?.status
    )
  }

  /**
   * 發送文章批次（自動分割長訊息）
   */
  async sendArticleBatch(chatId: string, articles: PTTArticle[], boardName: string): Promise<void> {
    if (!chatId || chatId.trim() === '') {
      throw new TelegramBotError('聊天室 ID 不能為空', undefined, false)
    }

    if (!articles || articles.length === 0) {
      console.log(`看板 ${boardName} 沒有文章需要發送`)
      return
    }

    try {
      console.log(`準備發送 ${articles.length} 篇文章到聊天室 ${chatId}`)
      
      // 將文章分組為多個訊息
      const messages = groupArticlesForMessages(articles, boardName)
      
      console.log(`將發送 ${messages.length} 則訊息`)
      
      // 依序發送每則訊息
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        
        try {
          await this.sendMessage(chatId, message)
          
          // 在訊息之間加入短暫延遲，避免速率限制
          if (i < messages.length - 1) {
            await sleep(TELEGRAM_RATE_LIMIT_DELAY)
          }
        } catch (error) {
          console.error(`發送第 ${i + 1} 則訊息失敗:`, error)
          throw error
        }
      }
      
      console.log(`成功發送所有 ${messages.length} 則訊息`)
    } catch (error: any) {
      if (error instanceof TelegramBotError) {
        throw error
      }
      
      throw new TelegramBotError(`發送文章批次失敗：${error.message}`)
    }
  }

  /**
   * 測試 Bot 連接和聊天室 ID 有效性
   */
  async testConnection(chatId: string): Promise<boolean> {
    try {
      await this.sendMessage(chatId, '🤖 測試訊息：Bot 連接正常！')
      return true
    } catch (error) {
      console.error('Bot 連接測試失敗:', error)
      return false
    }
  }

  /**
   * 取得 Bot 資訊
   */
  async getBotInfo(): Promise<any> {
    try {
      const response: AxiosResponse<TelegramApiResponse> = await axios.get(
        `${this.baseUrl}/getMe`
      )

      if (!response.data.ok) {
        throw new Error(response.data.description || 'Unknown Telegram API error')
      }

      return response.data.result
    } catch (error: any) {
      throw new TelegramBotError(`取得 Bot 資訊失敗：${error.message}`)
    }
  }
}

/**
 * 便利函數：建立 Telegram Bot 實例並發送文章
 */
export async function sendArticlesToTelegram(
  token: string,
  chatId: string,
  articles: PTTArticle[],
  boardName: string
): Promise<void> {
  const bot = new TelegramBotClient(token)
  await bot.sendArticleBatch(chatId, articles, boardName)
}

/**
 * 便利函數：測試 Telegram Bot 設定
 */
export async function testTelegramBot(token: string, chatId: string): Promise<boolean> {
  const bot = new TelegramBotClient(token)
  return bot.testConnection(chatId)
}