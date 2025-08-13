/**
 * 執行歷史 API 端點
 * 
 * 提供特定配置的執行歷史查詢功能
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError, NotFoundError } from '@/lib/api-error-handler'
import { withComprehensiveErrorHandling } from '@/middleware/error-handling'
import { dbWrapper } from '@/lib/database-error-handler'
import { logger } from '@/lib/logger'
import { metricsCollector } from '@/lib/monitoring'
import { db } from '@/lib/firestore'

interface ExecutionHistoryQuery {
  configId: string
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
  status?: 'success' | 'error' | 'partial'
  sortBy?: 'timestamp' | 'articlesFound' | 'articlesSent'
  sortOrder?: 'asc' | 'desc'
}

interface ExecutionRecord {
  id: string
  configurationId: string
  configurationName: string
  timestamp: string
  status: 'success' | 'error' | 'partial'
  articlesFound: number
  articlesSent: number
  errorMessage?: string
  executionTime: number
  pttBoard: string
  keywords: string[]
  telegramChatId: string
  details?: {
    scrapingDuration: number
    telegramDeliveryDuration: number
    articles: Array<{
      title: string
      author: string
      url: string
      sent: boolean
      error?: string
    }>
  }
}

async function executionHistoryHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query: ExecutionHistoryQuery = {
    configId: req.query.configId as string,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    status: req.query.status as 'success' | 'error' | 'partial',
    sortBy: (req.query.sortBy as string) || 'timestamp',
    sortOrder: (req.query.sortOrder as string) || 'desc',
  }

  // 驗證參數
  if (!query.configId) {
    throw new BadRequestError('Configuration ID is required')
  }

  if (query.limit && (query.limit < 1 || query.limit > 100)) {
    throw new BadRequestError('Limit must be between 1 and 100')
  }

  if (query.offset && query.offset < 0) {
    throw new BadRequestError('Offset must be non-negative')
  }

  // 驗證日期格式
  if (query.startDate && isNaN(Date.parse(query.startDate))) {
    throw new BadRequestError('Invalid start date format')
  }

  if (query.endDate && isNaN(Date.parse(query.endDate))) {
    throw new BadRequestError('Invalid end date format')
  }

  await logger.info('Fetching execution history', {
    component: 'execution-history-api',
    action: 'fetch_history',
    configId: query.configId,
    query,
  })

  try {
    // 檢查配置是否存在
    const configExists = await dbWrapper.execute(
      async () => {
        const configDoc = await db.collection('configurations').doc(query.configId).get()
        return configDoc.exists
      },
      'check_configuration_exists',
      'configurations'
    )

    if (!configExists) {
      throw new NotFoundError(`Configuration ${query.configId} not found`)
    }

    // 建立查詢
    let executionsQuery = db.collection('executions')
      .where('configurationId', '==', query.configId)

    // 添加日期過濾
    if (query.startDate) {
      executionsQuery = executionsQuery.where('timestamp', '>=', new Date(query.startDate))
    }

    if (query.endDate) {
      executionsQuery = executionsQuery.where('timestamp', '<=', new Date(query.endDate))
    }

    // 添加狀態過濾
    if (query.status) {
      executionsQuery = executionsQuery.where('status', '==', query.status)
    }

    // 添加排序
    const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc'
    executionsQuery = executionsQuery.orderBy(query.sortBy, sortDirection)

    // 添加分頁
    if (query.offset > 0) {
      executionsQuery = executionsQuery.offset(query.offset)
    }

    executionsQuery = executionsQuery.limit(query.limit)

    // 執行查詢
    const executions = await dbWrapper.execute(
      async () => {
        const snapshot = await executionsQuery.get()
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
        })) as ExecutionRecord[]
      },
      'fetch_executions',
      'executions'
    )

    // 獲取總數（用於分頁）
    const totalCount = await dbWrapper.execute(
      async () => {
        let countQuery = db.collection('executions')
          .where('configurationId', '==', query.configId)

        if (query.startDate) {
          countQuery = countQuery.where('timestamp', '>=', new Date(query.startDate))
        }

        if (query.endDate) {
          countQuery = countQuery.where('timestamp', '<=', new Date(query.endDate))
        }

        if (query.status) {
          countQuery = countQuery.where('status', '==', query.status)
        }

        const countSnapshot = await countQuery.count().get()
        return countSnapshot.data().count
      },
      'count_executions',
      'executions'
    )

    // 計算統計資料
    const stats = {
      totalExecutions: totalCount,
      successCount: executions.filter(e => e.status === 'success').length,
      errorCount: executions.filter(e => e.status === 'error').length,
      partialCount: executions.filter(e => e.status === 'partial').length,
      totalArticlesFound: executions.reduce((sum, e) => sum + (e.articlesFound || 0), 0),
      totalArticlesSent: executions.reduce((sum, e) => sum + (e.articlesSent || 0), 0),
      averageExecutionTime: executions.length > 0 
        ? executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / executions.length 
        : 0,
    }

    // 記錄指標
    metricsCollector.increment('execution_history_requests', 1, {
      configId: query.configId,
      resultCount: executions.length.toString(),
    })

    const response = {
      executions,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: totalCount,
        hasMore: query.offset + executions.length < totalCount,
      },
      stats,
      query: {
        configId: query.configId,
        startDate: query.startDate,
        endDate: query.endDate,
        status: query.status,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    }

    await logger.info('Execution history retrieved successfully', {
      component: 'execution-history-api',
      action: 'fetch_history_success',
      configId: query.configId,
      resultCount: executions.length,
      totalCount,
    })

    ;(res as any).success(response, 'Execution history retrieved successfully')

  } catch (error) {
    await logger.error('Failed to fetch execution history', {
      component: 'execution-history-api',
      action: 'fetch_history_error',
      configId: query.configId,
      query,
    }, error as Error)

    throw error
  }
}

export default withMethodValidation(['GET'])(
  withComprehensiveErrorHandling()(
    withErrorHandler(executionHistoryHandler)
  )
)