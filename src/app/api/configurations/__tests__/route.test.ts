import { jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

// Mock the Firestore functions
jest.mock('@/lib/firestore', () => ({
  getAllConfigurations: jest.fn(),
  createConfiguration: jest.fn(),
}))

// Mock the validation functions
jest.mock('@/lib/validation', () => ({
  validateCreateConfiguration: jest.fn(),
}))

import { getAllConfigurations, createConfiguration } from '@/lib/firestore'
import { validateCreateConfiguration } from '@/lib/validation'

const mockGetAllConfigurations = getAllConfigurations as jest.MockedFunction<typeof getAllConfigurations>
const mockCreateConfiguration = createConfiguration as jest.MockedFunction<typeof createConfiguration>
const mockValidateCreateConfiguration = validateCreateConfiguration as jest.MockedFunction<typeof validateCreateConfiguration>

describe('/api/configurations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return all configurations successfully', async () => {
      const mockConfigurations = [
        {
          id: '1',
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
      ]

      mockGetAllConfigurations.mockResolvedValue(mockConfigurations)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.configurations).toEqual(mockConfigurations)
      expect(mockGetAllConfigurations).toHaveBeenCalledTimes(1)
    })

    it('should handle database errors', async () => {
      mockGetAllConfigurations.mockRejectedValue(new Error('Database error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch configurations')
    })
  })

  describe('POST', () => {
    const validConfigData = {
      name: 'Test Config',
      pttBoard: 'Tech_Job',
      keywords: ['python', 'backend'],
      postCount: 20,
      schedule: { type: 'daily', time: '09:00' },
      telegramChatId: '123456789'
    }

    it('should create configuration successfully', async () => {
      const mockCreatedConfig = {
        id: 'new-id',
        ...validConfigData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockValidateCreateConfiguration.mockReturnValue({
        isValid: true,
        errors: []
      })
      mockCreateConfiguration.mockResolvedValue(mockCreatedConfig)

      const request = new NextRequest('http://localhost:3000/api/configurations', {
        method: 'POST',
        body: JSON.stringify(validConfigData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.configuration).toEqual(mockCreatedConfig)
      expect(mockValidateCreateConfiguration).toHaveBeenCalledWith(validConfigData)
      expect(mockCreateConfiguration).toHaveBeenCalledWith({
        name: 'Test Config',
        pttBoard: 'Tech_Job',
        keywords: ['python', 'backend'],
        postCount: 20,
        schedule: { type: 'daily', time: '09:00' },
        telegramChatId: '123456789'
      })
    })

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        name: '',
        pttBoard: 'Tech_Job',
        keywords: [],
        postCount: 0,
        schedule: { type: 'invalid' },
        telegramChatId: ''
      }

      mockValidateCreateConfiguration.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Configuration name is required' },
          { field: 'keywords', message: 'At least one keyword is required' },
          { field: 'postCount', message: 'Post count must be between 1 and 100' }
        ]
      })

      const request = new NextRequest('http://localhost:3000/api/configurations', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed')
      expect(data.data.errors).toHaveLength(3)
      expect(mockCreateConfiguration).not.toHaveBeenCalled()
    })

    it('should handle database errors during creation', async () => {
      mockValidateCreateConfiguration.mockReturnValue({
        isValid: true,
        errors: []
      })
      mockCreateConfiguration.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/configurations', {
        method: 'POST',
        body: JSON.stringify(validConfigData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create configuration')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/configurations', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create configuration')
    })
  })
})