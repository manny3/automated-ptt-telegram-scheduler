/**
 * ErrorBoundary 組件測試
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary'

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    critical: jest.fn(),
  },
}))

// 測試組件：會拋出錯誤的組件
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// 測試組件：正常組件
const NormalComponent = () => <div>Normal component</div>

describe('ErrorBoundary', () => {
  // 抑制 console.error 在測試中的輸出
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('應該在沒有錯誤時正常渲染子組件', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('應該在組件錯誤時顯示錯誤 UI', () => {
    render(
      <ErrorBoundary level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('組件載入錯誤')).toBeInTheDocument()
    expect(screen.getByText('這個組件遇到了問題，無法正常顯示。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument()
  })

  it('應該在頁面錯誤時顯示頁面錯誤 UI', () => {
    render(
      <ErrorBoundary level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('頁面載入錯誤')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回首頁' })).toBeInTheDocument()
  })

  it('應該在嚴重錯誤時顯示嚴重錯誤 UI', () => {
    render(
      <ErrorBoundary level="critical">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('系統發生嚴重錯誤')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新整理頁面' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '回報問題' })).toBeInTheDocument()
  })

  it('應該支援重試功能', () => {
    const { rerender } = render(
      <ErrorBoundary level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('組件載入錯誤')).toBeInTheDocument()

    // 點擊重試按鈕
    fireEvent.click(screen.getByRole('button', { name: '重試' }))

    // 重新渲染為正常組件
    rerender(
      <ErrorBoundary level="component">
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('應該使用自訂 fallback UI', () => {
    const customFallback = <div>Custom error UI</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('應該呼叫自訂錯誤處理器', () => {
    const onError = jest.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('應該在開發環境中顯示錯誤詳情', () => {
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('顯示錯誤詳情 (開發模式)')).toBeInTheDocument()
  })

  it('應該記錄錯誤到日誌系統', () => {
    const { logger } = require('@/lib/logger')

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(logger.error).toHaveBeenCalledWith(
      'React Error Boundary caught an error',
      expect.objectContaining({
        component: 'ErrorBoundary',
        action: 'componentDidCatch',
      }),
      expect.any(Error)
    )
  })

  describe('withErrorBoundary HOC', () => {
    it('應該包裝組件並處理錯誤', () => {
      const WrappedComponent = withErrorBoundary(ThrowError, { level: 'component' })

      render(<WrappedComponent shouldThrow={true} />)

      expect(screen.getByText('組件載入錯誤')).toBeInTheDocument()
    })

    it('應該設定正確的 displayName', () => {
      const TestComponent = () => <div>Test</div>
      TestComponent.displayName = 'TestComponent'

      const WrappedComponent = withErrorBoundary(TestComponent)

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)')
    })
  })
})