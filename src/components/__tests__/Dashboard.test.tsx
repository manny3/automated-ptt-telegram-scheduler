import { render, screen, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import Dashboard from '../Dashboard'
import { ExecutionResult, ScrapingConfiguration } from '../../types'

describe('Dashboard', () => {
  const mockOnRefresh = jest.fn()

  const mockStats = {
    totalConfigurations: 5,
    activeConfigurations: 3,
    totalExecutions: 20,
    successfulExecutions: 18,
    failedExecutions: 2,
    totalArticlesSent: 150,
  }

  const mockConfigurations: ScrapingConfiguration[] = [
    {
      id: '1',
      name: 'Tech Jobs',
      pttBoard: 'Tech_Job',
      keywords: ['python'],
      postCount: 20,
      schedule: { type: 'daily', time: '09:00' },
      telegramChatId: '123456789',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'News Updates',
      pttBoard: 'Gossiping',
      keywords: ['news'],
      postCount: 10,
      schedule: { type: 'hourly' },
      telegramChatId: '987654321',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockRecentExecutions: ExecutionResult[] = [
    {
      id: 'exec-1',
      configurationId: '1',
      executedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      status: 'success',
      articlesFound: 5,
      articlesSent: 5,
      executionDuration: 2.5,
    },
    {
      id: 'exec-2',
      configurationId: '2',
      executedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'error',
      articlesFound: 0,
      articlesSent: 0,
      executionDuration: 1.2,
      errorMessage: 'Network timeout',
    },
    {
      id: 'exec-3',
      configurationId: '1',
      executedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: 'no_articles',
      articlesFound: 0,
      articlesSent: 0,
      executionDuration: 0.8,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading skeleton when isLoading is true', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={[]}
          configurations={[]}
          isLoading={true}
        />
      )

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Stats Display', () => {
    it('should display all stats correctly', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('5')).toBeInTheDocument() // Total configurations
      expect(screen.getByText('3')).toBeInTheDocument() // Active configurations
      expect(screen.getByText('90%')).toBeInTheDocument() // Success rate (18/20 * 100)
      expect(screen.getByText('150')).toBeInTheDocument() // Articles sent
    })

    it('should calculate success rate correctly', () => {
      const statsWithZeroExecutions = {
        ...mockStats,
        totalExecutions: 0,
        successfulExecutions: 0,
      }

      render(
        <Dashboard
          stats={statsWithZeroExecutions}
          recentExecutions={[]}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should display correct stat labels', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Total Configurations')).toBeInTheDocument()
      expect(screen.getByText('Active Configurations')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Articles Sent')).toBeInTheDocument()
    })
  })

  describe('Recent Executions', () => {
    it('should display recent executions correctly', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getAllByText('Tech Jobs')).toHaveLength(2)
      expect(screen.getByText('News Updates')).toBeInTheDocument()
      expect(screen.getByText(/5 found, 5 sent/)).toBeInTheDocument()
      expect(screen.getAllByText(/0 found, 0 sent/)).toHaveLength(2)
      expect(screen.getByText('SUCCESS')).toBeInTheDocument()
      expect(screen.getByText('ERROR')).toBeInTheDocument()
      expect(screen.getByText('NO ARTICLES')).toBeInTheDocument()
    })

    it('should format execution time correctly', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('30m ago')).toBeInTheDocument()
      expect(screen.getByText('2h ago')).toBeInTheDocument()
      expect(screen.getByText('1d ago')).toBeInTheDocument()
    })

    it('should show execution duration when available', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText(/• 2\.5s/)).toBeInTheDocument()
      expect(screen.getByText(/• 1\.2s/)).toBeInTheDocument()
      expect(screen.getByText(/• 0\.8s/)).toBeInTheDocument()
    })

    it('should show empty state when no executions', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={[]}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('No executions yet')).toBeInTheDocument()
      expect(screen.getByText('Executions will appear here once your configurations start running.')).toBeInTheDocument()
    })

    it('should handle unknown configuration names', () => {
      const executionWithUnknownConfig: ExecutionResult = {
        id: 'exec-unknown',
        configurationId: 'unknown-id',
        executedAt: new Date(),
        status: 'success',
        articlesFound: 1,
        articlesSent: 1,
        executionDuration: 1.0,
      }

      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={[executionWithUnknownConfig]}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Unknown Configuration')).toBeInTheDocument()
    })
  })

  describe('Header and Refresh', () => {
    it('should display dashboard title and last updated time', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('should show refresh button when onRefresh is provided', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
          onRefresh={mockOnRefresh}
        />
      )

      const refreshButton = screen.getByText('Refresh')
      expect(refreshButton).toBeInTheDocument()

      fireEvent.click(refreshButton)
      expect(mockOnRefresh).toHaveBeenCalledTimes(1)
    })

    it('should not show refresh button when onRefresh is not provided', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.queryByText('Refresh')).not.toBeInTheDocument()
    })
  })

  describe('Quick Actions', () => {
    it('should display quick actions section', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByText('Create Configuration')).toBeInTheDocument()
      expect(screen.getByText('View Analytics')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should display quick action descriptions', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Set up a new PTT monitoring job')).toBeInTheDocument()
      expect(screen.getByText('Detailed execution statistics')).toBeInTheDocument()
      expect(screen.getByText('Configure system preferences')).toBeInTheDocument()
    })
  })

  describe('Status Colors', () => {
    it('should apply correct colors for different statuses', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      const successText = screen.getByText('SUCCESS')
      const errorText = screen.getByText('ERROR')
      const noArticlesText = screen.getByText('NO ARTICLES')

      expect(successText).toHaveClass('text-green-600')
      expect(errorText).toHaveClass('text-red-600')
      expect(noArticlesText).toHaveClass('text-yellow-600')
    })
  })

  describe('Execution Count Display', () => {
    it('should show correct execution count in header', () => {
      render(
        <Dashboard
          stats={mockStats}
          recentExecutions={mockRecentExecutions}
          configurations={mockConfigurations}
        />
      )

      expect(screen.getByText('Last 3 executions')).toBeInTheDocument()
    })
  })
})