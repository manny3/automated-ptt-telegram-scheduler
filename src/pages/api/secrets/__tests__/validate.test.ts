/**
 * Secret Manager 驗證 API 測試
 */

import { jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import handler from '../validate'
import { SecretManagerError } from '@/lib/secret-manager'

// Mock Secret Manager 函數
const mockValidateSecretAccess = jest.fn()
const mockGetTelegramBotToken = jest.fn()
const mockGetSecretMetadata = jest.fn()

jest.mock('@/lib/secret-manager', () => ({
  validateSecretAccess: mockValidateSecretAccess,
  getTelegramBotToken: mockGetTelegramBotToken,
  getSecretMetadata: mockGetSecretMetadata,
  SecretManagerError: class extends Error {
    constructor(message: string, public statusCode?: number, public retryable: boolean = true) {
      super(message)
      this.name = 'SecretManagerError'
    }
  }
}))

describe('/api/secrets/validate', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    
    // 設定測試環境變數
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN_SECRET_NAME: 'test-telegram-token'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('應該只允許 GET 請求', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(false)
    expect(data.error).toBe('Method not allowed')
  })

  it('應該成功驗證可存取的密鑰', async () => {
    const mockMetadata = {
      name: 'projects/test-project/secrets/test-telegram-token',
      createTime: '1640995200',
      labels: { environment: 'test' }
    }

    mockValidateSecretAccess.mockResolvedValue(true)
    mockGetSecretMetadata.mockResolvedValue(mockMetadata)
    mockGetTelegramBotToken.mockResolvedValue('123456789:ABCdefGHIjklMNOpqrsTUVwxyz')

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(true)
    expect(data.accessible).toBe(true)
    expect(data.secretName).toBe('test-telegram-token')
    expect(data.metadata).toEqual(mockMetadata)
    expect(data.tokenValid).toBe(true)
    expect(data.message).toContain('設定正確且可正常存取')
  })

  it('應該處理無法存取的密鑰', async () => {
    mockValidateSecretAccess.mockResolvedValue(false)

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(true)
    expect(data.accessible).toBe(false)
    expect(data.secretName).toBe('test-telegram-token')
    expect(data.message).toContain('密鑰無法存取')
  })

  it('應該處理可存取但 Token 格式無效的情況', async () => {
    const mockMetadata = {
      name: 'projects/test-project/secrets/test-telegram-token',
      createTime: '1640995200',
      labels: {}
    }

    mockValidateSecretAccess.mockResolvedValue(true)
    mockGetSecretMetadata.mockResolvedValue(mockMetadata)
    mockGetTelegramBotToken.mockRejectedValue(
      new SecretManagerError('Telegram Bot Token 格式無效', 400, false)
    )

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(true)
    expect(data.accessible).toBe(true)
    expect(data.tokenValid).toBe(false)
    expect(data.error).toBe('Telegram Bot Token 格式無效')
    expect(data.message).toContain('Token 格式無效')
  })

  it('應該處理中繼資料取得失敗', async () => {
    mockValidateSecretAccess.mockResolvedValue(true)
    mockGetSecretMetadata.mockRejectedValue(new Error('Metadata access failed'))
    mockGetTelegramBotToken.mockResolvedValue('123456789:ABCdefGHIjklMNOpqrsTUVwxyz')

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(true)
    expect(data.accessible).toBe(true)
    expect(data.metadata).toBeUndefined()
    expect(data.tokenValid).toBe(true)
  })

  it('應該處理 Secret Manager 錯誤', async () => {
    mockValidateSecretAccess.mockRejectedValue(
      new SecretManagerError('沒有權限存取密鑰', 403, false)
    )

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(false)
    expect(data.accessible).toBe(false)
    expect(data.error).toBe('沒有權限存取密鑰')
    expect(data.message).toBe('Secret Manager 操作失敗')
  })

  it('應該處理一般錯誤', async () => {
    mockValidateSecretAccess.mockRejectedValue(new Error('Unexpected error'))

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(false)
    expect(data.accessible).toBe(false)
    expect(data.error).toBe('Unexpected error')
    expect(data.message).toBe('伺服器內部錯誤')
  })

  it('應該使用預設密鑰名稱', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME

    mockValidateSecretAccess.mockResolvedValue(true)
    mockGetTelegramBotToken.mockResolvedValue('123456789:ABCdefGHIjklMNOpqrsTUVwxyz')

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(mockValidateSecretAccess).toHaveBeenCalledWith('telegram-bot-token')
    
    const data = JSON.parse(res._getData())
    expect(data.secretName).toBe('telegram-bot-token')
  })

  it('應該處理 Token 驗證時的非 SecretManagerError', async () => {
    mockValidateSecretAccess.mockResolvedValue(true)
    mockGetTelegramBotToken.mockRejectedValue(new Error('Network error'))

    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    
    expect(data.success).toBe(true)
    expect(data.accessible).toBe(true)
    expect(data.tokenValid).toBe(false)
    expect(data.message).toContain('Token 驗證失敗')
  })
})