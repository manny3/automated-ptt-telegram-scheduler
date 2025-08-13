/**
 * API 錯誤處理中介軟體
 * 
 * 提供統一的 API 錯誤處理、回應格式化和狀態碼管理
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from './logger'
import { DatabaseError, ValidationError, PermissionError } from './database-error-handler'

// API 錯誤回應介面
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

// API 成功回應介面
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
  requestId?: string
}

// API 回應類型
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

// 自訂 API 錯誤類別
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 特定 API 錯誤類別
export class BadRequestError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BAD_REQUEST', details)
    this.name = 'BadRequestError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details)
    this.name = 'ConflictError'
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS')
    this.name = 'TooManyRequestsError'
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR')
    this.name = 'InternalServerError'
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE')
    this.name = 'ServiceUnavailableError'
  }
}

// 錯誤分類和轉換
function classifyError(error: any): ApiError {
  // 如果已經是 ApiError，直接返回
  if (error instanceof ApiError) {
    return error
  }

  // 資料庫錯誤轉換
  if (error instanceof ValidationError) {
    return new BadRequestError(error.message, { field: error.field })
  }

  if (error instanceof PermissionError) {
    return new ForbiddenError(error.message)
  }

  if (error instanceof DatabaseError) {
    if (error.code === 'NOT_FOUND') {
      return new NotFoundError(error.message)
    }
    if (error.code === 'ALREADY_EXISTS') {
      return new ConflictError(error.message)
    }
    if (error.code === 'UNAVAILABLE') {
      return new ServiceUnavailableError('Database temporarily unavailable')
    }
    return new InternalServerError('Database operation failed')
  }

  // HTTP 錯誤轉換
  if (error.response?.status) {
    const status = error.response.status
    const message = error.response.data?.message || error.message

    switch (status) {
      case 400:
        return new BadRequestError(message)
      case 401:
        return new UnauthorizedError(message)
      case 403:
        return new ForbiddenError(message)
      case 404:
        return new NotFoundError(message)
      case 409:
        return new ConflictError(message)
      case 429:
        return new TooManyRequestsError(message)
      case 503:
        return new ServiceUnavailableError(message)
      default:
        return new InternalServerError(message)
    }
  }

  // 預設為內部伺服器錯誤
  return new InternalServerError(error.message || 'An unexpected error occurred')
}

// 建立錯誤回應
function createErrorResponse(
  error: ApiError,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  }
}

// 建立成功回應
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  }
}

// API 錯誤處理中介軟體
export function withErrorHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now()
    const requestId = req.headers['x-request-id'] as string || 
                     Math.random().toString(36).substring(7)

    try {
      // 在請求物件中加入輔助方法
      ;(req as any).requestId = requestId
      ;(res as any).success = <T>(data: T, message?: string) => {
        const response = createSuccessResponse(data, message, requestId)
        res.status(200).json(response)
      }
      ;(res as any).error = (error: Error | ApiError, statusCode?: number) => {
        const apiError = error instanceof ApiError ? error : classifyError(error)
        if (statusCode) {
          apiError.statusCode = statusCode
        }
        const response = createErrorResponse(apiError, requestId)
        res.status(apiError.statusCode).json(response)
      }

      await handler(req, res)
    } catch (error: any) {
      const duration = Date.now() - startTime
      const apiError = classifyError(error)

      // 記錄錯誤
      await logger.error(`API error in ${req.method} ${req.url}`, {
        component: 'api',
        action: `${req.method}_${req.url}`,
        requestId,
        statusCode: apiError.statusCode,
        errorCode: apiError.code,
        duration,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      }, apiError)

      // 發送錯誤回應
      if (!res.headersSent) {
        const response = createErrorResponse(apiError, requestId)
        res.status(apiError.statusCode).json(response)
      }
    }
  }
}

// 方法驗證中介軟體
export function withMethodValidation(allowedMethods: string[]) {
  return function(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
      if (!allowedMethods.includes(req.method!)) {
        throw new ApiError(
          `Method ${req.method} not allowed`,
          405,
          'METHOD_NOT_ALLOWED'
        )
      }
      await handler(req, res)
    })
  }
}

// 請求驗證中介軟體
export function withValidation<T>(
  validator: (data: any) => T,
  source: 'body' | 'query' = 'body'
) {
  return function(
    handler: (req: NextApiRequest & { validated: T }, res: NextApiResponse) => Promise<void>
  ) {
    return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        const data = source === 'body' ? req.body : req.query
        const validated = validator(data)
        ;(req as any).validated = validated
        await handler(req as any, res)
      } catch (error: any) {
        throw new BadRequestError('Validation failed', {
          message: error.message,
          source,
        })
      }
    })
  }
}

// 速率限制中介軟體
export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 分鐘
) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return function(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
      const clientId = req.headers['x-forwarded-for'] as string || 
                      req.connection.remoteAddress || 
                      'unknown'
      
      const now = Date.now()
      const clientData = requests.get(clientId)

      if (!clientData || now > clientData.resetTime) {
        // 重設或建立新的計數器
        requests.set(clientId, {
          count: 1,
          resetTime: now + windowMs,
        })
      } else {
        // 增加請求計數
        clientData.count++
        
        if (clientData.count > maxRequests) {
          await logger.warn('Rate limit exceeded', {
            component: 'api',
            action: 'rate_limit_exceeded',
            clientId,
            requestCount: clientData.count,
            maxRequests,
            windowMs,
          })
          
          throw new TooManyRequestsError(
            `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000} seconds.`
          )
        }
      }

      await handler(req, res)
    })
  }
}

// 認證中介軟體 (基本版本)
export function withAuth(
  authValidator?: (req: NextApiRequest) => Promise<boolean>
) {
  return function(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
      // 如果提供了自訂驗證器，使用它
      if (authValidator) {
        const isAuthenticated = await authValidator(req)
        if (!isAuthenticated) {
          throw new UnauthorizedError('Authentication required')
        }
      } else {
        // 基本的 API 金鑰驗證
        const apiKey = req.headers['x-api-key'] as string
        const expectedApiKey = process.env.API_KEY
        
        if (expectedApiKey && apiKey !== expectedApiKey) {
          throw new UnauthorizedError('Invalid API key')
        }
      }

      await handler(req, res)
    })
  }
}

// 組合多個中介軟體
export function withMiddleware(
  ...middlewares: Array<(handler: any) => any>
) {
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    )
  }
}

// 健康檢查中介軟體
export function withHealthCheck() {
  return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    }

    ;(res as any).success(health, 'Service is healthy')
  })
}

// CORS 中介軟體
export function withCors(
  allowedOrigins: string[] = ['*'],
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
) {
  return function(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
      const origin = req.headers.origin as string
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*')
      }
      
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '))
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
      res.setHeader('Access-Control-Max-Age', '86400') // 24 小時

      if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
      }

      await handler(req, res)
    })
  }
}