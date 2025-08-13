/**
 * 測試資料種子 API 端點
 * 用於在本地開發環境中創建測試資料
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError } from '@/lib/api-error-handler'
import { db } from '@/lib/firestore'

async function seedDataHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只在開發環境中允許
  if (process.env.NODE_ENV === 'production') {
    throw new BadRequestError('Seed data endpoint is not available in production')
  }

  try {
    const now = new Date()
    
    // 創建測試配置
    const testConfigurations = [
      {
        name: '科技新聞監控',
        pttBoard: 'Tech_Job',
        keywords: ['AI', '人工智慧', '機器學習'],
        postCount: 10,
        schedule: {
          type: 'interval',
          intervalMinutes: 60,
        },
        telegramChatId: '123456789',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastExecuted: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2小時前
        lastExecutionStatus: 'success',
      },
      {
        name: '八卦板熱門文章',
        pttBoard: 'Gossiping',
        keywords: ['新聞', '重要'],
        postCount: 15,
        schedule: {
          type: 'daily',
          hour: 9,
          minute: 0,
        },
        telegramChatId: '987654321',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastExecuted: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1天前
        lastExecutionStatus: 'success',
      },
      {
        name: '股票討論追蹤',
        pttBoard: 'Stock',
        keywords: ['台積電', '股價', '財報'],
        postCount: 8,
        schedule: {
          type: 'weekly',
          dayOfWeek: 1, // 週一
          hour: 10,
          minute: 30,
        },
        telegramChatId: '555666777',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const configIds: string[] = []
    
    // 插入配置資料
    for (const config of testConfigurations) {
      const docRef = await db.collection('configurations').add(config)
      configIds.push(docRef.id)
    }

    // 創建測試執行記錄
    const testExecutions = []
    
    for (let i = 0; i < configIds.length; i++) {
      const configId = configIds[i]
      const config = testConfigurations[i]
      
      // 為每個配置創建多個執行記錄
      for (let j = 0; j < 5; j++) {
        const executionTime = new Date(now.getTime() - (j + 1) * 24 * 60 * 60 * 1000) // 每天一個
        const isSuccess = Math.random() > 0.2 // 80% 成功率
        const articlesFound = isSuccess ? Math.floor(Math.random() * config.postCount) + 1 : 0
        const articlesSent = isSuccess ? articlesFound : Math.floor(articlesFound * 0.7)
        
        const execution = {
          configurationId: configId,
          configurationName: config.name,
          timestamp: executionTime,
          status: isSuccess ? (articlesSent === articlesFound ? 'success' : 'partial') : 'error',
          articlesFound,
          articlesSent,
          executionTime: 1000 + Math.random() * 3000, // 1-4秒
          pttBoard: config.pttBoard,
          keywords: config.keywords,
          telegramChatId: config.telegramChatId,
          errorMessage: isSuccess ? null : '模擬錯誤：PTT 連接超時',
          details: isSuccess ? {
            scrapingDuration: 500 + Math.random() * 1500,
            telegramDeliveryDuration: 200 + Math.random() * 800,
            articles: Array.from({ length: articlesFound }, (_, index) => ({
              title: `[測試] 模擬文章標題 ${index + 1}`,
              author: `testuser${index + 1}`,
              url: `https://www.ptt.cc/bbs/${config.pttBoard}/M.${Date.now()}.A.${index}.html`,
              sent: index < articlesSent,
              error: index >= articlesSent ? '發送失敗：速率限制' : undefined,
            })),
          } : undefined,
        }
        
        testExecutions.push(execution)
      }
    }

    // 插入執行記錄
    const executionIds: string[] = []
    for (const execution of testExecutions) {
      const docRef = await db.collection('executions').add(execution)
      executionIds.push(docRef.id)
    }

    const summary = {
      configurationsCreated: configIds.length,
      executionsCreated: executionIds.length,
      configurationIds: configIds,
      executionIds: executionIds.slice(0, 5), // 只顯示前5個
    }

    ;(res as any).success(summary, 'Test data seeded successfully')

  } catch (error) {
    throw new Error(`Failed to seed test data: ${(error as Error).message}`)
  }
}

export default withMethodValidation(['POST'])(
  withErrorHandler(seedDataHandler)
)