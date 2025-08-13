/**
 * React 錯誤邊界組件
 * 
 * 捕獲和處理 React 組件樹中的 JavaScript 錯誤
 * 提供優雅的錯誤回退 UI 和錯誤報告
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'critical'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state 以顯示錯誤 UI
    return {
      hasError: true,
      error,
      errorId: Math.random().toString(36).substring(7),
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錄錯誤到日誌系統
    const errorId = this.state.errorId || Math.random().toString(36).substring(7)
    
    logger.error('React Error Boundary caught an error', {
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
      errorId,
      level: this.props.level || 'component',
      componentStack: errorInfo.componentStack,
    }, error)

    // 更新狀態以包含錯誤資訊
    this.setState({
      errorInfo,
      errorId,
    })

    // 呼叫自訂錯誤處理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 在開發環境中顯示詳細錯誤資訊
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.groupEnd()
    }
  }

  handleRetry = () => {
    logger.info('User triggered error boundary retry', {
      component: 'ErrorBoundary',
      action: 'retry',
      errorId: this.state.errorId,
    })

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    })
  }

  handleReportError = () => {
    if (this.state.error && this.state.errorId) {
      logger.critical('User reported critical error', {
        component: 'ErrorBoundary',
        action: 'report_error',
        errorId: this.state.errorId,
        userReported: true,
      }, this.state.error)

      // 這裡可以整合錯誤報告服務，如 Sentry
      alert('錯誤已回報，我們會盡快處理。謝謝您的回饋！')
    }
  }

  render() {
    if (this.state.hasError) {
      // 如果有自訂的 fallback UI，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 根據錯誤等級顯示不同的 UI
      return this.renderErrorUI()
    }

    return this.props.children
  }

  private renderErrorUI() {
    const { level = 'component' } = this.props
    const { error, errorId } = this.state

    if (level === 'critical') {
      return this.renderCriticalErrorUI()
    }

    if (level === 'page') {
      return this.renderPageErrorUI()
    }

    return this.renderComponentErrorUI()
  }

  private renderCriticalErrorUI() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
          
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              系統發生嚴重錯誤
            </h1>
            <p className="text-gray-600 mb-6">
              很抱歉，應用程式遇到了無法恢復的錯誤。請重新整理頁面或聯繫技術支援。
            </p>
            
            {this.state.errorId && (
              <p className="text-xs text-gray-500 mb-4">
                錯誤 ID: {this.state.errorId}
              </p>
            )}
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                重新整理頁面
              </button>
              
              <button
                onClick={this.handleReportError}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                回報問題
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private renderPageErrorUI() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
          </div>
          
          <div className="text-center">
            <h1 className="text-lg font-medium text-gray-900 mb-2">
              頁面載入錯誤
            </h1>
            <p className="text-gray-600 mb-6">
              這個頁面遇到了問題，無法正常顯示。您可以嘗試重新載入或返回首頁。
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  顯示錯誤詳情 (開發模式)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                重試
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  private renderComponentErrorUI() {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              組件載入錯誤
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>這個組件遇到了問題，無法正常顯示。</p>
            </div>
            <div className="mt-4">
              <div className="-mx-2 -my-1.5 flex">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="bg-yellow-50 px-2 py-1.5 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
                >
                  重試
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    type="button"
                    onClick={() => console.error('Error details:', this.state.error, this.state.errorInfo)}
                    className="ml-3 bg-yellow-50 px-2 py-1.5 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
                  >
                    查看詳情
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

// 高階組件工廠函數
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`

  return WithErrorBoundaryComponent
}

// 特定用途的錯誤邊界組件
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="page">
    {children}
  </ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="component">
    {children}
  </ErrorBoundary>
)

export const CriticalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="critical">
    {children}
  </ErrorBoundary>
)