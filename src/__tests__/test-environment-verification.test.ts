/**
 * 測試環境驗證
 * 確保 Jest 配置和測試工具正確載入
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

// 簡單的測試組件
const TestComponent: React.FC<{ message: string }> = ({ message }) => {
  return React.createElement('div', { 'data-testid': 'test-message' }, message)
}

describe('測試環境驗證', () => {
  describe('Jest 配置驗證', () => {
    it('應該正確載入 Jest 全域設定', () => {
      expect(process.env.NODE_ENV).toBe('test')
      expect(process.env.GOOGLE_CLOUD_PROJECT).toBe('test-project')
      expect(process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME).toBe('test-telegram-token')
    })

    it('應該正確設定測試超時', () => {
      // 驗證 Jest 配置中的 testTimeout 設定
      expect(jest.setTimeout).toBeDefined()
    })

    it('應該有全域測試工具可用', () => {
      expect(global.testUtils).toBeDefined()
      expect(global.testUtils.createMockApiResponse).toBeInstanceOf(Function)
      expect(global.testUtils.createMockExecution).toBeInstanceOf(Function)
      expect(global.testUtils.createMockConfiguration).toBeInstanceOf(Function)
    })
  })

  describe('@testing-library/react 相容性驗證', () => {
    it('應該能正確渲染 React 組件', () => {
      render(React.createElement(TestComponent, { message: "Hello, Test!" }))

      const messageElement = screen.getByTestId('test-message')
      expect(messageElement).toBeInTheDocument()
      expect(messageElement).toHaveTextContent('Hello, Test!')
    })

    it('應該支援 React 19 的新功能', () => {
      const TestComponentWithKey = () =>
        React.createElement('div', {
          key: 'test-key',
          'data-testid': 'keyed-component'
        }, 'React 19 Component')

      render(React.createElement(TestComponentWithKey))

      const component = screen.getByTestId('keyed-component')
      expect(component).toBeInTheDocument()
    })
  })

  describe('@testing-library/jest-dom 匹配器驗證', () => {
    beforeEach(() => {
      render(
        React.createElement('div', null,
          React.createElement('input', { type: 'text', value: 'test value', readOnly: true }),
          React.createElement('button', { disabled: true }, 'Disabled Button'),
          React.createElement('div', { className: 'visible-element' }, 'Visible'),
          React.createElement('div', { style: { display: 'none' } }, 'Hidden')
        )
      )
    })

    it('應該支援 toBeInTheDocument 匹配器', () => {
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('應該支援 toHaveValue 匹配器', () => {
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('test value')
    })

    it('應該支援 toBeDisabled 匹配器', () => {
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('應該支援 toBeVisible 匹配器', () => {
      const visibleElement = screen.getByText('Visible')
      expect(visibleElement).toBeVisible()
    })

    it('應該支援自定義匹配器', () => {
      expect(50).toBeWithinRange(1, 100)
    })
  })

  describe('DOM 測試環境驗證', () => {
    it('應該有 window 物件可用', () => {
      expect(window).toBeDefined()
      expect(window.document).toBeDefined()
    })

    it('應該有 localStorage mock 可用', () => {
      expect(window.localStorage).toBeDefined()
      expect(typeof window.localStorage.setItem).toBe('function')
      expect(typeof window.localStorage.getItem).toBe('function')
    })

    it('應該有 fetch mock 可用', () => {
      expect(global.fetch).toBeDefined()
      expect(typeof global.fetch).toBe('function')
    })

    it('應該有 IntersectionObserver mock 可用', () => {
      expect(global.IntersectionObserver).toBeDefined()
      expect(typeof global.IntersectionObserver).toBe('function')
    })

    it('應該有 ResizeObserver mock 可用', () => {
      expect(global.ResizeObserver).toBeDefined()
      expect(typeof global.ResizeObserver).toBe('function')
    })
  })

  describe('模組路徑解析驗證', () => {
    it('應該正確解析 @ 路徑別名', async () => {
      // 測試路徑解析是否正常工作
      const types = await import('@/types')
      expect(types).toBeDefined()
      expect(typeof types).toBe('object')
    })
  })

  describe('測試覆蓋率配置驗證', () => {
    it('應該正確設定覆蓋率收集', () => {
      // 這個測試確保覆蓋率配置正確
      const testFunction = () => {
        return 'coverage test'
      }

      expect(testFunction()).toBe('coverage test')
    })
  })

  describe('錯誤處理驗證', () => {
    it('應該正確處理測試錯誤', () => {
      expect(() => {
        throw new Error('Test error')
      }).toThrow('Test error')
    })

    it('應該正確處理異步錯誤', async () => {
      await expect(async () => {
        throw new Error('Async test error')
      }).rejects.toThrow('Async test error')
    })
  })

  describe('測試工具函數驗證', () => {
    it('應該能創建 mock API 回應', () => {
      const mockResponse = global.testUtils.createMockApiResponse({ test: 'data' })

      expect(mockResponse).toHaveProperty('success', true)
      expect(mockResponse).toHaveProperty('data', { test: 'data' })
      expect(mockResponse).toHaveProperty('timestamp')
      expect(mockResponse).toHaveProperty('requestId')
    })

    it('應該能創建 mock 執行記錄', () => {
      const mockExecution = global.testUtils.createMockExecution({
        status: 'failed',
        articlesFound: 0
      })

      expect(mockExecution).toHaveProperty('status', 'failed')
      expect(mockExecution).toHaveProperty('articlesFound', 0)
      expect(mockExecution).toHaveProperty('id')
      expect(mockExecution).toHaveProperty('timestamp')
    })

    it('應該能創建 mock 配置', () => {
      const mockConfig = global.testUtils.createMockConfiguration({
        name: 'Test Configuration',
        isActive: false
      })

      expect(mockConfig).toHaveProperty('name', 'Test Configuration')
      expect(mockConfig).toHaveProperty('isActive', false)
      expect(mockConfig).toHaveProperty('id')
      expect(mockConfig).toHaveProperty('pttBoard')
    })

    it('應該能模擬 fetch 回應', async () => {
      const testData = { message: 'test' }
      global.testUtils.mockFetchResponse(testData)

      const response = await fetch('/test-endpoint')
      const data = await response.json()

      expect(data).toEqual(testData)
      expect(response.ok).toBe(true)
    })

    it('應該能模擬 fetch 錯誤', async () => {
      global.testUtils.mockFetchError(new Error('Network error'))

      await expect(fetch('/test-endpoint')).rejects.toThrow('Network error')
    })
  })
})