'use client'

interface Configuration {
  id: string
  name: string
  pttBoard: string
  keywords: string[]
  postCount: number
  schedule: {
    type: string
    time?: string
    interval?: number
  }
  telegramChatId: string
  isActive: boolean
  lastExecuted?: Date
  lastExecutionStatus?: 'success' | 'error' | 'no_articles'
}

interface ConfigurationListProps {
  configurations: Configuration[]
  onEdit: (config: Configuration) => void
  onDelete: (id: string) => void
}

export default function ConfigurationList({ configurations, onEdit, onDelete }: ConfigurationListProps) {
  const getScheduleDisplay = (schedule: Configuration['schedule']) => {
    switch (schedule.type) {
      case 'hourly':
        return 'Every hour'
      case 'daily':
        return `Daily at ${schedule.time}`
      case 'custom':
        return `Every ${schedule.interval} minutes`
      default:
        return 'Unknown'
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Success</span>
      case 'error':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Error</span>
      case 'no_articles':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">No Articles</span>
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Not Run</span>
    }
  }

  if (configurations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No configurations found. Create your first configuration to get started.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Active Configurations</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Board
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Run
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {configurations.map((config) => (
              <tr key={config.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{config.name}</div>
                  <div className="text-sm text-gray-500">
                    {config.keywords.length > 0 ? config.keywords.join(', ') : 'No keywords'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {config.pttBoard}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getScheduleDisplay(config.schedule)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(config.lastExecutionStatus)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {config.lastExecuted 
                    ? new Date(config.lastExecuted).toLocaleString()
                    : 'Never'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onEdit(config)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(config.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}