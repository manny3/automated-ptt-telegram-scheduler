/**
 * PTT 爬取測試 API 端點
 * 僅用於本地開發和測試
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError } from '@/lib/api-error-handler'

interface PTTTestRequest {
  board: string
  keywords: string[]
  postCount: number
}

async function pttScraperTestHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只在開發環境中允許
  if (process.env.NODE_ENV === 'production') {
    throw new BadRequestError('Test endpoints are not available in production')
  }

  const { board, keywords, postCount }: PTTTestRequest = req.body

  // 驗證參數
  if (!board || !keywords || !Array.isArray(keywords) || !postCount) {
    throw new BadRequestError('Missing required parameters: board, keywords, postCount')
  }

  if (postCount < 1 || postCount > 100) {
    throw new BadRequestError('postCount must be between 1 and 100')
  }

  try {
    // 模擬 PTT 爬取邏輯
    const mockArticles = Array.from({ length: Math.min(postCount, 5) }, (_, index) => ({
      title: `[${['新聞', '討論', '問卦'][index % 3]}] 測試文章標題 ${index + 1} - ${keywords[0]}`,
      author: `testuser${index + 1}`,
      url: `https://www.ptt.cc/bbs/${board}/M.${Date.now() + index}.A.${Math.random().toString(36).substring(7)}.html`,
      date: new Date(Date.now() - index * 3600000).toISOString(), // 每篇文章間隔1小時
      content: `這是測試文章內容 ${index + 1}，包含關鍵字：${keywords.join(', ')}`,
      score: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 50),
    }))

    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    const response = {
      success: true,
      board,
      keywords,
      articlesFound: mockArticles.length,
      articles: mockArticles,
      scrapingTime: 500 + Math.random() * 1000,
      timestamp: new Date().toISOString(),
    }

    ;(res as any).success(response, `Successfully scraped ${mockArticles.length} articles from ${board}`)

  } catch (error) {
    throw new Error(`PTT scraping test failed: ${(error as Error).message}`)
  }
}

export default withMethodValidation(['POST'])(
  withErrorHandler(pttScraperTestHandler)
)