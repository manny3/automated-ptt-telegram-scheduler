/**
 * 執行歷史總覽頁面
 * 
 * 顯示所有配置的執行歷史總覽和統計資料
 */

import { useState, useEffect } from 'react'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import TaskHistory from '@/components/TaskHistory'
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

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

interface OverallStats {
  totalConfigurations: number
  totalExecutions: number
  totalSuccessCount: number
  totalErrorCount: number
  totalPartialCount: number
  averageSuccessRate: number
  totalArticlesFound: number
  totalArticlesSent: number
}

interface TrendDataPoint {
  timestamp: string
  success: number
  error: number
  partial: number
}

export default function ExecutionHistoryPage() {
  const [recentExecutions, setRecentExecutions] = useState<ExecutionSummary[]>([])
  const [configurationStats, setConfigurationStats] = useState<ConfigurationStats[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  })

  const fetchOverview = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)

      const response = await fetch(`/api/executions?${params}`)
      const data = await response.json()

      if (data.success) {
        setRecentExecutions(data.data.recentExecutions)
        setConfigurationStats(data.data.configurationStats)
        setOverallStats(data.data.overallStats)
        setTrendData(data.data.trendData)
      } else {
        setError(data.error?.message || 'Failed to fetch execution overview')
      }
    } catch (err) {
      setError('Network error while fetching execution overview')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchOverview()
  }

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }))
  }

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  useEffect(() => {
    fetchOverview()
  }, [dateRange])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchOverview, 30000) // 30 秒更新
    return () => clearInterval(interval)
  }, [autoRefresh, dateRange])

  if (selectedConfig) {
    const config = configurationStats.find(c => c.configurationId === selectedConfig)
    return (
      <PageErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
              <button
                onClick={() => setSelectedConfig(null)}
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
              >
                ← 返回總覽
              </button>
            </div>
            
            <TaskHistory
              configurationId={selectedConfig}
              configurationName={config?.configurationName}
              autoRefresh={autoRefresh}
            />
          </div>
        </div>
      </PageErrorBoundary>
    )
  }

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 標題和控制項 */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">執行歷史總覽</h1>
              <p className="text-gray-600 mt-2">查看所有配置的執行歷史和統計資料</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">自動更新</span>
              </label>
              
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
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新
              </button>
            </div>
          </div>

          {/* 篩選器 */}
          {showFilters && (
            <div className="mb-6 bg-white shadow rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">開始日期</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">結束日期</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">錯誤</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 總體統計 */}
          {overallStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">總執行次數</dt>
                        <dd className="text-2xl font-bold text-gray-900">{overallStats.totalExecutions}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">成功率</dt>
                        <dd className="text-2xl font-bold text-gray-900">
                          {overallStats.averageSuccessRate.toFixed(1)}%
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">活躍配置</dt>
                        <dd className="text-2xl font-bold text-gray-900">{overallStats.totalConfigurations}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">總發送文章</dt>
                        <dd className="text-2xl font-bold text-gray-900">{overallStats.totalArticlesSent}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 配置統計 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">配置統計</h3>
                <div className="space-y-4">
                  {configurationStats.map((config) => (
                    <div key={config.configurationId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">{config.configurationName}</h4>
                        <button
                          onClick={() => setSelectedConfig(config.configurationId)}
                          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          查看詳情
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">總執行</div>
                          <div className="font-medium">{config.totalExecutions}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">成功率</div>
                          <div className="font-medium">{config.successRate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">最後執行</div>
                          <div className="font-medium">
                            {config.lastExecution ? formatDate(config.lastExecution) : '無'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          成功 {config.successCount}
                        </span>
                        {config.errorCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            失敗 {config.errorCount}
                          </span>
                        )}
                        {config.partialCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            部分 {config.partialCount}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 最近執行 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">最近執行</h3>
                <div className="space-y-3">
                  {recentExecutions.map((execution) => (
                    <div key={execution.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(execution.status)}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {execution.configurationName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(execution.timestamp)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-900">
                          {execution.articlesSent}/{execution.articlesFound} 篇
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDuration(execution.executionTime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 24 小時趨勢 */}
          {trendData.length > 0 && (
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">24 小時執行趨勢</h3>
                <div className="space-y-2">
                  {trendData.map((point, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="text-gray-500">
                        {new Date(point.timestamp).toLocaleTimeString('zh-TW', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="flex space-x-4">
                        <span className="text-green-600">成功 {point.success}</span>
                        <span className="text-red-600">失敗 {point.error}</span>
                        <span className="text-yellow-600">部分 {point.partial}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageErrorBoundary>
  )
}