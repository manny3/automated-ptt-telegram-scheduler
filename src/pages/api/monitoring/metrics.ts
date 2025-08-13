/**
 * 指標 API 端點
 * 
 * 提供系統指標查詢和匯出功能
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withErrorHandler, withMethodValidation } from '@/lib/api-error-handler'
import { metricsCollector } from '@/lib/monitoring'
import { errorRecoveryManager } from '@/lib/error-recovery'

interface MetricsQuery {
  names?: string[]
  timeWindow?: number
  format?: 'json' | 'prometheus'
  limit?: number
}

async function metricsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query: MetricsQuery = {
    names: req.query.names ? (Array.isArray(req.query.names) ? req.query.names : [req.query.names]) : undefined,
    timeWindow: req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined,
    format: (req.query.format as 'json' | 'prometheus') || 'json',
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  }

  if (query.format === 'prometheus') {
    return handlePrometheusFormat(req, res, query)
  }

  // JSON 格式回應
  const metricNames = query.names || metricsCollector.getMetricNames()
  const metricsData: Record<string, any> = {}

  for (const name of metricNames) {
    const metrics = metricsCollector.getMetrics(name, query.limit)
    const stats = metricsCollector.getStats(name, query.timeWindow)
    
    metricsData[name] = {
      metrics: metrics.map(m => ({
        value: m.value,
        timestamp: m.timestamp,
        labels: m.labels,
        unit: m.unit,
      })),
      stats,
      count: metrics.length,
    }
  }

  // 包含斷路器狀態
  const circuitBreakerStats = errorRecoveryManager.getCircuitBreakerStats()

  const response = {
    timestamp: new Date().toISOString(),
    timeWindow: query.timeWindow,
    metrics: metricsData,
    circuitBreakers: circuitBreakerStats,
    summary: {
      totalMetrics: metricNames.length,
      totalDataPoints: Object.values(metricsData).reduce((sum, data: any) => sum + data.count, 0),
      circuitBreakersCount: Object.keys(circuitBreakerStats).length,
    }
  }

  ;(res as any).success(response, 'Metrics retrieved successfully')
}

function handlePrometheusFormat(
  req: NextApiRequest,
  res: NextApiResponse,
  query: MetricsQuery
) {
  const metricNames = query.names || metricsCollector.getMetricNames()
  let prometheusOutput = ''

  for (const name of metricNames) {
    const stats = metricsCollector.getStats(name, query.timeWindow)
    if (!stats) continue

    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_')
    
    // 添加指標說明
    prometheusOutput += `# HELP ${sanitizedName} ${name} metric\n`
    prometheusOutput += `# TYPE ${sanitizedName} gauge\n`
    
    // 添加統計資料
    prometheusOutput += `${sanitizedName}_count ${stats.count}\n`
    prometheusOutput += `${sanitizedName}_sum ${stats.sum}\n`
    prometheusOutput += `${sanitizedName}_avg ${stats.avg}\n`
    prometheusOutput += `${sanitizedName}_min ${stats.min}\n`
    prometheusOutput += `${sanitizedName}_max ${stats.max}\n`
    prometheusOutput += `${sanitizedName}_latest ${stats.latest}\n`
    prometheusOutput += '\n'
  }

  // 添加斷路器指標
  const circuitBreakerStats = errorRecoveryManager.getCircuitBreakerStats()
  for (const [name, stats] of Object.entries(circuitBreakerStats)) {
    const sanitizedName = `circuit_breaker_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`
    
    prometheusOutput += `# HELP ${sanitizedName}_state Circuit breaker state (0=closed, 1=half_open, 2=open)\n`
    prometheusOutput += `# TYPE ${sanitizedName}_state gauge\n`
    
    const stateValue = (stats as any).state === 'closed' ? 0 : 
                      (stats as any).state === 'half_open' ? 1 : 2
    prometheusOutput += `${sanitizedName}_state ${stateValue}\n`
    prometheusOutput += `${sanitizedName}_failure_count ${(stats as any).failureCount}\n`
    prometheusOutput += '\n'
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.status(200).send(prometheusOutput)
}

export default withMethodValidation(['GET'])(
  withErrorHandler(metricsHandler)
)