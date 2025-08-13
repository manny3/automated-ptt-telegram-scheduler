/**
 * Secret Manager 狀態組件
 * 
 * 顯示 Telegram Bot Token 的設定狀態和驗證結果
 */

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface SecretValidationResult {
  success: boolean
  accessible: boolean
  secretName?: string
  metadata?: {
    name: string
    createTime?: string
    labels?: { [key: string]: string }
  }
  tokenValid?: boolean
  error?: string
  message?: string
}

interface SecretManagerStatusProps {
  className?: string
  showDetails?: boolean
  onStatusChange?: (isValid: boolean) => void
}

export default function SecretManagerStatus({ 
  className = '', 
  showDetails = false,
  onStatusChange 
}: SecretManagerStatusProps) {
  const [status, setStatus] = useState<SecretValidationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 驗證 Secret Manager 狀態
  const validateSecrets = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/secrets/validate')
      const data: SecretValidationResult = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '驗證請求失敗')
      }
      
      setStatus(data)
      
      // 通知父組件狀態變化
      if (onStatusChange) {
        onStatusChange(data.accessible && data.tokenValid === true)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知錯誤'
      setError(errorMessage)
      setStatus(null)
      
      if (onStatusChange) {
        onStatusChange(false)
      }
    } finally {
      setLoading(false)
    }
  }

  // 組件載入時驗證狀態
  useEffect(() => {
    validateSecrets()
  }, [])

  // 取得狀態圖示和顏色
  const getStatusIcon = () => {
    if (loading) {
      return (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      )
    }
    
    if (error || !status) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />
    }
    
    if (!status.accessible) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />
    }
    
    if (status.accessible && status.tokenValid === false) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
    }
    
    if (status.accessible && status.tokenValid === true) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    }
    
    return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
  }

  // 取得狀態文字
  const getStatusText = () => {
    if (loading) return '正在驗證 Secret Manager 設定...'
    if (error) return `驗證失敗: ${error}`
    if (!status) return '無法取得狀態'
    
    return status.message || '狀態未知'
  }

  // 取得狀態顏色類別
  const getStatusColorClass = () => {
    if (loading) return 'text-blue-600'
    if (error || !status || !status.accessible) return 'text-red-600'
    if (status.accessible && status.tokenValid === false) return 'text-yellow-600'
    if (status.accessible && status.tokenValid === true) return 'text-green-600'
    return 'text-gray-600'
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getStatusIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Telegram Bot Token 狀態
            </h3>
            
            <button
              onClick={validateSecrets}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? '驗證中...' : '重新驗證'}
            </button>
          </div>
          
          <p className={`mt-1 text-sm ${getStatusColorClass()}`}>
            {getStatusText()}
          </p>
          
          {showDetails && status && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-500">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">密鑰名稱:</span>
                    <br />
                    <span className="font-mono">{status.secretName || '未知'}</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">存取狀態:</span>
                    <br />
                    <span className={status.accessible ? 'text-green-600' : 'text-red-600'}>
                      {status.accessible ? '可存取' : '無法存取'}
                    </span>
                  </div>
                  
                  {status.accessible && (
                    <div>
                      <span className="font-medium">Token 格式:</span>
                      <br />
                      <span className={status.tokenValid ? 'text-green-600' : 'text-red-600'}>
                        {status.tokenValid ? '有效' : '無效'}
                      </span>
                    </div>
                  )}
                  
                  {status.metadata?.createTime && (
                    <div>
                      <span className="font-medium">建立時間:</span>
                      <br />
                      <span>{new Date(parseInt(status.metadata.createTime) * 1000).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                </div>
                
                {status.metadata?.labels && Object.keys(status.metadata.labels).length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium">標籤:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(status.metadata.labels).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 錯誤詳情 */}
          {status?.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <span className="font-medium">錯誤詳情:</span> {status.error}
            </div>
          )}
          
          {/* 設定建議 */}
          {!loading && (!status?.accessible || status?.tokenValid === false) && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">設定建議</h4>
              <ul className="text-xs text-yellow-700 space-y-1">
                {!status?.accessible && (
                  <>
                    <li>• 確認 Secret Manager 中存在名為 "{status?.secretName || 'telegram-bot-token'}" 的密鑰</li>
                    <li>• 檢查服務帳戶是否有 Secret Manager 存取權限</li>
                    <li>• 驗證 GOOGLE_CLOUD_PROJECT 環境變數設定</li>
                  </>
                )}
                {status?.accessible && status?.tokenValid === false && (
                  <>
                    <li>• 確認 Telegram Bot Token 格式正確 (格式: 數字:字母數字)</li>
                    <li>• 從 @BotFather 重新取得 Token 並更新密鑰</li>
                  </>
                )}
                <li>• 執行設定腳本: <code className="bg-yellow-100 px-1 rounded">./scripts/setup-secret-manager.sh</code></li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}