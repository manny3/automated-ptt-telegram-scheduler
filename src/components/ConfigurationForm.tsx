'use client'

import { useState } from 'react'

interface ConfigurationFormProps {
  onSubmit: (config: any) => void
  initialData?: any
}

export default function ConfigurationForm({ onSubmit, initialData }: ConfigurationFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    pttBoard: initialData?.pttBoard || '',
    keywords: initialData?.keywords?.join(', ') || '',
    postCount: initialData?.postCount || 10,
    scheduleType: initialData?.schedule?.type || 'daily',
    scheduleTime: initialData?.schedule?.time || '09:00',
    scheduleInterval: initialData?.schedule?.interval || 60,
    telegramChatId: initialData?.telegramChatId || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const config = {
      name: formData.name,
      pttBoard: formData.pttBoard,
      keywords: formData.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k),
      postCount: parseInt(formData.postCount.toString()),
      schedule: {
        type: formData.scheduleType,
        ...(formData.scheduleType === 'daily' && { time: formData.scheduleTime }),
        ...(formData.scheduleType === 'custom' && { interval: parseInt(formData.scheduleInterval.toString()) }),
      },
      telegramChatId: formData.telegramChatId,
    }
    
    onSubmit(config)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Configuration Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="pttBoard" className="block text-sm font-medium text-gray-700">
          PTT Board
        </label>
        <input
          type="text"
          id="pttBoard"
          value={formData.pttBoard}
          onChange={(e) => setFormData({ ...formData, pttBoard: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="e.g., Tech_Job, Gossiping"
          required
        />
      </div>

      <div>
        <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
          Keywords (comma-separated)
        </label>
        <input
          type="text"
          id="keywords"
          value={formData.keywords}
          onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="e.g., python, backend, 工程師"
        />
      </div>

      <div>
        <label htmlFor="postCount" className="block text-sm font-medium text-gray-700">
          Number of Posts (1-100)
        </label>
        <input
          type="number"
          id="postCount"
          min="1"
          max="100"
          value={formData.postCount}
          onChange={(e) => setFormData({ ...formData, postCount: parseInt(e.target.value) })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="telegramChatId" className="block text-sm font-medium text-gray-700">
          Telegram Chat ID
        </label>
        <input
          type="text"
          id="telegramChatId"
          value={formData.telegramChatId}
          onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="scheduleType" className="block text-sm font-medium text-gray-700">
          Schedule Type
        </label>
        <select
          id="scheduleType"
          value={formData.scheduleType}
          onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="custom">Custom Interval</option>
        </select>
      </div>

      {formData.scheduleType === 'daily' && (
        <div>
          <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700">
            Daily Time (HH:MM)
          </label>
          <input
            type="time"
            id="scheduleTime"
            value={formData.scheduleTime}
            onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      )}

      {formData.scheduleType === 'custom' && (
        <div>
          <label htmlFor="scheduleInterval" className="block text-sm font-medium text-gray-700">
            Interval (minutes)
          </label>
          <input
            type="number"
            id="scheduleInterval"
            min="15"
            value={formData.scheduleInterval}
            onChange={(e) => setFormData({ ...formData, scheduleInterval: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      )}

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Save Configuration
      </button>
    </form>
  )
}