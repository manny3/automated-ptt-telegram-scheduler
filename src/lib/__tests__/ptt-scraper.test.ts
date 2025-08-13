import axios from 'axios'
import { PTTScraper, PTTScrapingError, searchPTTPosts } from '../ptt-scraper'
import { PTTArticle } from '@/types'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

// Mock axios.create
const mockAxiosInstance = {
  get: jest.fn(),
}
mockedAxios.create.mockReturnValue(mockAxiosInstance as any)

describe('PTTScraper', () => {
  let scraper: PTTScraper
  
  beforeEach(() => {
    scraper = new PTTScraper(true) // Use test mode for faster retries
    jest.clearAllMocks()
  })

  describe('searchPTTPosts', () => {
    const mockBoardHTML = `
      <html>
        <body>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Tech_Job/M.1234567890.A.123.html">
                [徵才] Python 後端工程師
              </a>
            </div>
            <div class="author">testuser1</div>
            <div class="date">12/25</div>
          </div>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Tech_Job/M.1234567891.A.124.html">
                [徵才] Frontend Developer
              </a>
            </div>
            <div class="author">testuser2</div>
            <div class="date">12/24</div>
          </div>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Tech_Job/M.1234567892.A.125.html">
                [心得] 面試心得分享
              </a>
            </div>
            <div class="author">testuser3</div>
            <div class="date">12/23</div>
          </div>
        </body>
      </html>
    `

    it('should successfully fetch and parse articles', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://www.ptt.cc/bbs/Tech_Job/index.html')
      expect(articles).toHaveLength(3)
      expect(articles[0]).toEqual({
        title: '[徵才] Python 後端工程師',
        author: 'testuser1',
        date: '12/25',
        link: 'https://www.ptt.cc/bbs/Tech_Job/M.1234567890.A.123.html',
        board: 'Tech_Job'
      })
    })

    it('should filter articles by keywords', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10, ['python'])

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toContain('Python')
    })

    it('should filter articles by multiple keywords', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10, ['python', 'frontend'])

      expect(articles).toHaveLength(2)
      expect(articles.some(a => a.title.includes('Python'))).toBe(true)
      expect(articles.some(a => a.title.includes('Frontend'))).toBe(true)
    })

    it('should be case insensitive when filtering by keywords', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10, ['PYTHON'])

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toContain('Python')
    })

    it('should limit results to postCount', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 2)

      expect(articles).toHaveLength(2)
    })

    it('should return empty array when no articles match keywords', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10, ['nonexistent'])

      expect(articles).toHaveLength(0)
    })

    it('should handle empty board', async () => {
      const emptyBoardHTML = '<html><body></body></html>'
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: emptyBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('EmptyBoard', 10)

      expect(articles).toHaveLength(0)
    })

    it('should validate board name', async () => {
      await expect(scraper.searchPTTPosts('', 10)).rejects.toThrow(PTTScrapingError)
      await expect(scraper.searchPTTPosts('   ', 10)).rejects.toThrow('Board name is required')
    })

    it('should validate post count', async () => {
      await expect(scraper.searchPTTPosts('Tech_Job', 0)).rejects.toThrow('Post count must be between 1 and 100')
      await expect(scraper.searchPTTPosts('Tech_Job', 101)).rejects.toThrow('Post count must be between 1 and 100')
    })

    it('should handle 404 errors without retry', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Not Found'
      })

      await expect(scraper.searchPTTPosts('NonExistentBoard', 10)).rejects.toThrow('Board not found')
    })

    it('should handle 403 errors without retry', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 403 },
        message: 'Forbidden'
      })

      await expect(scraper.searchPTTPosts('ForbiddenBoard', 10)).rejects.toThrow('Access forbidden')
    })

    it('should retry on network errors', async () => {
      // First two attempts fail, third succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: mockBoardHTML,
          status: 200
        })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10)

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
      expect(articles).toHaveLength(3)
    })

    it('should fail after max retries', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'))

      await expect(scraper.searchPTTPosts('Tech_Job', 10)).rejects.toThrow('Failed to fetch')
    }, 10000) // Increase timeout to 10 seconds
  })

  describe('Age Verification', () => {
    const ageVerificationHTML = `
      <html>
        <body>
          <div>我同意，我已年滿十八歲</div>
          <form action="/ask/over18">
            <button name="yes" value="yes">進入</button>
          </form>
        </body>
      </html>
    `

    const mockBoardHTML = `
      <html>
        <body>
          <div class="r-ent">
            <div class="title">
              <a href="/bbs/Gossiping/M.1234567890.A.123.html">
                [新聞] 測試新聞
              </a>
            </div>
            <div class="author">testuser</div>
            <div class="date">12/25</div>
          </div>
        </body>
      </html>
    `

    it('should handle age verification', async () => {
      // First request returns age verification page
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: ageVerificationHTML,
        status: 200
      })

      // Mock the POST request for age verification
      mockedAxios.post.mockResolvedValueOnce({
        status: 302,
        headers: { location: '/bbs/Gossiping/index.html' }
      })

      // Second request returns actual board content
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Gossiping', 10)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.ptt.cc/ask/over18?from=https%3A%2F%2Fwww.ptt.cc%2Fbbs%2FGossiping%2Findex.html',
        'yes=yes',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      )
      expect(articles).toHaveLength(1)
    })

    it('should handle age verification failure', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: ageVerificationHTML,
        status: 200
      })

      mockedAxios.post.mockRejectedValueOnce(new Error('Verification failed'))

      await expect(scraper.searchPTTPosts('Gossiping', 10)).rejects.toThrow('Age verification failed')
    })
  })

  describe('HTML Parsing Edge Cases', () => {
    it('should skip articles without links', async () => {
      const htmlWithDeletedArticles = `
        <html>
          <body>
            <div class="r-ent">
              <div class="title">(本文已被刪除)</div>
              <div class="author">-</div>
              <div class="date">12/25</div>
            </div>
            <div class="r-ent">
              <div class="title">
                <a href="/bbs/Tech_Job/M.1234567890.A.123.html">
                  [徵才] Valid Article
                </a>
              </div>
              <div class="author">testuser</div>
              <div class="date">12/24</div>
            </div>
          </body>
        </html>
      `

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: htmlWithDeletedArticles,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10)

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('[徵才] Valid Article')
    })

    it('should handle malformed HTML gracefully', async () => {
      const malformedHTML = '<html><body><div class="r-ent"><div class="title"></div></div></body></html>'

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: malformedHTML,
        status: 200
      })

      const articles = await scraper.searchPTTPosts('Tech_Job', 10)

      expect(articles).toHaveLength(0)
    })
  })

  describe('Convenience Functions', () => {
    it('should work with searchPTTPosts convenience function', async () => {
      const mockBoardHTML = `
        <html>
          <body>
            <div class="r-ent">
              <div class="title">
                <a href="/bbs/Tech_Job/M.1234567890.A.123.html">
                  [徵才] Test Job
                </a>
              </div>
              <div class="author">testuser</div>
              <div class="date">12/25</div>
            </div>
          </body>
        </html>
      `

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBoardHTML,
        status: 200
      })

      const articles = await searchPTTPosts('Tech_Job', 5, ['test'])

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('[徵才] Test Job')
    })
  })
})

describe('PTTScrapingError', () => {
  it('should create error with correct properties', () => {
    const error = new PTTScrapingError('Test error', 500, false)

    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.retryable).toBe(false)
    expect(error.name).toBe('PTTScrapingError')
  })

  it('should default retryable to true', () => {
    const error = new PTTScrapingError('Test error')

    expect(error.retryable).toBe(true)
  })
})