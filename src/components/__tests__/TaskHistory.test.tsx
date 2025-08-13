/**
 * TaskHistory 組件測試
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import TaskHistory from '../TaskHistory'

// Mock fetch
global.fetch = jest.fn()

const mockExecutionData = {
  success: true,
  data: {
    executions: [
      {
        id: 'exec1',
        configurationId: 'config1',
        configurationName: 'Test Config',
        timestamp: '2023-12-01T10:00:00Z',
        status: 'success',
        articlesFound: 5,
        articlesSent: 5,
        errorMessage: null,
        executionTime: 2000,
        pttBoard: 'Gossiping',
        keywords: ['test'],
        telegramChatId: '123456789',
        details: {
          scrapingDuration: 1000,
          telegramDeliveryDuration: 1000,
          articles: [
            {
              title: 'Test Article 1',
              author: 'testuser1',
              url: 'https://ptt.cc/test1',
              sent: true,
            },
            {
              title: 'Test Article 2',
              author: 'testuser2',
              url: 'https://ptt.cc/test2',
              sent: false,
              error: 'Telegram API error',
            },
          ],
        },
      },
      {
        id: 'exec2',
        configurationId: 'config1',
        configurationName: 'Test Config',
        timestamp: '2023-12-01T09:00:00Z',
        status: 'error',
        articlesFound: 0,
        articlesSent: 0,
        errorMessage: 'PTT scraping failed',
        executionTime: 500,
        pttBoard: 'Gossiping',
        keywords: ['test'],
        telegramChatId: '123456789',
      },
    ],
    stats: {
      totalExecutions: 2,
      successCount: 1,
      errorCount: 1,
      partialCount: 0,
      totalArticlesFound: 5,
      totalArticlesSent: 5,
      averageExecutionTime: 1250,
    },
    pagination: {
      limit: 20,
      offset: 0,
      total: 2,
      hasMore: false,
    },
  },
}

describe('TaskHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockExecutionData),
    })
  })

  it('應該渲染執行歷史列表', async () => {
    render(<TaskHistory configurationId="config1" configurationName="Test Config" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
      expect(screen.getByText('配置：Test Config')).toBeInTheDocument()
    })

    // 檢查統計資料
    expect(screen.getByText('總執行次數')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    // 檢查執行記錄
    expect(screen.getByText('找到 5 篇')).toBeInTheDocument()
    expect(screen.getByText('發送 5 篇')).toBeInTheDocument()
    expect(screen.getByText('PTT scraping failed')).toBeInTheDocument()
  })

  it('應該支援篩選功能', async () => {
    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 點擊篩選按鈕
    fireEvent.click(screen.getByText('篩選'))

    // 檢查篩選器是否顯示
    expect(screen.getByText('狀態')).toBeInTheDocument()
    expect(screen.getByText('開始日期')).toBeInTheDocument()
    expect(screen.getByText('結束日期')).toBeInTheDocument()
    expect(screen.getByText('排序')).toBeInTheDocument()

    // 選擇狀態篩選
    const statusSelect = screen.getByDisplayValue('全部')
    fireEvent.change(statusSelect, { target: { value: 'success' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=success')
      )
    })
  })

  it('應該支援展開執行詳情', async () => {
    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 點擊展開按鈕
    const expandButtons = screen.getAllByRole('button')
    const expandButton = expandButtons.find(button => 
      button.querySelector('svg')?.classList.contains('h-5')
    )
    
    if (expandButton) {
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('執行詳情')).toBeInTheDocument()
        expect(screen.getByText('PTT 看板：')).toBeInTheDocument()
        expect(screen.getByText('Gossiping')).toBeInTheDocument()
        expect(screen.getByText('關鍵字：')).toBeInTheDocument()
        expect(screen.getByText('test')).toBeInTheDocument()
      })

      // 檢查文章列表
      expect(screen.getByText('文章列表')).toBeInTheDocument()
      expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      expect(screen.getByText('Test Article 2')).toBeInTheDocument()
      expect(screen.getByText('Telegram API error')).toBeInTheDocument()
    }
  })

  it('應該支援更新功能', async () => {
    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 點擊更新按鈕
    fireEvent.click(screen.getByText('更新'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2) // 初始載入 + 手動更新
    })
  })

  it('應該處理載入狀態', () => {
    ;(fetch as jest.Mock).mockImplementation(() => new Promise(() => {})) // 永不解析

    render(<TaskHistory configurationId="config1" />)

    expect(screen.getByText('更新中...')).toBeInTheDocument()
  })

  it('應該處理錯誤狀態', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({
        success: false,
        error: { message: 'Failed to fetch data' },
      }),
    })

    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument()
    })
  })

  it('應該處理網路錯誤', async () => {
    ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('Network error while fetching execution history')).toBeInTheDocument()
    })
  })

  it('應該支援自動更新', async () => {
    jest.useFakeTimers()

    render(<TaskHistory configurationId="config1" autoRefresh={true} refreshInterval={5000} />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 快進時間
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2) // 初始載入 + 自動更新
    })

    jest.useRealTimers()
  })

  it('應該顯示空狀態', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          executions: [],
          stats: {
            totalExecutions: 0,
            successCount: 0,
            errorCount: 0,
            partialCount: 0,
            totalArticlesFound: 0,
            totalArticlesSent: 0,
            averageExecutionTime: 0,
          },
          pagination: {
            limit: 20,
            offset: 0,
            total: 0,
            hasMore: false,
          },
        },
      }),
    })

    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('沒有執行記錄')).toBeInTheDocument()
      expect(screen.getByText('此配置尚未執行過任何任務。')).toBeInTheDocument()
    })
  })

  it('應該支援載入更多', async () => {
    const mockDataWithMore = {
      ...mockExecutionData,
      data: {
        ...mockExecutionData.data,
        pagination: {
          ...mockExecutionData.data.pagination,
          hasMore: true,
        },
      },
    }

    ;(fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockDataWithMore),
    })

    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 檢查載入更多按鈕
    expect(screen.getByText('載入更多')).toBeInTheDocument()

    // 點擊載入更多
    fireEvent.click(screen.getByText('載入更多'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      )
    })
  })

  it('應該正確格式化時間和持續時間', async () => {
    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 檢查時間格式化
    expect(screen.getByText(/2023\/12\/01/)).toBeInTheDocument()
    
    // 檢查持續時間格式化
    expect(screen.getByText('執行時間：2.0s')).toBeInTheDocument()
    expect(screen.getByText('執行時間：500ms')).toBeInTheDocument()
  })

  it('應該正確顯示狀態圖標和顏色', async () => {
    render(<TaskHistory configurationId="config1" />)

    await waitFor(() => {
      expect(screen.getByText('執行歷史')).toBeInTheDocument()
    })

    // 檢查成功狀態
    const successElements = screen.getAllByText('成功')
    expect(successElements.length).toBeGreaterThan(0)

    // 檢查失敗狀態
    const errorElements = screen.getAllByText('失敗')
    expect(errorElements.length).toBeGreaterThan(0)
  })
})