/**
 * Jest 測試環境設定
 */

import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.GOOGLE_CLOUD_PROJECT = 'test-project'
process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME = 'test-telegram-token'

// Mock global fetch
global.fetch = jest.fn()

// Mock console methods to reduce noise in tests
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps has been renamed')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
  
  // Clear fetch mock
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear()
  }
})

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock performance.now for performance tests
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
  },
})

// Mock crypto for generating random IDs
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
  },
})

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
  
  toHaveBeenCalledWithObjectContaining(received, expected) {
    const pass = received.mock.calls.some(call =>
      call.some(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return Object.keys(expected).every(key => arg[key] === expected[key])
        }
        return false
      })
    )
    
    if (pass) {
      return {
        message: () =>
          `expected function not to have been called with object containing ${JSON.stringify(expected)}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected function to have been called with object containing ${JSON.stringify(expected)}`,
        pass: false,
      }
    }
  },
})

// Global test utilities
global.testUtils = {
  // Helper to create mock API responses
  createMockApiResponse: (data, success = true) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
    timestamp: new Date().toISOString(),
    requestId: 'test-request-id',
  }),
  
  // Helper to create mock execution records
  createMockExecution: (overrides = {}) => ({
    id: 'mock-execution-id',
    configurationId: 'mock-config-id',
    configurationName: 'Mock Configuration',
    timestamp: new Date().toISOString(),
    status: 'success',
    articlesFound: 5,
    articlesSent: 5,
    executionTime: 2000,
    pttBoard: 'Gossiping',
    keywords: ['test'],
    telegramChatId: '123456789',
    ...overrides,
  }),
  
  // Helper to create mock configurations
  createMockConfiguration: (overrides = {}) => ({
    id: 'mock-config-id',
    name: 'Mock Configuration',
    pttBoard: 'Gossiping',
    keywords: ['test'],
    postCount: 10,
    schedule: {
      type: 'interval',
      intervalMinutes: 60,
    },
    telegramChatId: '123456789',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),
  
  // Helper to wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock fetch responses
  mockFetchResponse: (data, ok = true, status = 200) => {
    global.fetch.mockResolvedValueOnce({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  },
  
  // Helper to create mock fetch error
  mockFetchError: (error = new Error('Network error')) => {
    global.fetch.mockRejectedValueOnce(error)
  },
}