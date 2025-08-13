/**
 * 執行歷史總覽 API 端點
 * 
 * 提供所有配置的執行歷史總覽和統計資料
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError } from '@/lib/api-error-handler'
import { withComprehensiveErrorHandling } from '@/middleware/error-handling'
import { dbWrapper } from '@/lib/database-error-handler'
import { logger } from '@/lib/logger'
import { metricsCollector } from '@/lib/monitoring'
import { db } from '@/lib/firestore'

interface ExecutionOverviewQuery {
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
  status?: 'success' | 'error' | 'partial'
  configurationId?: string
}

interface ExecutionSummary {
  id: string
  configurationId: string
  configurationName: string
  timestamp: string
  status: 'success' | 'error' | 'partial'
  articlesFound: number
  articlesSent: number
  executionTime: number
  errorMessage?: string
}

interface ConfigurationStats {
  configurationId: string
  configurationName: string
  totalExecutions: number
  successCount: number
  errorCount: number
  partialCount: number
  lastExecution?: string
  averageArticlesFound: number
  averageArticlesSent: number
  successRate: number
}

async function executionOverviewHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query: ExecutionOverviewQuery = {
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    status: req.query.status as 'success' | 'error' | 'partial',
    configurationId: req.query.configurationId as string,
  }

  // 驗證參數
  if (query.limit && (query.limit < 1 || query.limit > 100)) {
    throw new BadRequestError('Limit must be between 1 and 100')
  }

  if (query.offset && query.offset < 0) {
    throw new BadRequestError('Offset must be non-negative')
  }

  await logger.info('Fetching execution overview', {
    component: 'execution-overview-api',
    action: 'fetch_overview',
    query,
  })

  try {
    // 建立基本查詢
    let executionsQuery = db.collection('executions')

    // 添加過濾條件
    if (query.configurationId) {
      executionsQuery = executionsQuery.where('configurationId', '==', query.configurationId)
    }

    if (query.startDate) {
      executionsQuery = executionsQuery.where('timestamp', '>=', new Date(query.startDate))
    }

    if (query.endDate) {
      executionsQuery = executionsQuery.where('timestamp', '<=', new Date(query.endDate))
    }

    if (query.status) {
      executionsQuery = executionsQuery.where('status', '==', query.status)
    }

    // 排序和分頁
    executionsQuery = executionsQuery
      .orderBy('timestamp', 'desc')
      .offset(query.offset)
      .limit(query.limit)

    // 獲取最近的執行記錄
    const recentExecutions = await dbWrapper.execute(
      async () => {
        const snapshot = await executionsQuery.get()
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
        })) as ExecutionSummary[]
      },
      'fetch_recent_executions',
      'executions'
    )

    // 獲取配置統計資料
    const configurationStats = await dbWrapper.execute(
      async () => {
        // 獲取所有配置
        const configurationsSnapshot = await db.collection('configurations').get()
        const configurations = configurationsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
        }))

        const stats: ConfigurationStats[] = []

        for (const config of configurations) {
          // 獲取該配置的執行統計
          let configExecutionsQuery = db.collection('executions')
            .where('configurationId', '==', config.id)

          if (query.startDate) {
            configExecutionsQuery = configExecutionsQuery.where('timestamp', '>=', new Date(query.startDate))
          }

          if (query.endDate) {
            configExecutionsQuery = configExecutionsQuery.where('timestamp', '<=', new Date(query.endDate))
          }

          const configExecutionsSnapshot = await configExecutionsQuery.get()
          const configExecutions = configExecutionsSnapshot.docs.map(doc => doc.data())

          if (configExecutions.length > 0) {
            const successCount = configExecutions.filter(e => e.status === 'success').length
            const errorCount = configExecutions.filter(e => e.status === 'error').length
            const partialCount = configExecutions.filter(e => e.status === 'partial').length

            stats.push({
              configurationId: config.id,
              configurationName: config.name,
              totalExecutions: configExecutions.length,
              successCount,
              errorCount,
              partialCount,
              lastExecution: configExecutions
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
                ?.timestamp?.toDate?.()?.toISOString() || configExecutions[0].timestamp,
              averageArticlesFound: configExecutions.reduce((sum, e) => sum + (e.articlesFound || 0), 0) / configExecutions.length,
              averageArticlesSent: configExecutions.reduce((sum, e) => sum + (e.articlesSent || 0), 0) / configExecutions.length,
              successRate: (successCount / configExecutions.length) * 100,
            })
          }
        }

        return stats.sort((a, b) => new Date(b.lastExecution || 0).getTime() - new Date(a.lastExecution || 0).getTime())
      },
      'fetch_configuration_stats',
      'configurations'
    )

    // 計算總體統計
    const overallStats = {
      totalConfigurations: configurationStats.length,
      totalExecutions: configurationStats.reduce((sum, s) => sum + s.totalExecutions, 0),
      totalSuccessCount: configurationStats.reduce((sum, s) => sum + s.successCount, 0),
      totalErrorCount: configurationStats.reduce((sum, s) => sum + s.errorCount, 0),
      totalPartialCount: configurationStats.reduce((sum, s) => sum + s.partialCount, 0),
      averageSuccessRate: configurationStats.length > 0 
        ? configurationStats.reduce((sum, s) => sum + s.successRate, 0) / configurationStats.length 
        : 0,
      totalArticlesFound: recentExecutions.reduce((sum, e) => sum + (e.articlesFound || 0), 0),
      totalArticlesSent: recentExecutions.reduce((sum, e) => sum + (e.articlesSent || 0), 0),
    }

    // 獲取最近 24 小時的執行趨勢
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const trendData = await dbWrapper.execute(
      async () => {
        const trendSnapshot = await db.collection('executions')
          .where('timestamp', '>=', last24Hours)
          .orderBy('timestamp', 'asc')
          .get()

        const hourlyData: Record<string, { success: number; error: number; partial: number }> = {}
        
        trendSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const hour = new Date(data.timestamp.toDate()).toISOString().substring(0, 13) + ':00:00.000Z'
          
          if (!hourlyData[hour]) {
            hourlyData[hour] = { success: 0, error: 0, partial: 0 }
          }
          
          hourlyData[hour][data.status as keyof typeof hourlyData[typeof hour]]++
        })

        return Object.entries(hourlyData).map(([hour, counts]) => ({
          timestamp: hour,
          ...counts,
        }))
      },
      'fetch_trend_data',
      'executions'
    )

    // 記錄指標
    metricsCollector.increment('execution_overview_requests', 1, {
      resultCount: recentExecutions.length.toString(),
    })

    const response = {
      recentExecutions,
      configurationStats,
      overallStats,
      trendData,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        hasMore: recentExecutions.length === query.limit,
      },
      query,
    }

    await logger.info('Execution overview retrieved successfully', {
      component: 'execution-overview-api',
      action: 'fetch_overview_success',
      resultCount: recentExecutions.length,
      configurationCount: configurationStats.length,
    })

    ;(res as any).success(response, 'Execution overview retrieved successfully')

  } catch (error) {
    await logger.error('Failed to fetch execution overview', {
      component: 'execution-overview-api',
      action: 'fetch_overview_error',
      query,
    }, error as Error)

    throw error
  }
}

export default withMethodValidation(['GET'])(
  withComprehensiveErrorHandling()(
    withErrorHandler(executionOverviewHandler)
  )
)