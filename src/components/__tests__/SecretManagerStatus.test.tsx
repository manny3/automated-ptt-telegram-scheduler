/**
 * SecretManagerStatus 組件測試
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import SecretManagerStatus from '../SecretManagerStatus'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('SecretManagerStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('應該顯示載入狀態', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // 永不解析的 Promise
    
    render(<SecretManagerStatus />)
    
    expect(screen.getByText('正在驗證 Secret Manager 設定...')).toBeInTheDocument()
    expect(screen.getByText('驗證中...')).toBeInTheDocument()
  })

  it('應該顯示成功狀態', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: true,
      message: 'Telegram Bot Token 設定正確且可正常存取'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('Telegram Bot Token 設定正確且可正常存取')).toBeInTheDocument()
    })

    // 檢查成功圖示（綠色勾選）
    const successIcon = screen.getByRole('button', { name: /重新驗證/ }).parentElement?.querySelector('.text-green-500')
    expect(successIcon).toBeInTheDocument()
  })

  it('應該顯示無法存取的錯誤狀態', async () => {
    const mockResponse = {
      success: true,
      accessible: false,
      secretName: 'telegram-bot-token',
      message: '密鑰無法存取，請檢查權限設定'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('密鑰無法存取，請檢查權限設定')).toBeInTheDocument()
    })

    // 檢查錯誤圖示（紅色 X）
    const errorIcon = screen.getByRole('button', { name: /重新驗證/ }).parentElement?.querySelector('.text-red-500')
    expect(errorIcon).toBeInTheDocument()
  })

  it('應該顯示 Token 格式無效的警告狀態', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: false,
      error: 'Telegram Bot Token 格式無效',
      message: '密鑰可存取但 Token 格式無效'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('密鑰可存取但 Token 格式無效')).toBeInTheDocument()
    })

    // 檢查警告圖示（黃色三角形）
    const warningIcon = screen.getByRole('button', { name: /重新驗證/ }).parentElement?.querySelector('.text-yellow-500')
    expect(warningIcon).toBeInTheDocument()
  })

  it('應該顯示詳細資訊', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'test-telegram-token',
      tokenValid: true,
      message: 'Token 設定正確',
      metadata: {
        name: 'projects/test-project/secrets/test-telegram-token',
        createTime: '1640995200',
        labels: { environment: 'test', team: 'backend' }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus showDetails={true} />)

    await waitFor(() => {
      expect(screen.getByText('test-telegram-token')).toBeInTheDocument()
      expect(screen.getByText('可存取')).toBeInTheDocument()
      expect(screen.getByText('有效')).toBeInTheDocument()
      expect(screen.getByText('environment: test')).toBeInTheDocument()
      expect(screen.getByText('team: backend')).toBeInTheDocument()
    })
  })

  it('應該處理網路錯誤', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('驗證失敗: Network error')).toBeInTheDocument()
    })
  })

  it('應該處理 API 錯誤回應', async () => {
    const mockResponse = {
      success: false,
      accessible: false,
      error: 'Permission denied'
    }

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('驗證失敗: Permission denied')).toBeInTheDocument()
    })
  })

  it('應該支援重新驗證功能', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: true,
      message: 'Token 設定正確'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    // 等待初始載入完成
    await waitFor(() => {
      expect(screen.getByText('Token 設定正確')).toBeInTheDocument()
    })

    // 點擊重新驗證按鈕
    const refreshButton = screen.getByRole('button', { name: /重新驗證/ })
    fireEvent.click(refreshButton)

    // 驗證 fetch 被呼叫兩次（初始載入 + 重新驗證）
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('應該呼叫 onStatusChange 回調', async () => {
    const mockOnStatusChange = jest.fn()
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: true,
      message: 'Token 設定正確'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus onStatusChange={mockOnStatusChange} />)

    await waitFor(() => {
      expect(mockOnStatusChange).toHaveBeenCalledWith(true)
    })
  })

  it('應該在錯誤時呼叫 onStatusChange 為 false', async () => {
    const mockOnStatusChange = jest.fn()
    
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<SecretManagerStatus onStatusChange={mockOnStatusChange} />)

    await waitFor(() => {
      expect(mockOnStatusChange).toHaveBeenCalledWith(false)
    })
  })

  it('應該顯示設定建議', async () => {
    const mockResponse = {
      success: true,
      accessible: false,
      secretName: 'telegram-bot-token',
      message: '密鑰無法存取'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('設定建議')).toBeInTheDocument()
      expect(screen.getByText(/確認 Secret Manager 中存在名為/)).toBeInTheDocument()
      expect(screen.getByText(/檢查服務帳戶是否有 Secret Manager 存取權限/)).toBeInTheDocument()
    })
  })

  it('應該顯示 Token 格式錯誤的建議', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: false,
      error: 'Token 格式無效',
      message: 'Token 格式錯誤'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('設定建議')).toBeInTheDocument()
      expect(screen.getByText(/確認 Telegram Bot Token 格式正確/)).toBeInTheDocument()
      expect(screen.getByText(/從 @BotFather 重新取得 Token/)).toBeInTheDocument()
    })
  })

  it('應該顯示錯誤詳情', async () => {
    const mockResponse = {
      success: true,
      accessible: true,
      secretName: 'telegram-bot-token',
      tokenValid: false,
      error: '詳細錯誤訊息',
      message: 'Token 驗證失敗'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    render(<SecretManagerStatus />)

    await waitFor(() => {
      expect(screen.getByText('錯誤詳情:')).toBeInTheDocument()
      expect(screen.getByText('詳細錯誤訊息')).toBeInTheDocument()
    })
  })

  it('應該套用自訂 className', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        accessible: true,
        tokenValid: true,
        message: 'OK'
      })
    })

    const { container } = render(<SecretManagerStatus className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})