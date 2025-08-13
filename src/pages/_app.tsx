/**
 * Next.js 應用程式根組件
 * 
 * 包含全域錯誤處理、監控和樣式設定
 */

import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { CriticalErrorBoundary } from '@/components/ErrorBoundary'
import { logger } from '@/lib/logger'
import { metricsCollector, performanceMonitor } from '@/lib/monitoring'
import '@/styles/globals.css'

// 全域錯誤處理
if (typeof window !== 'undefined') {
  // 處理未捕獲的 Promise 拒絕
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      component: 'global',
      action: 'unhandled_rejection',
      url: window.location.href,
      userAgent: navigator.userAgent,
    }, event.reason)

    // 記錄錯誤指標
    metricsCollector.increment('unhandled_errors', 1, {
      type: 'promise_rejection',
      url: window.location.pathname,
    })

    // 防止預設的控制台錯誤訊息
    event.preventDefault()
  })

  // 處理未捕獲的 JavaScript 錯誤
  window.addEventListener('error', (event) => {
    logger.error('Unhandled JavaScript error', {
      component: 'global',
      action: 'unhandled_error',
      url: window.location.href,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      userAgent: navigator.userAgent,
    }, event.error)

    // 記錄錯誤指標
    metricsCollector.increment('unhandled_errors', 1, {
      type: 'javascript_error',
      url: window.location.pathname,
    })
  })

  // 監控頁面效能
  if ('performance' in window && 'getEntriesByType' in performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.fetchStart
          const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
          const firstPaint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')
          const firstContentfulPaint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')

          // 記錄頁面載入指標
          metricsCollector.timing('page_load_time', loadTime, {
            url: window.location.pathname,
          })

          metricsCollector.timing('dom_content_loaded', domContentLoaded, {
            url: window.location.pathname,
          })

          if (firstPaint) {
            metricsCollector.timing('first_paint', firstPaint.startTime, {
              url: window.location.pathname,
            })
          }

          if (firstContentfulPaint) {
            metricsCollector.timing('first_contentful_paint', firstContentfulPaint.startTime, {
              url: window.location.pathname,
            })
          }

          logger.info('Page performance metrics recorded', {
            component: 'performance',
            action: 'page_load',
            url: window.location.pathname,
            loadTime,
            domContentLoaded,
            firstPaint: firstPaint?.startTime,
            firstContentfulPaint: firstContentfulPaint?.startTime,
          })
        }
      }, 0)
    })
  }
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // 記錄應用程式啟動
    logger.info('Application started', {
      component: 'app',
      action: 'startup',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
    })

    // 記錄頁面瀏覽
    metricsCollector.increment('page_views', 1, {
      url: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    })

    // 監控記憶體使用量（僅在瀏覽器中）
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory
      metricsCollector.gauge('browser_memory_used', memory.usedJSHeapSize, {
        url: window.location.pathname,
      })
      metricsCollector.gauge('browser_memory_total', memory.totalJSHeapSize, {
        url: window.location.pathname,
      })
    }

    // 設定定期健康檢查（每 5 分鐘）
    const healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/health')
        const health = await response.json()
        
        metricsCollector.increment('health_checks', 1, {
          status: health.success ? 'healthy' : 'unhealthy',
        })

        if (!health.success) {
          logger.warn('Health check failed', {
            component: 'app',
            action: 'health_check_failed',
            error: health.error,
          })
        }
      } catch (error) {
        logger.error('Health check request failed', {
          component: 'app',
          action: 'health_check_error',
        }, error as Error)
      }
    }, 5 * 60 * 1000) // 5 分鐘

    // 清理函數
    return () => {
      clearInterval(healthCheckInterval)
    }
  }, [])

  // 處理路由變更
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      logger.info('Route changed', {
        component: 'app',
        action: 'route_change',
        url,
      })

      metricsCollector.increment('route_changes', 1, {
        url,
      })
    }

    // 如果使用 Next.js Router，可以監聽路由變更
    if (typeof window !== 'undefined') {
      const router = require('next/router').default
      router.events.on('routeChangeComplete', handleRouteChange)
      
      return () => {
        router.events.off('routeChangeComplete', handleRouteChange)
      }
    }
  }, [])

  return (
    <CriticalErrorBoundary>
      <Component {...pageProps} />
    </CriticalErrorBoundary>
  )
}