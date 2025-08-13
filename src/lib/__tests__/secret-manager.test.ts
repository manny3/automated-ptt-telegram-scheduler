/**
 * Secret Manager 測試套件
 * 
 * 測試 Secret Manager 整合功能，包括：
 * - 密鑰檢索和錯誤處理
 * - 重試邏輯和指數退避
 * - Telegram Bot Token 驗證
 * - 權限和存取控制
 */

import { jest } from '@jest/globals'
import { 
  getSecret, 
  getTelegramBotToken, 
  validateSecretAccess,
  getSecretMetadata,
  listSecrets,
  getSecretManagerClient,
  resetSecretManagerClient,
  SecretManagerError,
  TEST_CONFIG
} from '../secret-manager'

// Mock Google Cloud Secret Manager
const mockAccessSecretVersion = jest.fn()
const mockGetSecret = jest.fn()
const mockListSecrets = jest.fn()

jest.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
    accessSecretVersion: mockAccessSecretVersion,
    getSecret: mockGetSecret,
    listSecrets: mockListSecrets,
  }))
}))

describe('Secret Manager', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    resetSecretManagerClient()
    
    // 設定測試環境變數
    process.env = {
      ...originalEnv,
      GOOGLE_CLOUD_PROJECT: 'test-project',
      TELEGRAM_BOT_TOKEN_SECRET_NAME: 'test-telegram-token'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getSecret', () => {
    it('應該成功取得密鑰', async () => {
      const mockPayload = 'test-secret-value'
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from(mockPayload)
        }
      }])

      const result = await getSecret('test-secret', 3, true)
      
      expect(result).toBe(mockPayload)
      expect(mockAccessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/test-project/secrets/test-secret/versions/latest'
      })
    })

    it('應該在密鑰名稱為空時拋出錯誤', async () => {
      await expect(getSecret('', 3, true)).rejects.toThrow(SecretManagerError)
      await expect(getSecret('   ', 3, true)).rejects.toThrow('密鑰名稱不能為空')
    })

    it('應該在 GOOGLE_CLOUD_PROJECT 未設定時拋出錯誤', async () => {
      delete process.env.GOOGLE_CLOUD_PROJECT

      await expect(getSecret('test-secret', 3, true)).rejects.toThrow(
        'GOOGLE_CLOUD_PROJECT 環境變數未設定'
      )
    })

    it('應該在密鑰不存在時拋出錯誤', async () => {
      const error = new Error('Secret not found')
      error.code = 5 // NOT_FOUND
      mockAccessSecretVersion.mockRejectedValue(error)

      await expect(getSecret('nonexistent-secret', 3, true)).rejects.toThrow(
        '密鑰 nonexistent-secret 不存在'
      )
    })

    it('應該在沒有權限時拋出錯誤', async () => {
      const error = new Error('Permission denied')
      error.code = 7 // PERMISSION_DENIED
      mockAccessSecretVersion.mockRejectedValue(error)

      await expect(getSecret('restricted-secret', 3, true)).rejects.toThrow(
        '沒有權限存取密鑰 restricted-secret'
      )
    })

    it('應該在密鑰為空時拋出錯誤', async () => {
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: null
        }
      }])

      await expect(getSecret('empty-secret', 3, true)).rejects.toThrow(
        '密鑰 empty-secret 為空或不存在'
      )
    })

    it('應該實作重試邏輯', async () => {
      const error = new Error('Temporary failure')
      error.code = 14 // UNAVAILABLE
      
      mockAccessSecretVersion
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue([{
          payload: {
            data: Buffer.from('success-after-retry')
          }
        }])

      const result = await getSecret('retry-test', 3, true)
      
      expect(result).toBe('success-after-retry')
      expect(mockAccessSecretVersion).toHaveBeenCalledTimes(3)
    })

    it('應該在重試次數用盡後拋出錯誤', async () => {
      const error = new Error('Persistent failure')
      error.code = 14 // UNAVAILABLE
      mockAccessSecretVersion.mockRejectedValue(error)

      await expect(getSecret('failing-secret', 2, true)).rejects.toThrow(
        '取得密鑰 failing-secret 失敗，經過 3 次嘗試'
      )
      
      expect(mockAccessSecretVersion).toHaveBeenCalledTimes(3) // 初始嘗試 + 2 次重試
    })
  })

  describe('getTelegramBotToken', () => {
    it('應該成功取得有效的 Telegram Bot Token', async () => {
      const validToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from(validToken)
        }
      }])

      const result = await getTelegramBotToken(true)
      
      expect(result).toBe(validToken)
      expect(mockAccessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/test-project/secrets/test-telegram-token/versions/latest'
      })
    })

    it('應該使用預設密鑰名稱', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME
      
      const validToken = '987654321:XYZabcDEFghiJKLmnoPQRstuvw'
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from(validToken)
        }
      }])

      await getTelegramBotToken(true)
      
      expect(mockAccessSecretVersion).toHaveBeenCalledWith({
        name: 'projects/test-project/secrets/telegram-bot-token/versions/latest'
      })
    })

    it('應該在 Token 格式無效時拋出錯誤', async () => {
      const invalidToken = 'invalid-token-format'
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from(invalidToken)
        }
      }])

      await expect(getTelegramBotToken(true)).rejects.toThrow(
        'Telegram Bot Token 格式無效'
      )
    })

    it('應該接受各種有效的 Token 格式', async () => {
      const validTokens = [
        '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
        '987654321:XYZ-abc_DEF123',
        '555666777:aaa111BBB222ccc333DDD444'
      ]

      for (const token of validTokens) {
        mockAccessSecretVersion.mockResolvedValue([{
          payload: {
            data: Buffer.from(token)
          }
        }])

        const result = await getTelegramBotToken(true)
        expect(result).toBe(token)
      }
    })
  })

  describe('validateSecretAccess', () => {
    it('應該在密鑰可存取時回傳 true', async () => {
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from('accessible-secret')
        }
      }])

      const result = await validateSecretAccess('accessible-secret')
      
      expect(result).toBe(true)
    })

    it('應該在密鑰不可存取時回傳 false', async () => {
      const error = new Error('Access denied')
      error.code = 7 // PERMISSION_DENIED
      mockAccessSecretVersion.mockRejectedValue(error)

      const result = await validateSecretAccess('inaccessible-secret')
      
      expect(result).toBe(false)
    })
  })

  describe('getSecretMetadata', () => {
    it('應該成功取得密鑰中繼資料', async () => {
      const mockMetadata = {
        name: 'projects/test-project/secrets/test-secret',
        createTime: { seconds: '1640995200' },
        labels: { environment: 'test', team: 'backend' }
      }
      
      mockGetSecret.mockResolvedValue([mockMetadata])

      const result = await getSecretMetadata('test-secret')
      
      expect(result).toEqual({
        name: 'projects/test-project/secrets/test-secret',
        createTime: '1640995200',
        labels: { environment: 'test', team: 'backend' }
      })
    })

    it('應該處理缺少中繼資料的情況', async () => {
      mockGetSecret.mockResolvedValue([{
        name: 'projects/test-project/secrets/minimal-secret'
      }])

      const result = await getSecretMetadata('minimal-secret')
      
      expect(result).toEqual({
        name: 'projects/test-project/secrets/minimal-secret',
        createTime: undefined,
        labels: {}
      })
    })

    it('應該在取得中繼資料失敗時拋出錯誤', async () => {
      const error = new Error('Metadata access failed')
      mockGetSecret.mockRejectedValue(error)

      await expect(getSecretMetadata('failing-secret')).rejects.toThrow(
        '無法取得密鑰中繼資料'
      )
    })
  })

  describe('listSecrets', () => {
    it('應該成功列出所有密鑰', async () => {
      const mockSecrets = [
        { name: 'projects/test-project/secrets/secret1' },
        { name: 'projects/test-project/secrets/secret2' },
        { name: 'projects/test-project/secrets/telegram-bot-token' }
      ]
      
      mockListSecrets.mockResolvedValue([mockSecrets])

      const result = await listSecrets()
      
      expect(result).toEqual(['secret1', 'secret2', 'telegram-bot-token'])
      expect(mockListSecrets).toHaveBeenCalledWith({
        parent: 'projects/test-project'
      })
    })

    it('應該處理空的密鑰列表', async () => {
      mockListSecrets.mockResolvedValue([[]])

      const result = await listSecrets()
      
      expect(result).toEqual([])
    })

    it('應該過濾無效的密鑰名稱', async () => {
      const mockSecrets = [
        { name: 'projects/test-project/secrets/valid-secret' },
        { name: '' }, // 無效名稱
        { name: 'projects/test-project/secrets/another-valid-secret' },
        {} // 沒有名稱屬性
      ]
      
      mockListSecrets.mockResolvedValue([mockSecrets])

      const result = await listSecrets()
      
      expect(result).toEqual(['valid-secret', 'another-valid-secret'])
    })

    it('應該在列出密鑰失敗時拋出錯誤', async () => {
      const error = new Error('List operation failed')
      mockListSecrets.mockRejectedValue(error)

      await expect(listSecrets()).rejects.toThrow('無法列出密鑰')
    })
  })

  describe('getSecretManagerClient', () => {
    it('應該回傳單例客戶端實例', () => {
      const client1 = getSecretManagerClient()
      const client2 = getSecretManagerClient()
      
      expect(client1).toBe(client2)
    })

    it('應該在重設後建立新的客戶端實例', () => {
      const client1 = getSecretManagerClient()
      resetSecretManagerClient()
      const client2 = getSecretManagerClient()
      
      expect(client1).not.toBe(client2)
    })
  })

  describe('SecretManagerError', () => {
    it('應該正確建立錯誤實例', () => {
      const error = new SecretManagerError('測試錯誤', 404, false)
      
      expect(error.message).toBe('測試錯誤')
      expect(error.statusCode).toBe(404)
      expect(error.retryable).toBe(false)
      expect(error.name).toBe('SecretManagerError')
    })

    it('應該使用預設值', () => {
      const error = new SecretManagerError('預設錯誤')
      
      expect(error.statusCode).toBeUndefined()
      expect(error.retryable).toBe(true)
    })
  })

  describe('整合測試', () => {
    it('應該處理完整的 Token 檢索流程', async () => {
      const validToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
      
      // 模擬成功的密鑰檢索
      mockAccessSecretVersion.mockResolvedValue([{
        payload: {
          data: Buffer.from(validToken)
        }
      }])

      // 模擬成功的存取驗證
      const isAccessible = await validateSecretAccess('test-telegram-token')
      expect(isAccessible).toBe(true)

      // 取得實際 Token
      const token = await getTelegramBotToken(true)
      expect(token).toBe(validToken)

      // 驗證呼叫次數
      expect(mockAccessSecretVersion).toHaveBeenCalledTimes(2)
    })

    it('應該處理權限錯誤的完整流程', async () => {
      const permissionError = new Error('Permission denied')
      permissionError.code = 7
      mockAccessSecretVersion.mockRejectedValue(permissionError)

      // 驗證存取應該失敗
      const isAccessible = await validateSecretAccess('restricted-secret')
      expect(isAccessible).toBe(false)

      // Token 檢索應該拋出錯誤
      await expect(getTelegramBotToken(true)).rejects.toThrow(
        '沒有權限存取密鑰'
      )
    })
  })
})