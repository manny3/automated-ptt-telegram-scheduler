'use client'

interface ExecutionRecord {
  id: string
  configurationId: string
  executedAt: Date
  status: 'success' | 'error' | 'no_articles'
  articlesFound: number
  articlesSent: number
  errorMessage?: string
  executionDuration: number
}

interface TaskHistoryProps {
  executions: ExecutionRecord[]
  configurationName: string
}

export default function TaskHistory({ executions, configurationName }: TaskHistoryProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Success</span>
      case 'error':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Error</span>
      case 'no_articles':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">No Articles</span>
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Execution History - {configurationName}
        </h3>
      </div>
      
      {executions.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-500">No execution history available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executed At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Articles Found
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Articles Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.executedAt.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(execution.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.articlesFound}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.articlesSent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(execution.executionDuration)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {execution.errorMessage ? (
                      <div className="max-w-xs truncate" title={execution.errorMessage}>
                        {execution.errorMessage}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}