import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import ConfigurationList from '../ConfigurationList'
import { ScrapingConfiguration } from '../../types'

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(),
})

describe('ConfigurationList', () => {
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()
  const mockOnToggleActive = jest.fn()

  const mockConfigurations: ScrapingConfiguration[] = [
    {
      id: '1',
      name: 'Tech Jobs',
      pttBoard: 'Tech_Job',
      keywords: ['python', 'backend'],
      postCount: 20,
      schedule: { type: 'daily', time: '09:00' },
      telegramChatId: '123456789',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      lastExecuted: new Date('2024-01-01T09:00:00'),
      lastExecutionStatus: 'success',
    },
    {
      id: '2',
      name: 'News Updates',
      pttBoard: 'Gossiping',
      keywords: ['news'],
      postCount: 10,
      schedule: { type: 'custom', interval: 120 },
      telegramChatId: '987654321',
      isActive: false,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockOnDelete.mockResolvedValue(undefined)
    mockOnToggleActive.mockResolvedValue(undefined)
    ;(window.confirm as jest.MockedFunction<typeof window.confirm>).mockReturnValue(true)
  })

  describe('Loading State', () => {
    it('should show loading skeleton when isLoading is true', () => {
      render(
        <ConfigurationList
          configurations={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
          isLoading={true}
        />
      )

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no configurations', () => {
      render(
        <ConfigurationList
          configurations={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('No configurations found')).toBeInTheDocument()
      expect(screen.getByText('Create your first configuration to start monitoring PTT articles.')).toBeInTheDocument()
    })
  })

  describe('Configuration Display', () => {
    it('should display configurations correctly', () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('Tech Jobs')).toBeInTheDocument()
      expect(screen.getByText('python, backend')).toBeInTheDocument()
      expect(screen.getByText('Tech_Job')).toBeInTheDocument()
      expect(screen.getByText('Daily at 09:00')).toBeInTheDocument()
      expect(screen.getByText('Success')).toBeInTheDocument()

      expect(screen.getByText('News Updates')).toBeInTheDocument()
      expect(screen.getByText('news')).toBeInTheDocument()
      expect(screen.getByText('Gossiping')).toBeInTheDocument()
      expect(screen.getByText('Every 120 minutes')).toBeInTheDocument()
    })

    it('should show active/inactive status correctly', () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const rows = screen.getAllByRole('row')
      // First row is header, second is active config, third is inactive
      expect(rows[1]).not.toHaveClass('opacity-60')
      expect(rows[2]).toHaveClass('opacity-60')
    })

    it('should display schedule types correctly', () => {
      const configurationsWithDifferentSchedules: ScrapingConfiguration[] = [
        {
          ...mockConfigurations[0],
          schedule: { type: 'hourly' },
        },
        {
          ...mockConfigurations[1],
          schedule: { type: 'daily', time: '14:30' },
        },
        {
          ...mockConfigurations[0],
          id: '3',
          schedule: { type: 'custom', interval: 60 },
        },
      ]

      render(
        <ConfigurationList
          configurations={configurationsWithDifferentSchedules}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('Every hour')).toBeInTheDocument()
      expect(screen.getByText('Daily at 14:30')).toBeInTheDocument()
      expect(screen.getByText('Every 60 minutes')).toBeInTheDocument()
    })

    it('should format last executed time correctly', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const configurationsWithDifferentTimes: ScrapingConfiguration[] = [
        {
          ...mockConfigurations[0],
          lastExecuted: oneHourAgo,
        },
        {
          ...mockConfigurations[1],
          id: '2',
          lastExecuted: oneDayAgo,
        },
        {
          ...mockConfigurations[0],
          id: '3',
          lastExecuted: undefined,
        },
      ]

      render(
        <ConfigurationList
          configurations={configurationsWithDifferentTimes}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('1 hour ago')).toBeInTheDocument()
      expect(screen.getByText('1 day ago')).toBeInTheDocument()
      expect(screen.getByText('Never')).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('should call onEdit when edit button is clicked', () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])

      expect(mockOnEdit).toHaveBeenCalledWith(mockConfigurations[0])
    })

    it('should call onDelete when delete is confirmed', async () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this configuration? This action cannot be undone.'
      )

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith('1')
      })
    })

    it('should not call onDelete when delete is cancelled', () => {
      ;(window.confirm as jest.MockedFunction<typeof window.confirm>).mockReturnValue(false)

      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])

      expect(mockOnDelete).not.toHaveBeenCalled()
    })

    it('should show loading state during delete', async () => {
      let resolveDelete: () => void
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve
      })
      mockOnDelete.mockReturnValue(deletePromise)

      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })

      resolveDelete!()
      await waitFor(() => {
        expect(screen.queryByText('Deleting...')).not.toBeInTheDocument()
      })
    })

    it('should call onToggleActive when enable/disable button is clicked', async () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      // First config is active, should show "Disable"
      const disableButton = screen.getByText('Disable')
      fireEvent.click(disableButton)

      await waitFor(() => {
        expect(mockOnToggleActive).toHaveBeenCalledWith('1', false)
      })

      // Second config is inactive, should show "Enable"
      const enableButton = screen.getByText('Enable')
      fireEvent.click(enableButton)

      await waitFor(() => {
        expect(mockOnToggleActive).toHaveBeenCalledWith('2', true)
      })
    })

    it('should show loading state during toggle', async () => {
      let resolveToggle: () => void
      const togglePromise = new Promise<void>((resolve) => {
        resolveToggle = resolve
      })
      mockOnToggleActive.mockReturnValue(togglePromise)

      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      const disableButton = screen.getByText('Disable')
      fireEvent.click(disableButton)

      await waitFor(() => {
        expect(screen.getByText('...')).toBeInTheDocument()
      })

      resolveToggle!()
      await waitFor(() => {
        expect(screen.queryByText('...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Status Badges', () => {
    it('should display correct status badges', () => {
      const configurationsWithDifferentStatuses: ScrapingConfiguration[] = [
        {
          ...mockConfigurations[0],
          lastExecutionStatus: 'success',
        },
        {
          ...mockConfigurations[1],
          id: '2',
          lastExecutionStatus: 'error',
        },
        {
          ...mockConfigurations[0],
          id: '3',
          lastExecutionStatus: 'no_articles',
        },
        {
          ...mockConfigurations[0],
          id: '4',
          lastExecutionStatus: undefined,
        },
      ]

      render(
        <ConfigurationList
          configurations={configurationsWithDifferentStatuses}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('No Articles')).toBeInTheDocument()
      expect(screen.getByText('Not Run')).toBeInTheDocument()
    })
  })

  describe('Configuration Count', () => {
    it('should show correct active/total count', () => {
      render(
        <ConfigurationList
          configurations={mockConfigurations}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleActive={mockOnToggleActive}
        />
      )

      expect(screen.getByText('1 of 2 active')).toBeInTheDocument()
    })
  })
})