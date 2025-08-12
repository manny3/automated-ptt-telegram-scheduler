'use client'

interface DashboardProps {
  totalConfigurations: number
  activeConfigurations: number
  lastExecutions: Array<{
    configName: string
    status: 'success' | 'error' | 'no_articles'
    executedAt: Date
    articlesFound: number
  }>
}

export default function Dashboard({ totalConfigurations, activeConfigurations, lastExecutions }: DashboardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'no_articles':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <span className="text-white font-semibold">T</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Configurations</p>
              <p className="text-2xl font-semibold text-gray-900">{totalConfigurations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <span className="text-white font-semibold">A</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Configurations</p>
              <p className="text-2xl font-semibold text-gray-900">{activeConfigurations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <span className="text-white font-semibold">R</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recent Executions</p>
              <p className="text-2xl font-semibold text-gray-900">{lastExecutions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Executions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Executions</h3>
        </div>
        <div className="p-6">
          {lastExecutions.length === 0 ? (
            <p className="text-gray-500 text-center">No recent executions</p>
          ) : (
            <div className="space-y-4">
              {lastExecutions.map((execution, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      execution.status === 'success' ? 'bg-green-400' :
                      execution.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{execution.configName}</p>
                      <p className="text-xs text-gray-500">
                        {execution.articlesFound} articles found
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${getStatusColor(execution.status)}`}>
                      {execution.status.replace('_', ' ').toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {execution.executedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}