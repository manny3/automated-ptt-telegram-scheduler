import { CreateConfigurationRequest, UpdateConfigurationRequest, ScheduleConfig } from '@/types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Validate schedule configuration
 */
function validateSchedule(schedule: ScheduleConfig): ValidationError[] {
  const errors: ValidationError[] = []

  if (!schedule.type || !['hourly', 'daily', 'custom'].includes(schedule.type)) {
    errors.push({
      field: 'schedule.type',
      message: 'Schedule type must be one of: hourly, daily, custom'
    })
  }

  if (schedule.type === 'custom') {
    if (!schedule.interval || schedule.interval < 15 || schedule.interval > 1440) {
      errors.push({
        field: 'schedule.interval',
        message: 'Custom interval must be between 15 and 1440 minutes'
      })
    }
  }

  if (schedule.type === 'daily') {
    if (!schedule.time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.time)) {
      errors.push({
        field: 'schedule.time',
        message: 'Daily schedule time must be in HH:MM format (24-hour)'
      })
    }
  }

  return errors
}

/**
 * Validate keywords array
 */
function validateKeywords(keywords: string[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (!Array.isArray(keywords)) {
    errors.push({
      field: 'keywords',
      message: 'Keywords must be an array'
    })
    return errors
  }

  if (keywords.length === 0) {
    errors.push({
      field: 'keywords',
      message: 'At least one keyword is required'
    })
  }

  if (keywords.length > 20) {
    errors.push({
      field: 'keywords',
      message: 'Maximum 20 keywords allowed'
    })
  }

  keywords.forEach((keyword, index) => {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      errors.push({
        field: `keywords[${index}]`,
        message: 'Each keyword must be a non-empty string'
      })
    }

    if (keyword.length > 50) {
      errors.push({
        field: `keywords[${index}]`,
        message: 'Each keyword must be 50 characters or less'
      })
    }
  })

  return errors
}

/**
 * Validate Telegram chat ID
 */
function validateTelegramChatId(chatId: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!chatId || typeof chatId !== 'string') {
    errors.push({
      field: 'telegramChatId',
      message: 'Telegram chat ID is required'
    })
    return errors
  }

  // Telegram chat IDs can be positive (user/group) or negative (supergroup/channel)
  // They should be numeric strings
  if (!/^-?\d+$/.test(chatId)) {
    errors.push({
      field: 'telegramChatId',
      message: 'Telegram chat ID must be a valid numeric ID'
    })
  }

  return errors
}

/**
 * Validate PTT board name
 */
function validatePttBoard(board: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!board || typeof board !== 'string' || board.trim().length === 0) {
    errors.push({
      field: 'pttBoard',
      message: 'PTT board name is required'
    })
    return errors
  }

  // PTT board names should be alphanumeric with underscores
  if (!/^[a-zA-Z0-9_]+$/.test(board)) {
    errors.push({
      field: 'pttBoard',
      message: 'PTT board name can only contain letters, numbers, and underscores'
    })
  }

  if (board.length > 50) {
    errors.push({
      field: 'pttBoard',
      message: 'PTT board name must be 50 characters or less'
    })
  }

  return errors
}

/**
 * Validate configuration name
 */
function validateName(name: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Configuration name is required'
    })
    return errors
  }

  if (name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Configuration name must be 100 characters or less'
    })
  }

  return errors
}

/**
 * Validate post count
 */
function validatePostCount(postCount: number): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof postCount !== 'number' || !Number.isInteger(postCount)) {
    errors.push({
      field: 'postCount',
      message: 'Post count must be an integer'
    })
    return errors
  }

  if (postCount < 1 || postCount > 100) {
    errors.push({
      field: 'postCount',
      message: 'Post count must be between 1 and 100'
    })
  }

  return errors
}

/**
 * Validate create configuration request
 */
export function validateCreateConfiguration(data: any): ValidationResult {
  const errors: ValidationError[] = []

  // Validate required fields exist
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object' }]
    }
  }

  // Validate each field
  errors.push(...validateName(data.name))
  errors.push(...validatePttBoard(data.pttBoard))
  errors.push(...validateKeywords(data.keywords))
  errors.push(...validatePostCount(data.postCount))
  errors.push(...validateSchedule(data.schedule))
  errors.push(...validateTelegramChatId(data.telegramChatId))

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate update configuration request
 */
export function validateUpdateConfiguration(data: any): ValidationResult {
  const errors: ValidationError[] = []

  // Validate required fields exist
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object' }]
    }
  }

  // Validate each field (all fields are optional for updates, but if present must be valid)
  if (data.name !== undefined) {
    errors.push(...validateName(data.name))
  }

  if (data.pttBoard !== undefined) {
    errors.push(...validatePttBoard(data.pttBoard))
  }

  if (data.keywords !== undefined) {
    errors.push(...validateKeywords(data.keywords))
  }

  if (data.postCount !== undefined) {
    errors.push(...validatePostCount(data.postCount))
  }

  if (data.schedule !== undefined) {
    errors.push(...validateSchedule(data.schedule))
  }

  if (data.telegramChatId !== undefined) {
    errors.push(...validateTelegramChatId(data.telegramChatId))
  }

  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    errors.push({
      field: 'isActive',
      message: 'isActive must be a boolean value'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate configuration ID parameter
 */
export function validateConfigurationId(id: string): ValidationResult {
  const errors: ValidationError[] = []

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    errors.push({
      field: 'id',
      message: 'Configuration ID is required'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}