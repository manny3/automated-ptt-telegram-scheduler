/**
 * 結構化日誌記錄系統
 * 
 * 提供統一的日誌記錄介面，支援不同環境和日誌等級
 * 整合 Google Cloud Logging 和本地開發日誌
 */

import { Logging } from '@google-cloud/logging'

// 日誌等級定義
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 日誌上下文介面
export interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  configurationId?: string
  executionId?: string
  component?: string
  action?: string
  duration?: number
  [key: string]: any
}

// 日誌項目介面
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    code?: string | number
  }
  metadata?: Record<string, any>
}

// 日誌記錄器類別
class Logger {
  private gcpLogging: Logging | null = null
  private logName: string
  private isProduction: boolean
  private minLogLevel: LogLevel

  constructor() {
    this.logName = process.env.LOG_NAME || 'ptt-telegram-scheduler'
    this.isProduction = process.env.NODE_ENV === 'production'
    this.minLogLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info')
    
    // 在生產環境中初始化 Google Cloud Logging
    if (this.isProduction && process.env.GOOGLE_CLOUD_PROJECT) {
      try {
        this.gcpLogging = new Logging({
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
        })
      } catch (error) {
        console.error('Failed to initialize Google Cloud Logging:', error)
      }
    }
  }

  private parseLogLevel(level: string): LogLevel {
    const normalizedLevel = level.toLowerCase()
    return Object.values(LogLevel).includes(normalizedLevel as LogLevel)
      ? (normalizedLevel as LogLevel)
      : LogLevel.INFO
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL]
    const currentLevelIndex = levels.indexOf(this.minLogLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code || (error as any).statusCode,
      }
    }

    return entry
  }

  private async writeToGCP(entry: LogEntry): Promise<void> {
    if (!this.gcpLogging) return

    try {
      const log = this.gcpLogging.log(this.logName)
      
      const metadata = {
        resource: {
          type: 'cloud_run_revision',
          labels: {
            service_name: process.env.K_SERVICE || 'ptt-telegram-scheduler',
            revision_name: process.env.K_REVISION || 'unknown',
            location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
          },
        },
        severity: entry.level.toUpperCase(),
        timestamp: entry.timestamp,
        labels: {
          component: entry.context?.component || 'unknown',
          action: entry.context?.action || 'unknown',
        },
      }

      const logEntry = log.entry(metadata, {
        message: entry.message,
        context: entry.context,
        error: entry.error,
        metadata: entry.metadata,
      })

      await log.write(logEntry)
    } catch (error) {
      console.error('Failed to write to Google Cloud Logging:', error)
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const colorMap = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
    }

    const resetColor = '\x1b[0m'
    const color = colorMap[entry.level] || ''

    const logMessage = this.isProduction
      ? JSON.stringify(entry)
      : `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${resetColor}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry.context || '')
        break
      case LogLevel.INFO:
        console.info(logMessage, entry.context || '')
        break
      case LogLevel.WARN:
        console.warn(logMessage, entry.context || '', entry.error || '')
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage, entry.context || '', entry.error || '')
        break
    }
  }

  private async log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    if (!this.shouldLog(level)) return

    const entry = this.createLogEntry(level, message, context, error)

    // 寫入控制台
    this.writeToConsole(entry)

    // 在生產環境中寫入 Google Cloud Logging
    if (this.isProduction) {
      await this.writeToGCP(entry)
    }
  }

  // 公開方法
  async debug(message: string, context?: LogContext): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context)
  }

  async info(message: string, context?: LogContext): Promise<void> {
    await this.log(LogLevel.INFO, message, context)
  }

  async warn(message: string, context?: LogContext, error?: Error): Promise<void> {
    await this.log(LogLevel.WARN, message, context, error)
  }

  async error(message: string, context?: LogContext, error?: Error): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, error)
  }

  async critical(message: string, context?: LogContext, error?: Error): Promise<void> {
    await this.log(LogLevel.CRITICAL, message, context, error)
  }

  // 效能監控
  async logPerformance(
    action: string,
    duration: number,
    context?: LogContext
  ): Promise<void> {
    await this.info(`Performance: ${action} completed`, {
      ...context,
      action,
      duration,
      component: context?.component || 'performance',
    })
  }

  // 使用者活動記錄
  async logUserActivity(
    userId: string,
    action: string,
    context?: LogContext
  ): Promise<void> {
    await this.info(`User activity: ${action}`, {
      ...context,
      userId,
      action,
      component: 'user-activity',
    })
  }

  // API 請求記錄
  async logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): Promise<void> {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO

    await this.log(level, `API ${method} ${path} - ${statusCode}`, {
      ...context,
      component: 'api',
      action: `${method} ${path}`,
      duration,
      statusCode,
    })
  }

  // 資料庫操作記錄
  async logDatabaseOperation(
    operation: string,
    collection: string,
    duration: number,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    const level = error ? LogLevel.ERROR : LogLevel.DEBUG

    await this.log(level, `Database ${operation} on ${collection}`, {
      ...context,
      component: 'database',
      action: `${operation}_${collection}`,
      duration,
      collection,
    }, error)
  }

  // 外部 API 呼叫記錄
  async logExternalApiCall(
    service: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    const level = error || statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO

    await this.log(level, `External API call to ${service}${endpoint}`, {
      ...context,
      component: 'external-api',
      action: `call_${service}`,
      duration,
      statusCode,
      service,
      endpoint,
    }, error)
  }
}

// 單例模式的日誌記錄器實例
export const logger = new Logger()

// 中介軟體工廠函數
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()
    const requestId = req.headers['x-request-id'] || 
                     req.headers['x-cloud-trace-context']?.split('/')[0] ||
                     Math.random().toString(36).substring(7)

    // 在請求物件中加入日誌記錄器
    req.logger = {
      debug: (message: string, context?: LogContext) => 
        logger.debug(message, { ...context, requestId }),
      info: (message: string, context?: LogContext) => 
        logger.info(message, { ...context, requestId }),
      warn: (message: string, context?: LogContext, error?: Error) => 
        logger.warn(message, { ...context, requestId }, error),
      error: (message: string, context?: LogContext, error?: Error) => 
        logger.error(message, { ...context, requestId }, error),
    }

    // 記錄請求開始
    logger.debug(`Request started: ${req.method} ${req.url}`, {
      requestId,
      component: 'http',
      action: 'request_start',
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    })

    // 攔截回應結束
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime
      
      logger.logApiRequest(
        req.method,
        req.url,
        res.statusCode,
        duration,
        { requestId }
      )

      originalEnd.apply(res, args)
    }

    next()
  }
}

// 錯誤記錄工具函數
export function logError(
  error: Error,
  context?: LogContext,
  level: LogLevel = LogLevel.ERROR
): void {
  logger.log(level, `Error occurred: ${error.message}`, context, error)
}

// 效能計時器
export class PerformanceTimer {
  private startTime: number
  private action: string
  private context?: LogContext

  constructor(action: string, context?: LogContext) {
    this.startTime = Date.now()
    this.action = action
    this.context = context
  }

  async end(): Promise<number> {
    const duration = Date.now() - this.startTime
    await logger.logPerformance(this.action, duration, this.context)
    return duration
  }
}

// 裝飾器工廠函數（用於類別方法）
export function logMethod(component: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const timer = new PerformanceTimer(`${component}.${propertyName}`, {
        component,
        action: propertyName,
      })

      try {
        const result = await method.apply(this, args)
        await timer.end()
        return result
      } catch (error) {
        await timer.end()
        await logger.error(`Method ${component}.${propertyName} failed`, {
          component,
          action: propertyName,
        }, error as Error)
        throw error
      }
    }
  }
}