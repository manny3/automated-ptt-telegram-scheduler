'use client'

import { useState, useEffect } from 'react'
import { CreateConfigurationRequest, UpdateConfigurationRequest, ScrapingConfiguration } from '@/types'
import { validateCreateConfiguration, ValidationError } from '@/lib/validation'

interface ConfigurationFormProps {
  onSubmit: (config: CreateConfigurationRequest | UpdateConfigurationRequest) => Promise<void>
  initialData?: ScrapingConfiguration
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

interface FormData {
  name: string
  pttBoard: string
  keywords: string
  postCount: number
  scheduleType: 'hourly' | 'daily' | 'custom'
  scheduleTime: string
  scheduleInterval: number
  telegramChatId: string
  isActive: boolean
}

export default function ConfigurationForm({ 
  onSubmit, 
  initialData, 
  isLoading = false,
  mode = 'create'
}: ConfigurationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    pttBoard: initialData?.pttBoard || '',
    keywords: initialData?.keywords?.join(', ') || '',
    postCount: initialData?.postCount || 10,
    scheduleType: initialData?.schedule?.type || 'daily',
    scheduleTime: initialData?.schedule?.time || '09:00',
    scheduleInterval: initialData?.schedule?.interval || 60,
    telegramChatId: initialData?.telegramChatId || '',
    isActive: initialData?.isActive ?? true,
  })

  const [errors, setErrors] = useState<ValidationError[]>([])
  const [submitError, setSubmitError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        pttBoard: initialData.pttBoard,
        keywords: initialData.keywords.join(', '),
        postCount: initialData.postCount,
        scheduleType: initialData.schedule.type,
        scheduleTime: initialData.schedule.time || '09:00',
        scheduleInterval: initialData.schedule.interval || 60,
        telegramChatId: initialData.telegramChatId,
        isActive: initialData.isActive,
      })
    }
  }, [initialData])

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName)
    return error?.message
  }

  const validateForm = (): boolean => {
    const config = {
      name: formData.name.trim(),
      pttBoard: formData.pttBoard.trim(),
      keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0),
      postCount: formData.postCount,
      schedule: {
        type: formData.scheduleType,
        ...(formData.scheduleType === 'daily' && { time: formData.scheduleTime }),
        ...(formData.scheduleType === 'custom' && { interval: formData.scheduleInterval }),
      },
      telegramChatId: formData.telegramChatId.trim(),
    }

    const validation = validateCreateConfiguration(config)
    setErrors(validation.errors)
    return validation.isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const config = {
        name: formData.name.trim(),
        pttBoard: formData.pttBoard.trim(),
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0),
        postCount: formData.postCount,
        schedule: {
          type: formData.scheduleType,
          ...(formData.scheduleType === 'daily' && { time: formData.scheduleTime }),
          ...(formData.scheduleType === 'custom' && { interval: formData.scheduleInterval }),
        },
        telegramChatId: formData.telegramChatId.trim(),
        ...(mode === 'edit' && { isActive: formData.isActive }),
      }

      await onSubmit(config)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred while saving the configuration')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear field-specific errors when user starts typing
    if (errors.length > 0) {
      setErrors(prev => prev.filter(e => e.field !== field))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-lg">
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'create' ? 'Create New Configuration' : 'Edit Configuration'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Configure your PTT article scraping and Telegram delivery settings.
          </p>
        </div>

        {submitError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{submitError}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Configuration Name */}
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Configuration Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                getFieldError('name') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter a descriptive name for this configuration"
              disabled={isSubmitting || isLoading}
            />
            {getFieldError('name') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
            )}
          </div>

          {/* PTT Board */}
          <div>
            <label htmlFor="pttBoard" className="block text-sm font-medium text-gray-700">
              PTT Board *
            </label>
            <input
              type="text"
              id="pttBoard"
              value={formData.pttBoard}
              onChange={(e) => handleInputChange('pttBoard', e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                getFieldError('pttBoard') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Tech_Job, Gossiping"
              disabled={isSubmitting || isLoading}
            />
            {getFieldError('pttBoard') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('pttBoard')}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Enter the PTT board name (letters, numbers, and underscores only)
            </p>
          </div>

          {/* Post Count */}
          <div>
            <label htmlFor="postCount" className="block text-sm font-medium text-gray-700">
              Number of Posts *
            </label>
            <input
              type="number"
              id="postCount"
              min="1"
              max="100"
              value={formData.postCount}
              onChange={(e) => handleInputChange('postCount', parseInt(e.target.value) || 1)}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                getFieldError('postCount') ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isSubmitting || isLoading}
            />
            {getFieldError('postCount') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('postCount')}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Number of latest posts to fetch (1-100)
            </p>
          </div>

          {/* Keywords */}
          <div className="sm:col-span-2">
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
              Keywords *
            </label>
            <input
              type="text"
              id="keywords"
              value={formData.keywords}
              onChange={(e) => handleInputChange('keywords', e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                getFieldError('keywords') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., python, backend, 工程師, react"
              disabled={isSubmitting || isLoading}
            />
            {getFieldError('keywords') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('keywords')}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated keywords to filter articles (1-20 keywords, max 50 chars each)
            </p>
          </div>

          {/* Telegram Chat ID */}
          <div className="sm:col-span-2">
            <label htmlFor="telegramChatId" className="block text-sm font-medium text-gray-700">
              Telegram Chat ID *
            </label>
            <input
              type="text"
              id="telegramChatId"
              value={formData.telegramChatId}
              onChange={(e) => handleInputChange('telegramChatId', e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                getFieldError('telegramChatId') ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., 123456789 or -123456789"
              disabled={isSubmitting || isLoading}
            />
            {getFieldError('telegramChatId') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('telegramChatId')}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Your Telegram chat ID (get it from @userinfobot)
            </p>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Schedule Configuration</h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="scheduleType" className="block text-sm font-medium text-gray-700">
                Schedule Type *
              </label>
              <select
                id="scheduleType"
                value={formData.scheduleType}
                onChange={(e) => handleInputChange('scheduleType', e.target.value as 'hourly' | 'daily' | 'custom')}
                className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  getFieldError('schedule.type') ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting || isLoading}
              >
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily at Specific Time</option>
                <option value="custom">Custom Interval</option>
              </select>
              {getFieldError('schedule.type') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('schedule.type')}</p>
              )}
            </div>

            {formData.scheduleType === 'daily' && (
              <div>
                <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700">
                  Daily Time *
                </label>
                <input
                  type="time"
                  id="scheduleTime"
                  value={formData.scheduleTime}
                  onChange={(e) => handleInputChange('scheduleTime', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    getFieldError('schedule.time') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting || isLoading}
                />
                {getFieldError('schedule.time') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('schedule.time')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Time when the daily scraping should run (24-hour format)
                </p>
              </div>
            )}

            {formData.scheduleType === 'custom' && (
              <div>
                <label htmlFor="scheduleInterval" className="block text-sm font-medium text-gray-700">
                  Interval (minutes) *
                </label>
                <input
                  type="number"
                  id="scheduleInterval"
                  min="15"
                  max="1440"
                  value={formData.scheduleInterval}
                  onChange={(e) => handleInputChange('scheduleInterval', parseInt(e.target.value) || 15)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    getFieldError('schedule.interval') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting || isLoading}
                />
                {getFieldError('schedule.interval') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('schedule.interval')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Custom interval in minutes (15-1440 minutes)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active Status (only for edit mode) */}
        {mode === 'edit' && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={isSubmitting || isLoading}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Configuration is active
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Inactive configurations will not be executed by the scheduler
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              mode === 'create' ? 'Create Configuration' : 'Update Configuration'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}