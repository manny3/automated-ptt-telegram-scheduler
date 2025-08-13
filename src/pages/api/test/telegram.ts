/**
 * Telegram 發送測試 API 端點
 * 僅用於本地開發和測試
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError } from '@/lib/api-error-handler'

interface TelegramTestRequest {
  chatId: string
  message: string
  testMode?: boolean
}

async function telegramTestHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只在開發環境中允許
  if (process.env.NODE_ENV === 'production') {
    throw new BadRequestError('Test endpoints are not available in production')
  }

  const { chatId, message, testMode = true }: TelegramTestRequest = req.body

  // 驗證參數
  if (!chatId || !message) {
    throw new BadRequestError('Missing required parameters: chatId, message')
  }

  try {
    if (testMode) {
      // 模擬 Telegram 發送
      console.log(`[MOCK TELEGRAM] 發送訊息到 ${chatId}:`)
      console.log(`內容: ${message}`)
      
      // 模擬網路延遲
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))

      const mockResponse = {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 1000000),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: 'PTT Scheduler Bot',
            username: 'ptt_scheduler_bot',
          },
          chat: {
            id: parseInt(chatId),
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: message,
        },
      }

      ;(res as any).success({
        sent: true,
        chatId,
        messageLength: message.length,
        telegramResponse: mockResponse,
        timestamp: new Date().toISOString(),
      }, 'Test message sent successfully (mock mode)')

    } else {
      // 實際發送到 Telegram（需要真實的 Bot Token）
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        throw new BadRequestError('TELEGRAM_BOT_TOKEN environment variable is required for real sending')
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
      const telegramResponse = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })

      const result = await telegramResponse.json()

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`)
      }

      ;(res as any).success({
        sent: true,
        chatId,
        messageLength: message.length,
        telegramResponse: result,
        timestamp: new Date().toISOString(),
      }, 'Test message sent successfully (real mode)')
    }

  } catch (error) {
    throw new Error(`Telegram test failed: ${(error as Error).message}`)
  }
}

export default withMethodValidation(['POST'])(
  withErrorHandler(telegramTestHandler)
)