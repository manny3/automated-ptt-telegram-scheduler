import { jest } from '@jest/globals'

// Mock Firestore
const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
}

const mockCollection = {
  add: jest.fn(),
  doc: jest.fn(),
  get: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}

const mockDoc = {
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: true,
  id: 'test-id',
  data: jest.fn(),
}

const mockQuery = {
  get: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}

// Setup mock chain
mockFirestore.collection.mockReturnValue(mockCollection)
mockCollection.doc.mockReturnValue(mockDoc)
mockCollection.where.mockReturnValue(mockQuery)
mockCollection.orderBy.mockReturnValue(mockQuery)
mockCollection.limit.mockReturnValue(mockQuery)
mockQuery.where.mockReturnValue(mockQuery)
mockQuery.orderBy.mockReturnValue(mockQuery)
mockQuery.limit.mockReturnValue(mockQuery)

jest.mock('@google-cloud/firestore', () => ({
  Firestore: jest.fn(() => mockFirestore),
}))

// Mock environment variables
process.env.GOOGLE_CLOUD_PROJECT = 'test-project'

import {
  createConfiguration,
  getAllConfigurations,
  getActiveConfigurations,
  getConfigurationById,
  updateConfiguration,
  deleteConfiguration,
  updateConfigurationStatus,
  createExecution,
  getExecutionHistory,
  getRecentExecutions,
  getExecutionStats,
} from '../firestore'

import { CreateConfigurationRequest, UpdateConfigurationRequest } from '@/types'

describe('Firestore Configuration Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockConfigData: CreateConfigurationRequest = {
    name: 'Test Config',
    pttBoard: 'Tech_Job',
    keywords: ['python', 'backend'],
    postCount: 20,
    schedule: { type: 'daily', time: '09:00' },
    telegramChatId: '123456789',
  }

  const mockConfigResponse = {
    id: 'test-id',
    ...mockConfigData,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  }

  describe('createConfiguration', () => {
    it('should create a new configuration successfully', async () => {
      mockCollection.add.mockResolvedValue({ get: () => Promise.resolve(mockDoc) })
      mockDoc.get.mockResolvedValue(mockDoc)
      mockDoc.data.mockReturnValue({
        ...mockConfigData,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      })

      const result = await createConfiguration(mockConfigData)

      expect(mockCollection.add).toHaveBeenCalledWith({
        ...mockConfigData,
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
      expect(result.name).toBe(mockConfigData.name)
      expect(result.isActive).toBe(true)
    })

    it('should throw error when creation fails', async () => {
      mockCollection.add.mockRejectedValue(new Error('Database error'))

      await expect(createConfiguration(mockConfigData)).rejects.toThrow(
        'Failed to create configuration'
      )
    })
  })

  describe('getAllConfigurations', () => {
    it('should return all configurations', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          callback(mockDoc)
        }),
      }
      mockQuery.get.mockResolvedValue(mockSnapshot)
      mockDoc.data.mockReturnValue(mockConfigResponse)

      const result = await getAllConfigurations()

      expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe(mockConfigData.name)
    })
  })

  describe('getActiveConfigurations', () => {
    it('should return only active configurations', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          callback(mockDoc)
        }),
      }
      mockQuery.get.mockResolvedValue(mockSnapshot)
      mockDoc.data.mockReturnValue(mockConfigResponse)

      const result = await getActiveConfigurations()

      expect(mockCollection.where).toHaveBeenCalledWith('isActive', '==', true)
      expect(result).toHaveLength(1)
    })
  })

  describe('updateConfiguration', () => {
    it('should update configuration successfully', async () => {
      const updateData: UpdateConfigurationRequest = {
        ...mockConfigData,
        name: 'Updated Config',
        isActive: false,
      }

      mockDoc.update.mockResolvedValue(undefined)
      mockDoc.get.mockResolvedValue(mockDoc)
      mockDoc.data.mockReturnValue({ ...mockConfigResponse, ...updateData })

      const result = await updateConfiguration('test-id', updateData)

      expect(mockDoc.update).toHaveBeenCalledWith({
        ...updateData,
        updatedAt: expect.any(Date),
      })
      expect(result.name).toBe('Updated Config')
    })
  })

  describe('deleteConfiguration', () => {
    it('should delete configuration successfully', async () => {
      mockDoc.delete.mockResolvedValue(undefined)

      await deleteConfiguration('test-id')

      expect(mockCollection.doc).toHaveBeenCalledWith('test-id')
      expect(mockDoc.delete).toHaveBeenCalled()
    })
  })
})

describe('Firestore Execution Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockExecutionData = {
    id: 'exec-id',
    configurationId: 'config-id',
    executedAt: new Date('2024-01-01T09:00:00Z'),
    status: 'success' as const,
    articlesFound: 5,
    articlesSent: 5,
    executionDuration: 2.5,
  }

  describe('createExecution', () => {
    it('should create execution record successfully', async () => {
      mockCollection.add.mockResolvedValue({ get: () => Promise.resolve(mockDoc) })
      mockDoc.get.mockResolvedValue(mockDoc)
      mockDoc.data.mockReturnValue(mockExecutionData)

      const result = await createExecution('config-id', 'success', 5, 5, 2.5)

      expect(mockCollection.add).toHaveBeenCalledWith({
        configurationId: 'config-id',
        executedAt: expect.any(Date),
        status: 'success',
        articlesFound: 5,
        articlesSent: 5,
        executionDuration: 2.5,
        errorMessage: null,
      })
      expect(result.status).toBe('success')
    })
  })

  describe('getExecutionHistory', () => {
    it('should return execution history for configuration', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          callback(mockDoc)
        }),
      }
      mockQuery.get.mockResolvedValue(mockSnapshot)
      mockDoc.data.mockReturnValue(mockExecutionData)

      const result = await getExecutionHistory('config-id', 10)

      expect(mockCollection.where).toHaveBeenCalledWith('configurationId', '==', 'config-id')
      expect(mockQuery.orderBy).toHaveBeenCalledWith('executedAt', 'desc')
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
      expect(result).toHaveLength(1)
    })
  })

  describe('getExecutionStats', () => {
    it('should return execution statistics', async () => {
      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          // Simulate multiple executions
          callback(mockDoc) // success
          callback({ ...mockDoc, data: () => ({ ...mockExecutionData, status: 'error' }) })
        }),
      }
      mockQuery.get.mockResolvedValue(mockSnapshot)
      mockDoc.data.mockReturnValue(mockExecutionData)

      const result = await getExecutionStats('config-id')

      expect(result.totalExecutions).toBe(2)
      expect(result.successfulExecutions).toBe(1)
      expect(result.failedExecutions).toBe(1)
      expect(result.totalArticlesSent).toBe(10) // 5 + 5
    })
  })
})