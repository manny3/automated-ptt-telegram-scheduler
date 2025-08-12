// Configuration types
export interface ScrapingConfiguration {
  id: string
  name: string
  pttBoard: string
  keywords: string[]
  postCount: number // 1-100
  schedule: ScheduleConfig
  telegramChatId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastExecuted?: Date
  lastExecutionStatus?: 'success' | 'error' | 'no_articles'
  lastExecutionMessage?: string
}

export interface ScheduleConfig {
  type: 'hourly' | 'daily' | 'custom'
  interval?: number // for custom intervals in minutes
  time?: string // for daily schedules (HH:MM format)
}

// API request/response types
export interface CreateConfigurationRequest {
  name: string
  pttBoard: string
  keywords: string[]
  postCount: number
  schedule: ScheduleConfig
  telegramChatId: string
}

export interface UpdateConfigurationRequest extends CreateConfigurationRequest {
  isActive?: boolean
}

// Execution history types
export interface ExecutionResult {
  id: string
  configurationId: string
  executedAt: Date
  status: 'success' | 'error' | 'no_articles'
  articlesFound: number
  articlesSent: number
  errorMessage?: string
  executionDuration: number
}

// PTT Article types
export interface PTTArticle {
  title: string
  author: string
  date: string
  link: string
  board: string
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ConfigurationListResponse extends ApiResponse {
  data: {
    configurations: ScrapingConfiguration[]
  }
}

export interface ExecutionHistoryResponse extends ApiResponse {
  data: {
    executions: ExecutionResult[]
  }
}