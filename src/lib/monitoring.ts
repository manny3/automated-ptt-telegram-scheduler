/**
 * 監控和警報系統
 * 
 * 提供應用程式效能監控、錯誤追蹤和警報功能
 */

import { logger } from './logger'

// 指標類型定義
export interface Metric {
  name: string
  value: number
  timestamp: Date
  labels?: Record<string, string>
  unit?: string
}

// 警報等級
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 警報介面
export interface Alert {
  id: string
  level: AlertLevel
  title: string
  message: string
  timestamp: Date
  source: string
  metadata?: Record<string, any>
  resolved?: boolean
  resolvedAt?: Date
}

// 效能指標收集器
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map()
  private readonly maxMetricsPerName = 1000 // 每個指標名稱最多保存 1000 個數據點

  // 記錄指標
  record(name: string, value: number, labels?: Record<string, string>, unit?: string): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      labels,
      unit,
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metricsList = this.metrics.get(name)!
    metricsList.push(metric)

    // 保持指標數量在限制內
    if (metricsList.length > this.maxMetricsPerName) {
      metricsList.shift() // 移除最舊的指標
    }

    // 記錄到日誌系統
    logger.debug(`Metric recorded: ${name}`, {
      component: 'monitoring',
      action: 'record_metric',
      metricName: name,
      metricValue: value,
      labels,
      unit,
    })
  }

  // 增量指標
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.record(name, value, labels, 'count')
  }

  // 計時指標
  timing(name: string, duration: number, labels?: Record<string, string>): void {
    this.record(name, duration, labels, 'ms')
  }

  // 計量指標
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.record(name, value, labels, 'gauge')
  }

  // 取得指標
  getMetrics(name: string, limit?: number): Metric[] {
    const metrics = this.metrics.get(name) || []
    return limit ? metrics.slice(-limit) : metrics
  }

  // 取得所有指標名稱
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys())
  }

  // 計算統計資料
  getStats(name: string, timeWindow?: number): {
    count: number
    sum: number
    avg: number
    min: number
    max: number
    latest: number
  } | null {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return null

    let filteredMetrics = metrics
    if (timeWindow) {
      const cutoff = new Date(Date.now() - timeWindow)
      filteredMetrics = metrics.filter(m => m.timestamp >= cutoff)
    }

    if (filteredMetrics.length === 0) return null

    const values = filteredMetrics.map(m => m.value)
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
    }
  }

  // 清理舊指標
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // 預設 24 小時
    const cutoff = new Date(Date.now() - maxAge)
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoff)
      this.metrics.set(name, filteredMetrics)
    }
  }
}

// 警報管理器
export class AlertManager {
  private alerts: Map<string, Alert> = new Map()
  private alertHandlers: Array<(alert: Alert) => Promise<void>> = []

  // 註冊警報處理器
  registerHandler(handler: (alert: Alert) => Promise<void>): void {
    this.alertHandlers.push(handler)
  }

  // 觸發警報
  async trigger(
    level: AlertLevel,
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const alertId = `${source}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    const alert: Alert = {
      id: alertId,
      level,
      title,
      message,
      timestamp: new Date(),
      source,
      metadata,
      resolved: false,
    }

    this.alerts.set(alertId, alert)

    // 記錄警報
    await logger.warn(`Alert triggered: ${title}`, {
      component: 'monitoring',
      action: 'alert_triggered',
      alertId,
      alertLevel: level,
      alertSource: source,
      ...metadata,
    })

    // 執行所有警報處理器
    for (const handler of this.alertHandlers) {
      try {
        await handler(alert)
      } catch (error) {
        await logger.error('Alert handler failed', {
          component: 'monitoring',
          action: 'alert_handler_failed',
          alertId,
        }, error as Error)
      }
    }

    return alertId
  }

  // 解決警報
  async resolve(alertId: string, message?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) {
      return false
    }

    alert.resolved = true
    alert.resolvedAt = new Date()

    await logger.info(`Alert resolved: ${alert.title}`, {
      component: 'monitoring',
      action: 'alert_resolved',
      alertId,
      resolutionMessage: message,
    })

    return true
  }

  // 取得警報
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId)
  }

  // 取得所有警報
  getAlerts(filter?: {
    level?: AlertLevel
    source?: string
    resolved?: boolean
    since?: Date
  }): Alert[] {
    let alerts = Array.from(this.alerts.values())

    if (filter) {
      if (filter.level) {
        alerts = alerts.filter(a => a.level === filter.level)
      }
      if (filter.source) {
        alerts = alerts.filter(a => a.source === filter.source)
      }
      if (filter.resolved !== undefined) {
        alerts = alerts.filter(a => a.resolved === filter.resolved)
      }
      if (filter.since) {
        alerts = alerts.filter(a => a.timestamp >= filter.since!)
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
}

// 健康檢查器
export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map()
  private lastResults: Map<string, { healthy: boolean; timestamp: Date; error?: string }> = new Map()

  // 註冊健康檢查
  register(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check)
  }

  // 執行單個健康檢查
  async runCheck(name: string): Promise<{ healthy: boolean; error?: string }> {
    const check = this.checks.get(name)
    if (!check) {
      return { healthy: false, error: 'Check not found' }
    }

    try {
      const healthy = await check()
      const result = { healthy, timestamp: new Date() }
      this.lastResults.set(name, result)
      return { healthy }
    } catch (error) {
      const result = { 
        healthy: false, 
        timestamp: new Date(), 
        error: (error as Error).message 
      }
      this.lastResults.set(name, result)
      return { healthy: false, error: (error as Error).message }
    }
  }

  // 執行所有健康檢查
  async runAllChecks(): Promise<Record<string, { healthy: boolean; error?: string }>> {
    const results: Record<string, { healthy: boolean; error?: string }> = {}
    
    const checkPromises = Array.from(this.checks.keys()).map(async (name) => {
      const result = await this.runCheck(name)
      results[name] = result
    })

    await Promise.all(checkPromises)
    return results
  }

  // 取得健康狀態摘要
  getHealthSummary(): {
    overall: boolean
    checks: Record<string, { healthy: boolean; lastCheck: Date; error?: string }>
  } {
    const checks: Record<string, { healthy: boolean; lastCheck: Date; error?: string }> = {}
    let overall = true

    for (const [name, result] of this.lastResults.entries()) {
      checks[name] = {
        healthy: result.healthy,
        lastCheck: result.timestamp,
        error: result.error,
      }
      
      if (!result.healthy) {
        overall = false
      }
    }

    return { overall, checks }
  }
}

// 效能監控器
export class PerformanceMonitor {
  private metricsCollector: MetricsCollector
  private alertManager: AlertManager

  constructor(metricsCollector: MetricsCollector, alertManager: AlertManager) {
    this.metricsCollector = metricsCollector
    this.alertManager = alertManager
  }

  // 監控 API 回應時間
  monitorApiResponse(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.metricsCollector.timing('api_response_time', duration, {
      endpoint,
      method,
      status: statusCode.toString(),
    })

    // 如果回應時間過長，觸發警報
    if (duration > 5000) { // 5 秒
      this.alertManager.trigger(
        AlertLevel.WARNING,
        'Slow API Response',
        `${method} ${endpoint} took ${duration}ms to respond`,
        'performance_monitor',
        { endpoint, method, duration, statusCode }
      )
    }
  }

  // 監控記憶體使用量
  monitorMemoryUsage(): void {
    const memUsage = process.memoryUsage()
    
    this.metricsCollector.gauge('memory_heap_used', memUsage.heapUsed)
    this.metricsCollector.gauge('memory_heap_total', memUsage.heapTotal)
    this.metricsCollector.gauge('memory_rss', memUsage.rss)

    // 如果記憶體使用量過高，觸發警報
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024
    if (heapUsedMB > 500) { // 500MB
      this.alertManager.trigger(
        AlertLevel.WARNING,
        'High Memory Usage',
        `Heap memory usage is ${heapUsedMB.toFixed(2)}MB`,
        'performance_monitor',
        { heapUsedMB, heapTotalMB: memUsage.heapTotal / 1024 / 1024 }
      )
    }
  }

  // 監控錯誤率
  monitorErrorRate(timeWindow: number = 5 * 60 * 1000): void { // 5 分鐘
    const errorStats = this.metricsCollector.getStats('api_errors', timeWindow)
    const requestStats = this.metricsCollector.getStats('api_requests', timeWindow)

    if (errorStats && requestStats && requestStats.count > 0) {
      const errorRate = (errorStats.count / requestStats.count) * 100

      if (errorRate > 10) { // 10% 錯誤率
        this.alertManager.trigger(
          AlertLevel.ERROR,
          'High Error Rate',
          `API error rate is ${errorRate.toFixed(2)}% over the last ${timeWindow / 1000 / 60} minutes`,
          'performance_monitor',
          { errorRate, errorCount: errorStats.count, requestCount: requestStats.count }
        )
      }
    }
  }
}

// 全域實例
export const metricsCollector = new MetricsCollector()
export const alertManager = new AlertManager()
export const healthChecker = new HealthChecker()
export const performanceMonitor = new PerformanceMonitor(metricsCollector, alertManager)

// 預設警報處理器：記錄到日誌
alertManager.registerHandler(async (alert: Alert) => {
  const logLevel = alert.level === AlertLevel.CRITICAL ? 'critical' : 
                   alert.level === AlertLevel.ERROR ? 'error' : 'warn'
  
  await logger[logLevel](`Alert: ${alert.title}`, {
    component: 'alerting',
    action: 'alert_notification',
    alertId: alert.id,
    alertLevel: alert.level,
    alertSource: alert.source,
    alertMessage: alert.message,
    ...alert.metadata,
  })
})

// 註冊基本健康檢查
healthChecker.register('memory', async () => {
  const memUsage = process.memoryUsage()
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024
  return heapUsedMB < 1000 // 小於 1GB
})

healthChecker.register('uptime', async () => {
  return process.uptime() > 0
})

// 定期清理和監控
setInterval(() => {
  metricsCollector.cleanup()
  performanceMonitor.monitorMemoryUsage()
  performanceMonitor.monitorErrorRate()
}, 5 * 60 * 1000) // 每 5 分鐘執行一次

// 匯出監控中介軟體
export function withMonitoring() {
  return function(handler: any) {
    return async (req: any, res: any) => {
      const startTime = Date.now()
      
      // 記錄請求
      metricsCollector.increment('api_requests', 1, {
        method: req.method,
        endpoint: req.url,
      })

      try {
        await handler(req, res)
        
        const duration = Date.now() - startTime
        performanceMonitor.monitorApiResponse(req.url, req.method, duration, res.statusCode)
      } catch (error) {
        metricsCollector.increment('api_errors', 1, {
          method: req.method,
          endpoint: req.url,
        })
        throw error
      }
    }
  }
}