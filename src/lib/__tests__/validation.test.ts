import {
  validateCreateConfiguration,
  validateUpdateConfiguration,
  validateConfigurationId,
} from '../validation'

describe('Validation Functions', () => {
  describe('validateCreateConfiguration', () => {
    const validData = {
      name: 'Test Configuration',
      pttBoard: 'Tech_Job',
      keywords: ['python', 'backend', '工程師'],
      postCount: 20,
      schedule: { type: 'daily', time: '09:00' },
      telegramChatId: '123456789'
    }

    it('should validate correct data', () => {
      const result = validateCreateConfiguration(validData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject null or undefined data', () => {
      const result1 = validateCreateConfiguration(null)
      const result2 = validateCreateConfiguration(undefined)
      
      expect(result1.isValid).toBe(false)
      expect(result2.isValid).toBe(false)
      expect(result1.errors[0].field).toBe('body')
      expect(result2.errors[0].field).toBe('body')
    })

    describe('name validation', () => {
      it('should reject empty name', () => {
        const data = { ...validData, name: '' }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'name')).toBe(true)
      })

      it('should reject name longer than 100 characters', () => {
        const data = { ...validData, name: 'a'.repeat(101) }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'name')).toBe(true)
      })
    })

    describe('pttBoard validation', () => {
      it('should reject empty board name', () => {
        const data = { ...validData, pttBoard: '' }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'pttBoard')).toBe(true)
      })

      it('should reject board name with invalid characters', () => {
        const data = { ...validData, pttBoard: 'Tech-Job!' }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'pttBoard')).toBe(true)
      })

      it('should accept valid board names', () => {
        const validBoards = ['Tech_Job', 'Gossiping', 'NBA', 'Stock_123']
        
        validBoards.forEach(board => {
          const data = { ...validData, pttBoard: board }
          const result = validateCreateConfiguration(data)
          
          expect(result.errors.filter(e => e.field === 'pttBoard')).toHaveLength(0)
        })
      })
    })

    describe('keywords validation', () => {
      it('should reject empty keywords array', () => {
        const data = { ...validData, keywords: [] }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'keywords')).toBe(true)
      })

      it('should reject non-array keywords', () => {
        const data = { ...validData, keywords: 'not an array' as any }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'keywords')).toBe(true)
      })

      it('should reject too many keywords', () => {
        const data = { ...validData, keywords: Array(21).fill('keyword') }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'keywords')).toBe(true)
      })

      it('should reject empty keyword strings', () => {
        const data = { ...validData, keywords: ['valid', '', 'also valid'] }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field.startsWith('keywords['))).toBe(true)
      })

      it('should reject keywords that are too long', () => {
        const data = { ...validData, keywords: ['a'.repeat(51)] }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'keywords[0]')).toBe(true)
      })
    })

    describe('postCount validation', () => {
      it('should reject non-integer values', () => {
        const data1 = { ...validData, postCount: 10.5 }
        const data2 = { ...validData, postCount: 'ten' as any }
        
        const result1 = validateCreateConfiguration(data1)
        const result2 = validateCreateConfiguration(data2)
        
        expect(result1.isValid).toBe(false)
        expect(result2.isValid).toBe(false)
        expect(result1.errors.some(e => e.field === 'postCount')).toBe(true)
        expect(result2.errors.some(e => e.field === 'postCount')).toBe(true)
      })

      it('should reject values outside 1-100 range', () => {
        const data1 = { ...validData, postCount: 0 }
        const data2 = { ...validData, postCount: 101 }
        
        const result1 = validateCreateConfiguration(data1)
        const result2 = validateCreateConfiguration(data2)
        
        expect(result1.isValid).toBe(false)
        expect(result2.isValid).toBe(false)
        expect(result1.errors.some(e => e.field === 'postCount')).toBe(true)
        expect(result2.errors.some(e => e.field === 'postCount')).toBe(true)
      })

      it('should accept valid post counts', () => {
        const validCounts = [1, 50, 100]
        
        validCounts.forEach(count => {
          const data = { ...validData, postCount: count }
          const result = validateCreateConfiguration(data)
          
          expect(result.errors.filter(e => e.field === 'postCount')).toHaveLength(0)
        })
      })
    })

    describe('schedule validation', () => {
      it('should reject invalid schedule types', () => {
        const data = { ...validData, schedule: { type: 'invalid' as any } }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'schedule.type')).toBe(true)
      })

      it('should validate custom schedule intervals', () => {
        const data1 = { ...validData, schedule: { type: 'custom', interval: 10 } }
        const data2 = { ...validData, schedule: { type: 'custom', interval: 1500 } }
        const data3 = { ...validData, schedule: { type: 'custom', interval: 60 } }
        
        const result1 = validateCreateConfiguration(data1)
        const result2 = validateCreateConfiguration(data2)
        const result3 = validateCreateConfiguration(data3)
        
        expect(result1.isValid).toBe(false) // too small
        expect(result2.isValid).toBe(false) // too large
        expect(result3.isValid).toBe(true)  // valid
      })

      it('should validate daily schedule times', () => {
        const data1 = { ...validData, schedule: { type: 'daily', time: '25:00' } }
        const data2 = { ...validData, schedule: { type: 'daily', time: '12:60' } }
        const data3 = { ...validData, schedule: { type: 'daily', time: '14:30' } }
        
        const result1 = validateCreateConfiguration(data1)
        const result2 = validateCreateConfiguration(data2)
        const result3 = validateCreateConfiguration(data3)
        
        expect(result1.isValid).toBe(false) // invalid hour
        expect(result2.isValid).toBe(false) // invalid minute
        expect(result3.isValid).toBe(true)  // valid
      })
    })

    describe('telegramChatId validation', () => {
      it('should reject empty chat ID', () => {
        const data = { ...validData, telegramChatId: '' }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'telegramChatId')).toBe(true)
      })

      it('should reject non-numeric chat IDs', () => {
        const data = { ...validData, telegramChatId: 'not-numeric' }
        const result = validateCreateConfiguration(data)
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(e => e.field === 'telegramChatId')).toBe(true)
      })

      it('should accept valid chat IDs', () => {
        const validIds = ['123456789', '-123456789', '0']
        
        validIds.forEach(id => {
          const data = { ...validData, telegramChatId: id }
          const result = validateCreateConfiguration(data)
          
          expect(result.errors.filter(e => e.field === 'telegramChatId')).toHaveLength(0)
        })
      })
    })
  })

  describe('validateUpdateConfiguration', () => {
    it('should allow partial updates', () => {
      const partialData = {
        name: 'Updated Name',
        postCount: 50
      }
      
      const result = validateUpdateConfiguration(partialData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate isActive field', () => {
      const data1 = { isActive: true }
      const data2 = { isActive: false }
      const data3 = { isActive: 'true' as any }
      
      const result1 = validateUpdateConfiguration(data1)
      const result2 = validateUpdateConfiguration(data2)
      const result3 = validateUpdateConfiguration(data3)
      
      expect(result1.isValid).toBe(true)
      expect(result2.isValid).toBe(true)
      expect(result3.isValid).toBe(false)
      expect(result3.errors.some(e => e.field === 'isActive')).toBe(true)
    })

    it('should validate provided fields with same rules as create', () => {
      const invalidData = {
        name: '',
        postCount: 0,
        keywords: []
      }
      
      const result = validateUpdateConfiguration(invalidData)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('validateConfigurationId', () => {
    it('should accept valid IDs', () => {
      const result = validateConfigurationId('valid-id-123')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty IDs', () => {
      const result1 = validateConfigurationId('')
      const result2 = validateConfigurationId('   ')
      
      expect(result1.isValid).toBe(false)
      expect(result2.isValid).toBe(false)
      expect(result1.errors.some(e => e.field === 'id')).toBe(true)
      expect(result2.errors.some(e => e.field === 'id')).toBe(true)
    })
  })
})