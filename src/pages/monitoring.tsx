/**
 * 監控儀表板頁面
 * 
 * 顯示系統健康狀態、指標和警報
 */

import { useState, useEffect } from 'react'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { 
  ChartBarIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  ServerIcon
} from '@heroicons/react/24/outline'

interface HealthData {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services?: {
    database: 'connected' | 'disconnected' | 'unknown'
    secretManager: 'accessible' | 'inaccessible' | 'unknown'
  }
  metrics?: {
    memoryUsage: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
    activeHandles: number
    activeRequests: number
  }
  checks?: Record<string, { healthy: boolean; lastCheck: string; error?: string }>
}

interface MetricData {
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  change: number
}

export default function MonitoringPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/health?detailed=true&metrics=true')
      const data = await response.json()
      
      if (data.success) {
        setHealthData(data.data)
        setError(null)
      } else {
        setError(data.error?.message || 'Failed to fetch health data')
      }
    } catch (err) {
      setError('Network error while fetching health data')
    }
  }

  const fetchMetrics = async () => {
    try {
      // 這裡應該呼叫實際的指標 API
      // 暫時使用模擬資料
      const mockMetrics: MetricData[] = [
        { name: 'API Response Time', value: 150, unit: 'ms', trend: 'stable', change: 0 },
        { name: 'Error Rate', value: 2.5, unit: '%', trend: 'down', change: -0.5 },
        { name: 'Requests/min', value: 45, unit: 'req/min', trend: 'up', change: 5 },
        { name: 'Active Users', value: 12, unit: 'users', trend: 'stable', change: 0 },
      ]
      setMetrics(mockMetrics)
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([fetchHealthData(), fetchMetrics()])
    setLoading(false)
  }

  useEffect(() => {
    refreshData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshData, 30000) // 每 30 秒更新
    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatBytes = (bytes: number): string => {
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(1)} MB`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'accessible':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'unhealthy':
      case 'disconnected':
      case 'inaccessible':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'accessible':
        return 'text-green-600 bg-green-50'
      case 'unhealthy':
      case 'disconnected':
      case 'inaccessible':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-yellow-600 bg-yellow-50'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '↗️'
      case 'down':
        return '↘️'
      default:
        return '→'
    }
  }

  if (loading && !healthData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 標題和控制項 */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">系統監控儀表板</h1>
              <p className="text-gray-600 mt-2">即時監控系統健康狀態和效能指標</p>
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
                onClick={refreshData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? '更新中...' : '立即更新'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">錯誤</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 系統狀態概覽 */}
          {healthData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getStatusIcon(healthData.status)}
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">系統狀態</dt>
                        <dd className={`text-lg font-medium ${getStatusColor(healthData.status)}`}>
                          {healthData.status === 'healthy' ? '健康' : '異常'}
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
                      <ClockIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">運行時間</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatUptime(healthData.uptime)}
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
                      <ServerIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">版本</dt>
                        <dd className="text-lg font-medium text-gray-900">{healthData.version}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CpuChipIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">環境</dt>
                        <dd className="text-lg font-medium text-gray-900">{healthData.environment}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 服務狀態 */}
            {healthData?.services && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">服務狀態</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">資料庫</span>
                      <div className="flex items-center">
                        {getStatusIcon(healthData.services.database)}
                        <span className={`ml-2 text-sm ${getStatusColor(healthData.services.database)}`}>
                          {healthData.services.database === 'connected' ? '已連接' : '未連接'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Secret Manager</span>
                      <div className="flex items-center">
                        {getStatusIcon(healthData.services.secretManager)}
                        <span className={`ml-2 text-sm ${getStatusColor(healthData.services.secretManager)}`}>
                          {healthData.services.secretManager === 'accessible' ? '可存取' : '無法存取'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 效能指標 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">效能指標</h3>
                <div className="space-y-4">
                  {metrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {metric.value} {metric.unit}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {getTrendIcon(metric.trend)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 記憶體使用量 */}
            {healthData?.metrics && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">記憶體使用量</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Heap 已使用</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBytes(healthData.metrics.memoryUsage.heapUsed)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Heap 總計</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBytes(healthData.metrics.memoryUsage.heapTotal)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">RSS</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBytes(healthData.metrics.memoryUsage.rss)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">活躍處理器</span>
                      <span className="text-sm font-medium text-gray-900">
                        {healthData.metrics.activeHandles}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 健康檢查 */}
            {healthData?.checks && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">健康檢查</h3>
                  <div className="space-y-4">
                    {Object.entries(healthData.checks).map(([name, check]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{name}</span>
                        <div className="flex items-center">
                          {getStatusIcon(check.healthy ? 'healthy' : 'unhealthy')}
                          <span className={`ml-2 text-sm ${getStatusColor(check.healthy ? 'healthy' : 'unhealthy')}`}>
                            {check.healthy ? '正常' : '異常'}
                          </span>
                          {check.error && (
                            <span className="ml-2 text-xs text-red-500" title={check.error}>
                              ⚠️
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 最後更新時間 */}
          {healthData && (
            <div className="mt-8 text-center text-sm text-gray-500">
              最後更新：{new Date(healthData.timestamp).toLocaleString('zh-TW')}
            </div>
          )}
        </div>
      </div>
    </PageErrorBoundary>
  )
}