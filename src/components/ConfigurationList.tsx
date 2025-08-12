'use client'

import { useState } from 'react'
import { ScrapingConfiguration } from '../types'

interface ConfigurationListProps {
  configurations: ScrapingConfiguration[]
  onEdit: (config: ScrapingConfiguration) => void
  onDelete: (id: string) => Promise<void>
  onToggleActive: (id: string, isActive: boolean) => Promise<void>
  isLoading?: boolean
}

export default function ConfigurationList({ 
  configurations, 
  onEdit, 
  onDelete, 
  onToggleActive,
  isLoading = false 
}: ConfigurationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const getScheduleDisplay = (schedule: ScrapingConfiguration['schedule']) => {
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
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
              <circle cx={4} cy={4} r={3} />
            </svg>
            Success
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
              <circle cx={4} cy={4} r={3} />
            </svg>
            Error
          </span>
        )
      case 'no_articles':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
              <circle cx={4} cy={4} r={3} />
            </svg>
            No Articles
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
              <circle cx={4} cy={4} r={3} />
            </svg>
            Not Run
          </span>
        )
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this configuration? This action cannot be undone.')) {
      setDeletingId(id)
      try {
        await onDelete(id)
      } catch (error) {
        console.error('Failed to delete configuration:', error)
        // You might want to show a toast notification here
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setTogglingId(id)
    try {
      await onToggleActive(id, !currentStatus)
    } catch (error) {
      console.error('Failed to toggle configuration status:', error)
      // You might want to show a toast notification here
    } finally {
      setTogglingId(null)
    }
  }

  const formatLastExecuted = (date?: Date) => {
    if (!date) return 'Never'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (configurations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations found</h3>
        <p className="text-gray-500 mb-4">Create your first configuration to start monitoring PTT articles.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Configurations</h3>
          <span className="text-sm text-gray-500">
            {configurations.filter(c => c.isActive).length} of {configurations.length} active
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Configuration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Board & Posts
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
              <tr key={config.id} className={!config.isActive ? 'opacity-60' : ''}>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${config.isActive ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{config.name}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {config.keywords.length > 0 ? config.keywords.join(', ') : 'No keywords'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{config.pttBoard}</div>
                  <div className="text-sm text-gray-500">{config.postCount} posts</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getScheduleDisplay(config.schedule)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(config.lastExecutionStatus)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatLastExecuted(config.lastExecuted)}</div>
                  {config.lastExecuted && (
                    <div className="text-xs text-gray-500">
                      {config.lastExecuted.toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleActive(config.id, config.isActive)}
                      disabled={togglingId === config.id}
                      className={`text-xs px-2 py-1 rounded ${
                        config.isActive 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      } disabled:opacity-50`}
                    >
                      {togglingId === config.id ? '...' : (config.isActive ? 'Disable' : 'Enable')}
                    </button>
                    <button
                      onClick={() => onEdit(config)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      disabled={deletingId === config.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      {deletingId === config.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}