/**
 * 警報管理 API 端點
 * 
 * 提供警報查詢、觸發和解決功能
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation, BadRequestError } from '@/lib/api-error-handler'
import { alertManager, AlertLevel } from '@/lib/monitoring'

interface AlertsQuery {
  level?: AlertLevel
  source?: string
  resolved?: boolean
  since?: string
  limit?: number
}

interface CreateAlertRequest {
  level: AlertLevel
  title: string
  message: string
  source: string
  metadata?: Record<string, any>
}

interface ResolveAlertRequest {
  message?: string
}

async function alertsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case 'GET':
      return handleGetAlerts(req, res)
    case 'POST':
      return handleCreateAlert(req, res)
    case 'PUT':
      return handleResolveAlert(req, res)
    default:
      throw new BadRequestError(`Method ${req.method} not supported`)
  }
}

async function handleGetAlerts(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query: AlertsQuery = {
    level: req.query.level as AlertLevel,
    source: req.query.source as string,
    resolved: req.query.resolved ? req.query.resolved === 'true' : undefined,
    since: req.query.since as string,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  }

  const filter: any = {}
  
  if (query.level) filter.level = query.level
  if (query.source) filter.source = query.source
  if (query.resolved !== undefined) filter.resolved = query.resolved
  if (query.since) filter.since = new Date(query.since)

  let alerts = alertManager.getAlerts(filter)
  
  if (query.limit) {
    alerts = alerts.slice(0, query.limit)
  }

  const summary = {
    total: alerts.length,
    byLevel: alerts.reduce((acc, alert) => {
      acc[alert.level] = (acc[alert.level] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    bySource: alerts.reduce((acc, alert) => {
      acc[alert.source] = (acc[alert.source] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    resolved: alerts.filter(a => a.resolved).length,
    unresolved: alerts.filter(a => !a.resolved).length,
  }

  ;(res as any).success({
    alerts,
    summary,
    query,
  }, 'Alerts retrieved successfully')
}

async function handleCreateAlert(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const alertData: CreateAlertRequest = req.body

  // 驗證必要欄位
  if (!alertData.level || !alertData.title || !alertData.message || !alertData.source) {
    throw new BadRequestError('Missing required fields: level, title, message, source')
  }

  // 驗證警報等級
  if (!Object.values(AlertLevel).includes(alertData.level)) {
    throw new BadRequestError(`Invalid alert level: ${alertData.level}`)
  }

  const alertId = await alertManager.trigger(
    alertData.level,
    alertData.title,
    alertData.message,
    alertData.source,
    alertData.metadata
  )

  const alert = alertManager.getAlert(alertId)

  ;(res as any).success({
    alertId,
    alert,
  }, 'Alert created successfully')
}

async function handleResolveAlert(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const alertId = req.query.id as string
  const resolveData: ResolveAlertRequest = req.body

  if (!alertId) {
    throw new BadRequestError('Alert ID is required')
  }

  const resolved = await alertManager.resolve(alertId, resolveData.message)

  if (!resolved) {
    throw new BadRequestError('Alert not found or already resolved')
  }

  const alert = alertManager.getAlert(alertId)

  ;(res as any).success({
    alertId,
    alert,
  }, 'Alert resolved successfully')
}

export default withMethodValidation(['GET', 'POST', 'PUT'])(
  withErrorHandler(alertsHandler)
)