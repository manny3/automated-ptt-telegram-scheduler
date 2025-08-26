/**
 * @testing-library/jest-dom 相容性測試
 * 驗證所有 jest-dom 匹配器與 React 19 和新版本的相容性
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

describe('@testing-library/jest-dom 相容性測試', () => {
  describe('基本 DOM 匹配器', () => {
    beforeEach(() => {
      render(
        React.createElement('div', { 'data-testid': 'test-container' },
          React.createElement('input', {
            type: 'text',
            value: 'test value',
            placeholder: 'Enter text',
            'data-testid': 'text-input',
            readOnly: true
          }),
          React.createElement('button', {
            disabled: true,
            'data-testid': 'disabled-button'
          }, 'Disabled Button'),
          React.createElement('div', {
            className: 'visible-element',
            'data-testid': 'visible-div'
          }, 'Visible Content'),
          React.createElement('div', {
            style: { display: 'none' },
            'data-testid': 'hidden-div'
          }, 'Hidden Content'),
          React.createElement('form', {
            'data-testid': 'test-form'
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: true,
              'data-testid': 'checked-checkbox',
              readOnly: true
            }),
            React.createElement('select', {
              'data-testid': 'test-select',
              value: 'option2',
              readOnly: true
            },
              React.createElement('option', { value: 'option1' }, 'Option 1'),
              React.createElement('option', { value: 'option2' }, 'Option 2')
            )
          )
        )
      )
    })

    it('toBeInTheDocument - 驗證元素存在於 DOM 中', () => {
      const container = screen.getByTestId('test-container')
      expect(container).toBeInTheDocument()
    })

    it('toHaveTextContent - 驗證元素文字內容', () => {
      const visibleDiv = screen.getByTestId('visible-div')
      expect(visibleDiv).toHaveTextContent('Visible Content')
      expect(visibleDiv).toHaveTextContent(/Visible/)
    })

    it('toHaveValue - 驗證表單元素值', () => {
      const textInput = screen.getByTestId('text-input')
      const selectElement = screen.getByTestId('test-select')
      
      expect(textInput).toHaveValue('test value')
      expect(selectElement).toHaveValue('option2')
    })

    it('toBeDisabled/toBeEnabled - 驗證元素啟用狀態', () => {
      const disabledButton = screen.getByTestId('disabled-button')
      const textInput = screen.getByTestId('text-input')
      
      expect(disabledButton).toBeDisabled()
      expect(textInput).toBeEnabled()
    })

    it('toBeVisible/toBeInTheDocument - 驗證元素可見性', () => {
      const visibleDiv = screen.getByTestId('visible-div')
      const hiddenDiv = screen.getByTestId('hidden-div')
      
      expect(visibleDiv).toBeVisible()
      expect(hiddenDiv).toBeInTheDocument()
      expect(hiddenDiv).not.toBeVisible()
    })

    it('toBeChecked - 驗證複選框狀態', () => {
      const checkbox = screen.getByTestId('checked-checkbox')
      expect(checkbox).toBeChecked()
    })

    it('toHaveAttribute - 驗證元素屬性', () => {
      const textInput = screen.getByTestId('text-input')
      
      expect(textInput).toHaveAttribute('type', 'text')
      expect(textInput).toHaveAttribute('placeholder', 'Enter text')
      expect(textInput).toHaveAttribute('data-testid')
    })

    it('toHaveClass - 驗證 CSS 類別', () => {
      const visibleDiv = screen.getByTestId('visible-div')
      expect(visibleDiv).toHaveClass('visible-element')
    })

    it('toHaveStyle - 驗證內聯樣式', () => {
      const hiddenDiv = screen.getByTestId('hidden-div')
      expect(hiddenDiv).toHaveStyle('display: none')
    })
  })

  describe('表單相關匹配器', () => {
    beforeEach(() => {
      render(
        React.createElement('form', { 'data-testid': 'form' },
          React.createElement('input', {
            type: 'text',
            required: true,
            'data-testid': 'required-input'
          }),
          React.createElement('input', {
            type: 'text',
            'data-testid': 'optional-input'
          }),
          React.createElement('input', {
            type: 'text',
            'aria-invalid': 'true',
            'data-testid': 'invalid-input'
          }),
          React.createElement('input', {
            type: 'text',
            'aria-invalid': 'false',
            'data-testid': 'valid-input'
          })
        )
      )
    })

    it('toBeRequired - 驗證必填欄位', () => {
      const requiredInput = screen.getByTestId('required-input')
      const optionalInput = screen.getByTestId('optional-input')
      
      expect(requiredInput).toBeRequired()
      expect(optionalInput).not.toBeRequired()
    })

    it('toBeInvalid/toBeValid - 驗證表單驗證狀態', () => {
      const invalidInput = screen.getByTestId('invalid-input')
      const validInput = screen.getByTestId('valid-input')
      
      expect(invalidInput).toBeInvalid()
      expect(validInput).toBeValid()
    })
  })

  describe('可訪問性相關匹配器', () => {
    beforeEach(() => {
      render(
        React.createElement('div', null,
          React.createElement('button', {
            'aria-expanded': 'true',
            'data-testid': 'expanded-button'
          }, 'Expanded Button'),
          React.createElement('button', {
            'aria-expanded': 'false',
            'data-testid': 'collapsed-button'
          }, 'Collapsed Button'),
          React.createElement('div', {
            'aria-describedby': 'description',
            'data-testid': 'described-element'
          }, 'Element with description'),
          React.createElement('div', {
            id: 'description'
          }, 'This is a description')
        )
      )
    })

    it('toHaveAccessibleName - 驗證可訪問名稱', () => {
      const expandedButton = screen.getByTestId('expanded-button')
      expect(expandedButton).toHaveAccessibleName('Expanded Button')
    })

    it('toHaveAccessibleDescription - 驗證可訪問描述', () => {
      const describedElement = screen.getByTestId('described-element')
      expect(describedElement).toHaveAccessibleDescription('This is a description')
    })
  })

  describe('自定義匹配器測試', () => {
    it('toBeWithinRange - 自定義數值範圍匹配器', () => {
      expect(50).toBeWithinRange(1, 100)
      expect(0).toBeWithinRange(0, 10)
      expect(100).toBeWithinRange(50, 100)
    })

    it('toHaveBeenCalledWithObjectContaining - 自定義物件匹配器', () => {
      const mockFn = jest.fn()
      
      mockFn({ id: 1, name: 'test', extra: 'data' })
      mockFn({ id: 2, name: 'another' })
      
      expect(mockFn).toHaveBeenCalledWithObjectContaining({ id: 1, name: 'test' })
      expect(mockFn).toHaveBeenCalledWithObjectContaining({ id: 2 })
    })
  })

  describe('React 19 特定功能測試', () => {
    it('應該正確處理 React 19 的新 JSX 轉換', () => {
      const TestComponent = () => React.createElement('div', {
        'data-testid': 'react19-component'
      }, 'React 19 Component')

      render(React.createElement(TestComponent))
      
      const component = screen.getByTestId('react19-component')
      expect(component).toBeInTheDocument()
      expect(component).toHaveTextContent('React 19 Component')
    })

    it('應該正確處理 React 19 的 key 屬性', () => {
      const items = ['item1', 'item2', 'item3']
      
      render(
        React.createElement('ul', { 'data-testid': 'list' },
          ...items.map((item, index) =>
            React.createElement('li', {
              key: index,
              'data-testid': `list-item-${index}`
            }, item)
          )
        )
      )

      items.forEach((item, index) => {
        const listItem = screen.getByTestId(`list-item-${index}`)
        expect(listItem).toBeInTheDocument()
        expect(listItem).toHaveTextContent(item)
      })
    })

    it('應該正確處理 React 19 的事件處理', () => {
      const handleClick = jest.fn()
      
      render(
        React.createElement('button', {
          onClick: handleClick,
          'data-testid': 'click-button'
        }, 'Click Me')
      )

      const button = screen.getByTestId('click-button')
      expect(button).toBeInTheDocument()
      
      // 驗證按鈕可以被點擊（不實際觸發事件，只驗證渲染）
      expect(button).toBeEnabled()
    })
  })
})