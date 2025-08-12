import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import ConfigurationForm from '../ConfigurationForm'
import { ScrapingConfiguration } from '../../types'

// Mock the validation module
const mockValidateCreateConfiguration = jest.fn()

jest.mock('../../lib/validation', () => ({
  validateCreateConfiguration: mockValidateCreateConfiguration,
}))

describe('ConfigurationForm', () => {
  const mockOnSubmit = jest.fn()

  const mockConfiguration: ScrapingConfiguration = {
    id: 'test-id',
    name: 'Test Configuration',
    pttBoard: 'Tech_Job',
    keywords: ['python', 'backend'],
    postCount: 20,
    schedule: { type: 'daily', time: '09:00' },
    telegramChatId: '123456789',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateCreateConfiguration.mockReturnValue({ isValid: true, errors: [] })
  })

  describe('Create Mode', () => {
    it('should render create form with default values', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      expect(screen.getByText('Create New Configuration')).toBeInTheDocument()
      expect(screen.getByLabelText(/Configuration Name/)).toHaveValue('')
      expect(screen.getByLabelText(/PTT Board/)).toHaveValue('')
      expect(screen.getByLabelText(/Keywords/)).toHaveValue('')
      expect(screen.getByLabelText(/Number of Posts/)).toHaveValue(10)
      expect(screen.getByLabelText(/Telegram Chat ID/)).toHaveValue('')
      expect(screen.getByLabelText(/Schedule Type/)).toHaveValue('daily')
      expect(screen.getByText('Create Configuration')).toBeInTheDocument()
    })

    it('should show daily time input when daily schedule is selected', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      expect(screen.getByLabelText(/Daily Time/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Interval \(minutes\)/)).not.toBeInTheDocument()
    })

    it('should show interval input when custom schedule is selected', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      fireEvent.change(screen.getByLabelText(/Schedule Type/), { target: { value: 'custom' } })

      expect(screen.getByLabelText(/Interval \(minutes\)/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Daily Time/)).not.toBeInTheDocument()
    })

    it('should hide both time inputs when hourly schedule is selected', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      fireEvent.change(screen.getByLabelText(/Schedule Type/), { target: { value: 'hourly' } })

      expect(screen.queryByLabelText(/Daily Time/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Interval \(minutes\)/)).not.toBeInTheDocument()
    })

    it('should not show active checkbox in create mode', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      expect(screen.queryByLabelText(/Configuration is active/)).not.toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    it('should render edit form with initial data', () => {
      render(
        <ConfigurationForm 
          onSubmit={mockOnSubmit} 
          mode="edit" 
          initialData={mockConfiguration}
        />
      )

      expect(screen.getByText('Edit Configuration')).toBeInTheDocument()
      expect(screen.getByLabelText(/Configuration Name/)).toHaveValue('Test Configuration')
      expect(screen.getByLabelText(/PTT Board/)).toHaveValue('Tech_Job')
      expect(screen.getByLabelText(/Keywords/)).toHaveValue('python, backend')
      expect(screen.getByLabelText(/Number of Posts/)).toHaveValue(20)
      expect(screen.getByLabelText(/Telegram Chat ID/)).toHaveValue('123456789')
      expect(screen.getByLabelText(/Schedule Type/)).toHaveValue('daily')
      expect(screen.getByLabelText(/Daily Time/)).toHaveValue('09:00')
      expect(screen.getByText('Update Configuration')).toBeInTheDocument()
    })

    it('should show active checkbox in edit mode', () => {
      render(
        <ConfigurationForm 
          onSubmit={mockOnSubmit} 
          mode="edit" 
          initialData={mockConfiguration}
        />
      )

      const checkbox = screen.getByLabelText(/Configuration is active/)
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toBeChecked()
    })

    it('should update form when initialData changes', () => {
      const { rerender } = render(
        <ConfigurationForm 
          onSubmit={mockOnSubmit} 
          mode="edit" 
          initialData={mockConfiguration}
        />
      )

      const updatedConfig = { ...mockConfiguration, name: 'Updated Name' }
      rerender(
        <ConfigurationForm 
          onSubmit={mockOnSubmit} 
          mode="edit" 
          initialData={updatedConfig}
        />
      )

      expect(screen.getByLabelText(/Configuration Name/)).toHaveValue('Updated Name')
    })
  })

  describe('Form Validation', () => {
    it('should display validation errors', async () => {
      mockValidateCreateConfiguration.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Configuration name is required' },
          { field: 'pttBoard', message: 'PTT board name is required' },
        ]
      })

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      fireEvent.click(screen.getByText('Create Configuration'))

      await waitFor(() => {
        expect(screen.getByText('Configuration name is required')).toBeInTheDocument()
        expect(screen.getByText('PTT board name is required')).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should clear field errors when user starts typing', async () => {
      mockValidateCreateConfiguration.mockReturnValue({
        isValid: false,
        errors: [{ field: 'name', message: 'Configuration name is required' }]
      })

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      fireEvent.click(screen.getByText('Create Configuration'))

      await waitFor(() => {
        expect(screen.getByText('Configuration name is required')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/Configuration Name/), { target: { value: 'New Name' } })

      expect(screen.queryByText('Configuration name is required')).not.toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should submit valid form data in create mode', async () => {
      mockOnSubmit.mockResolvedValue(undefined)

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      // Fill out the form
      fireEvent.change(screen.getByLabelText(/Configuration Name/), { target: { value: 'Test Config' } })
      fireEvent.change(screen.getByLabelText(/PTT Board/), { target: { value: 'Tech_Job' } })
      fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: 'python, react' } })
      fireEvent.change(screen.getByLabelText(/Number of Posts/), { target: { value: '25' } })
      fireEvent.change(screen.getByLabelText(/Telegram Chat ID/), { target: { value: '987654321' } })
      fireEvent.change(screen.getByLabelText(/Daily Time/), { target: { value: '14:30' } })

      fireEvent.click(screen.getByText('Create Configuration'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Config',
          pttBoard: 'Tech_Job',
          keywords: ['python', 'react'],
          postCount: 25,
          schedule: { type: 'daily', time: '14:30' },
          telegramChatId: '987654321',
        })
      })
    })

    it('should submit valid form data in edit mode with isActive', async () => {
      mockOnSubmit.mockResolvedValue(undefined)

      render(
        <ConfigurationForm 
          onSubmit={mockOnSubmit} 
          mode="edit" 
          initialData={mockConfiguration}
        />
      )

      // Toggle active status
      fireEvent.click(screen.getByLabelText(/Configuration is active/))

      fireEvent.click(screen.getByText('Update Configuration'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Configuration',
          pttBoard: 'Tech_Job',
          keywords: ['python', 'backend'],
          postCount: 20,
          schedule: { type: 'daily', time: '09:00' },
          telegramChatId: '123456789',
          isActive: false,
        })
      })
    })

    it('should handle custom schedule submission', async () => {
      mockOnSubmit.mockResolvedValue(undefined)

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      // Fill out the form with custom schedule
      fireEvent.change(screen.getByLabelText(/Configuration Name/), { target: { value: 'Custom Config' } })
      fireEvent.change(screen.getByLabelText(/PTT Board/), { target: { value: 'Gossiping' } })
      fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: 'news' } })
      fireEvent.change(screen.getByLabelText(/Telegram Chat ID/), { target: { value: '111222333' } })
      fireEvent.change(screen.getByLabelText(/Schedule Type/), { target: { value: 'custom' } })
      fireEvent.change(screen.getByLabelText(/Interval \(minutes\)/), { target: { value: '120' } })

      fireEvent.click(screen.getByText('Create Configuration'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Custom Config',
          pttBoard: 'Gossiping',
          keywords: ['news'],
          postCount: 10,
          schedule: { type: 'custom', interval: 120 },
          telegramChatId: '111222333',
        })
      })
    })

    it('should show loading state during submission', async () => {
      let resolveSubmit: () => void
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
      mockOnSubmit.mockReturnValue(submitPromise)

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      // Fill out required fields
      fireEvent.change(screen.getByLabelText(/Configuration Name/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/PTT Board/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: 'test' } })
      fireEvent.change(screen.getByLabelText(/Telegram Chat ID/), { target: { value: '123' } })

      fireEvent.click(screen.getByText('Create Configuration'))

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Creating/ })).toBeDisabled()

      resolveSubmit!()
      await waitFor(() => {
        expect(screen.getByText('Create Configuration')).toBeInTheDocument()
      })
    })

    it('should display submit error', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Network error'))

      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      // Fill out required fields
      fireEvent.change(screen.getByLabelText(/Configuration Name/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/PTT Board/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: 'test' } })
      fireEvent.change(screen.getByLabelText(/Telegram Chat ID/), { target: { value: '123' } })

      fireEvent.click(screen.getByText('Create Configuration'))

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels and ARIA attributes', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" />)

      expect(screen.getByLabelText(/Configuration Name/)).toHaveAttribute('id', 'name')
      expect(screen.getByLabelText(/PTT Board/)).toHaveAttribute('id', 'pttBoard')
      expect(screen.getByLabelText(/Keywords/)).toHaveAttribute('id', 'keywords')
      expect(screen.getByLabelText(/Number of Posts/)).toHaveAttribute('id', 'postCount')
      expect(screen.getByLabelText(/Telegram Chat ID/)).toHaveAttribute('id', 'telegramChatId')
      expect(screen.getByLabelText(/Schedule Type/)).toHaveAttribute('id', 'scheduleType')
    })

    it('should disable form elements when loading', () => {
      render(<ConfigurationForm onSubmit={mockOnSubmit} mode="create" isLoading={true} />)

      expect(screen.getByLabelText(/Configuration Name/)).toBeDisabled()
      expect(screen.getByLabelText(/PTT Board/)).toBeDisabled()
      expect(screen.getByLabelText(/Keywords/)).toBeDisabled()
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})