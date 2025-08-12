import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../route'

// Mock the Firestore functions
jest.mock('@/lib/firestore', () => ({
  getConfigurationById: jest.fn(),
  updateConfiguration: jest.fn(),
  deleteConfiguration: jest.fn(),
}))

// Mock the validation functions
jest.mock('@/lib/validation', () => ({
  validateUpdateConfiguration: jest.fn(),
  validateConfigurationId: jest.fn(),
}))

import { 
  getConfigurationById, 
  updateConfiguration, 
  deleteConfiguration 
} from '@/lib/firestore'
import { 
  validateUpdateConfiguration, 
  validateConfigurationId 
} from '@/lib/validation'

const mockGetConfigurationById = getConfigurationById as jest.MockedFunction<typeof getConfigurationById>
const mockUpdateConfiguration = updateConfiguration as jest.MockedFunction<typeof updateConfiguration>
const mockDeleteConfiguration = deleteConfiguration as jest.MockedFunction<typeof deleteConfiguration>
const mockValidateUpdateConfiguration = validateUpdateConfiguration as jest.MockedFunction<typeof validateUpdateConfiguration>
const mockValidateConfigurationId = validateConfigurationId as jest.MockedFunction<typeof validateConfigurationId>

describe('/api/configurations/[id]', () => {
  const mockConfiguration = {
    id: 'test-id',
    name: 'Test Config',
    pttBoard: 'Tech_Job',
    keywords: ['python'],
    postCount: 10,
    schedule: { type: 'daily' as const, time: '09:00' },
    telegramChatId: '123456789',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateConfigurationId.mockReturnValue({ isValid: true, errors: [] })
  })

  describe('GET', () => {
    it('should return configuration successfully', async () => {
      mockGetConfigurationById.mockResolvedValue(mockConfiguration)

      const response = await GET(
        new NextRequest('http://localhost:3000/api/configurations/test-id'),
        { params: Promise.resolve({ id: 'test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.configuration).toEqual(mockConfiguration)
      expect(mockGetConfigurationById).toHaveBeenCalledWith('test-id')
    })

    it('should return 404 when configuration not found', async () => {
      mockGetConfigurationById.mockResolvedValue(null)

      const response = await GET(
        new NextRequest('http://localhost:3000/api/configurations/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Configuration not found')
    })

    it('should return 400 for invalid ID', async () => {
      mockValidateConfigurationId.mockReturnValue({
        isValid: false,
        errors: [{ field: 'id', message: 'Configuration ID is required' }]
      })

      const response = await GET(
        new NextRequest('http://localhost:3000/api/configurations/'),
        { params: Promise.resolve({ id: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid configuration ID')
    })
  })

  describe('PUT', () => {
    const updateData = {
      name: 'Updated Config',
      postCount: 25,
      isActive: false
    }

    it('should update configuration successfully', async () => {
      const updatedConfig = { ...mockConfiguration, ...updateData }
      
      mockGetConfigurationById.mockResolvedValue(mockConfiguration)
      mockValidateUpdateConfiguration.mockReturnValue({ isValid: true, errors: [] })
      mockUpdateConfiguration.mockResolvedValue(updatedConfig)

      const request = new NextRequest('http://localhost:3000/api/configurations/test-id', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(
        request,
        { params: Promise.resolve({ id: 'test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.configuration).toEqual(updatedConfig)
      expect(mockUpdateConfiguration).toHaveBeenCalledWith('test-id', {
        name: 'Updated Config',
        postCount: 25,
        isActive: false
      })
    })

    it('should return 404 when configuration not found', async () => {
      mockGetConfigurationById.mockResolvedValue(null)
      mockValidateUpdateConfiguration.mockReturnValue({ isValid: true, errors: [] })

      const request = new NextRequest('http://localhost:3000/api/configurations/nonexistent', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(
        request,
        { params: Promise.resolve({ id: 'nonexistent' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Configuration not found')
      expect(mockUpdateConfiguration).not.toHaveBeenCalled()
    })

    it('should return validation errors for invalid data', async () => {
      const invalidData = { postCount: 0 }
      
      mockValidateUpdateConfiguration.mockReturnValue({
        isValid: false,
        errors: [{ field: 'postCount', message: 'Post count must be between 1 and 100' }]
      })

      const request = new NextRequest('http://localhost:3000/api/configurations/test-id', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(
        request,
        { params: Promise.resolve({ id: 'test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed')
      expect(mockUpdateConfiguration).not.toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it('should delete configuration successfully', async () => {
      mockGetConfigurationById.mockResolvedValue(mockConfiguration)
      mockDeleteConfiguration.mockResolvedValue(undefined)

      const response = await DELETE(
        new NextRequest('http://localhost:3000/api/configurations/test-id'),
        { params: Promise.resolve({ id: 'test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Configuration deleted successfully')
      expect(mockDeleteConfiguration).toHaveBeenCalledWith('test-id')
    })

    it('should return 404 when configuration not found', async () => {
      mockGetConfigurationById.mockResolvedValue(null)

      const response = await DELETE(
        new NextRequest('http://localhost:3000/api/configurations/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Configuration not found')
      expect(mockDeleteConfiguration).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockGetConfigurationById.mockResolvedValue(mockConfiguration)
      mockDeleteConfiguration.mockRejectedValue(new Error('Database error'))

      const response = await DELETE(
        new NextRequest('http://localhost:3000/api/configurations/test-id'),
        { params: Promise.resolve({ id: 'test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to delete configuration')
    })
  })
})