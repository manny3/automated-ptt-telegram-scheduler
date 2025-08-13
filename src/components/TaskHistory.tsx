/**
 * 任務執行歷史組件
 * 
 * 顯示配置的執行歷史、統計資料和詳細日誌
 */

import React, { useState, useEffect, useCallback } from 'react'
import { ComponentErrorBoundary } from './ErrorBoundary'
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'

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

interface ExecutionStats {
  totalExecutions: number
  successCount: number
  errorCount: number
  partialCount: number
  totalArticlesFound: number
  totalArticlesSent: number
  averageExecutionTime: number
}

interface TaskHistoryProps {
  configurationId: string
  configurationName?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface FilterOptions {
  status?: 'success' | 'error' | 'partial' | ''
  startDate?: string
  endDate?: string
  sortBy: 'timestamp' | 'articlesFound' | 'articlesSent'
  sortOrder: 'asc' | 'desc'
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({
  configurationId,
  configurationName,
  autoRefresh = false,
  refreshInterval = 30000,
}) => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [stats, setStats] = useState<ExecutionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    startDate: '',
    endDate: '',
    sortBy: 'timestamp',
    sortOrder: 'desc',
  })
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false,
  })

  const fetchExecutions = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: reset ? '0' : pagination.offset.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/executions/${configurationId}?${params}`)
      const data = await response.json()

      if (data.success) {
        if (reset) {
          setExecutions(data.data.executions)
          setPagination(data.data.pagination)
        } else {
          setExecutions(prev => [...prev, ...data.data.executions])
          setPagination(data.data.pagination)
        }
        setStats(data.data.stats)
      } else {
        setError(data.error?.message || 'Failed to fetch execution history')
      }
    } catch (err) {
      setError('Network error while fetching execution history')
    } finally {
      setLoading(false)
    }
  }, [configurationId, filters, pagination.limit, pagination.offset])

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleLoadMore = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))
  }

  const handleRefresh = () => {
    setPagination(prev => ({ ...prev, offset: 0 }))
    fetchExecutions(true)
  }

  const toggleExecutionDetails = (executionId: string) => {
    setExpandedExecution(prev => prev === executionId ? null : executionId)
  }

  useEffect(() => {
    fetchExecutions(true)
  }, [filters])

  useEffect(() => {
    if (pagination.offset > 0) {
      fetchExecutions(false)
    }
  }, [pagination.offset])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchExecutions(true)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchExecutions])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
      case 'partial':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'partial':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <ComponentErrorBoundary>
      <div className="bg-white shadow rounded-lg">
        {/* 標題和控制項 */}
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                執行歷史
              </h3>
              {configurationName && (
                <p className="mt-1 text-sm text-gray-500">
                  配置：{configurationName}
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                篩選
              </button>
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新
              </button>
            </div>
          </div>

          {/* 統計資料 */}
          {stats && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 px-3 py-2 rounded-md">
                <div className="text-sm font-medium text-gray-500">總執行次數</div>
                <div className="text-lg font-semibold text-gray-900">{stats.totalExecutions}</div>
              </div>
              <div className="bg-green-50 px-3 py-2 rounded-md">
                <div className="text-sm font-medium text-green-600">成功</div>
                <div className="text-lg font-semibold text-green-900">{stats.successCount}</div>
              </div>
              <div className="bg-red-50 px-3 py-2 rounded-md">
                <div className="text-sm font-medium text-red-600">失敗</div>
                <div className="text-lg font-semibold text-red-900">{stats.errorCount}</div>
              </div>
              <div className="bg-blue-50 px-3 py-2 rounded-md">
                <div className="text-sm font-medium text-blue-600">平均執行時間</div>
                <div className="text-lg font-semibold text-blue-900">
                  {formatDuration(stats.averageExecutionTime)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 篩選器 */}
        {showFilters && (
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">狀態</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange({ status: e.target.value as any })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">全部</option>
                  <option value="success">成功</option>
                  <option value="error">失敗</option>
                  <option value="partial">部分成功</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">開始日期</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange({ startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">結束日期</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange({ endDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">排序</label>
                <select
                  value={`${filters.sortBy}-${filters.sortOrder}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-')
                    handleFilterChange({ sortBy: sortBy as any, sortOrder: sortOrder as any })
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="timestamp-desc">時間（新到舊）</option>
                  <option value="timestamp-asc">時間（舊到新）</option>
                  <option value="articlesFound-desc">找到文章數（多到少）</option>
                  <option value="articlesFound-asc">找到文章數（少到多）</option>
                  <option value="articlesSent-desc">發送文章數（多到少）</option>
                  <option value="articlesSent-asc">發送文章數（少到多）</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 錯誤訊息 */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 執行記錄列表 */}
        <div className="divide-y divide-gray-200">
          {executions.map((execution) => (
            <div key={execution.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(execution.status)}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(execution.timestamp)}
                    </div>
                    <div className="text-sm text-gray-500">
                      執行時間：{formatDuration(execution.executionTime)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center text-sm text-gray-900">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      找到 {execution.articlesFound} 篇
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                      發送 {execution.articlesSent} 篇
                    </div>
                  </div>
                  
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                    {execution.status === 'success' ? '成功' : 
                     execution.status === 'error' ? '失敗' : '部分成功'}
                  </span>
                  
                  <button
                    onClick={() => toggleExecutionDetails(execution.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedExecution === execution.id ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 錯誤訊息 */}
              {execution.errorMessage && (
                <div className="mt-2 p-2 bg-red-50 rounded-md">
                  <p className="text-sm text-red-700">{execution.errorMessage}</p>
                </div>
              )}

              {/* 詳細資訊 */}
              {expandedExecution === execution.id && execution.details && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">執行詳情</h4>
                      <dl className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">PTT 看板：</dt>
                          <dd className="text-gray-900">{execution.pttBoard}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">關鍵字：</dt>
                          <dd className="text-gray-900">{execution.keywords.join(', ')}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">爬取時間：</dt>
                          <dd className="text-gray-900">{formatDuration(execution.details.scrapingDuration)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">發送時間：</dt>
                          <dd className="text-gray-900">{formatDuration(execution.details.telegramDeliveryDuration)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* 文章列表 */}
                  {execution.details.articles && execution.details.articles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">文章列表</h4>
                      <div className="space-y-2">
                        {execution.details.articles.map((article, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {article.title}
                              </p>
                              <p className="text-sm text-gray-500">
                                作者：{article.author}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-500 text-sm"
                              >
                                查看
                              </a>
                              {article.sent ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            {article.error && (
                              <div className="mt-1">
                                <p className="text-xs text-red-600">{article.error}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 載入更多 */}
        {pagination.hasMore && (
          <div className="px-4 py-3 bg-gray-50 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? '載入中...' : '載入更多'}
            </button>
          </div>
        )}

        {/* 空狀態 */}
        {!loading && executions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">沒有執行記錄</h3>
            <p className="mt-1 text-sm text-gray-500">
              此配置尚未執行過任何任務。
            </p>
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  )
}

export default TaskHistory