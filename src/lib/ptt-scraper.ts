import axios, { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'
import { PTTArticle } from '@/types'

// Configuration for PTT scraping
const PTT_BASE_URL = 'https://www.ptt.cc'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1 second
const MAX_DELAY = 10000 // 10 seconds

// Test configuration (can be overridden for testing)
export const TEST_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 10, // Much shorter for tests
  MAX_DELAY: 100,
}

/**
 * Custom error class for PTT scraping errors
 */
export class PTTScrapingError extends Error {
  constructor(message: string, public statusCode?: number, public retryable: boolean = true) {
    super(message)
    this.name = 'PTTScrapingError'
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Calculate exponential backoff delay with jitter
 */
const calculateDelay = (attempt: number, isTest: boolean = false): number => {
  const baseDelay = isTest ? TEST_CONFIG.BASE_DELAY : BASE_DELAY
  const maxDelay = isTest ? TEST_CONFIG.MAX_DELAY : MAX_DELAY
  
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // Add jitter (±25% of delay)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(delay + jitter, 0)
}

/**
 * HTTP client with retry logic and proper headers
 */
class PTTHttpClient {
  private axiosInstance = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  })

  constructor(private isTest: boolean = false) {}

  async get(url: string, retries: number = MAX_RETRIES): Promise<AxiosResponse> {
    let lastError: Error

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.axiosInstance.get(url)
        return response
      } catch (error: any) {
        lastError = error
        
        // Don't retry on certain status codes
        if (error.response?.status === 404) {
          throw new PTTScrapingError(`Board not found: ${url}`, 404, false)
        }
        
        if (error.response?.status === 403) {
          throw new PTTScrapingError(`Access forbidden: ${url}`, 403, false)
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          break
        }

        // Calculate delay and wait before retry
        const delay = calculateDelay(attempt, this.isTest)
        console.log(`PTT request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }

    throw new PTTScrapingError(
      `Failed to fetch ${url} after ${retries + 1} attempts: ${lastError.message}`,
      lastError.response?.status
    )
  }
}

/**
 * PTT Scraper class with age verification and article extraction
 */
export class PTTScraper {
  private httpClient: PTTHttpClient

  constructor(isTest: boolean = false) {
    this.httpClient = new PTTHttpClient(isTest)
  }

  /**
   * Handle 18+ age verification by accepting the terms
   */
  private async handleAgeVerification(boardUrl: string): Promise<string> {
    try {
      // First, try to access the board directly
      const response = await this.httpClient.get(boardUrl)
      
      // Check if we got redirected to age verification
      if (response.data.includes('ask/over18') || response.data.includes('我同意，我已年滿十八歲')) {
        console.log('Age verification required, accepting terms...')
        
        // Accept the age verification by posting to the over18 endpoint
        const verificationUrl = `${PTT_BASE_URL}/ask/over18?from=${encodeURIComponent(boardUrl)}`
        const acceptResponse = await axios.post(verificationUrl, 'yes=yes', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
            'Referer': boardUrl
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400 || status === 302
        })

        // After accepting, fetch the board again
        const finalResponse = await this.httpClient.get(boardUrl)
        return finalResponse.data
      }

      return response.data
    } catch (error: any) {
      throw new PTTScrapingError(`Age verification failed: ${error.message}`)
    }
  }

  /**
   * Extract article information from PTT board HTML
   */
  private parseArticlesFromHTML(html: string, boardName: string): PTTArticle[] {
    const $ = cheerio.load(html)
    const articles: PTTArticle[] = []

    // Find all article entries in the board
    $('.r-ent').each((index, element) => {
      const $element = $(element)
      
      // Extract article link
      const linkElement = $element.find('.title a')
      if (linkElement.length === 0) {
        return // Skip deleted or unavailable articles
      }

      const relativeLink = linkElement.attr('href')
      if (!relativeLink) {
        return
      }

      const fullLink = `${PTT_BASE_URL}${relativeLink}`
      
      // Extract title
      const title = linkElement.text().trim()
      if (!title) {
        return
      }

      // Extract author
      const author = $element.find('.author').text().trim()
      
      // Extract date
      const date = $element.find('.date').text().trim()

      articles.push({
        title,
        author,
        date,
        link: fullLink,
        board: boardName
      })
    })

    return articles
  }

  /**
   * Filter articles by keywords (case-insensitive)
   */
  private filterArticlesByKeywords(articles: PTTArticle[], keywords: string[]): PTTArticle[] {
    if (!keywords || keywords.length === 0) {
      return articles
    }

    return articles.filter(article => {
      const titleLower = article.title.toLowerCase()
      return keywords.some(keyword => 
        titleLower.includes(keyword.toLowerCase())
      )
    })
  }

  /**
   * Main method to search PTT posts
   * @param boardName - PTT board name (e.g., 'Tech_Job', 'Gossiping')
   * @param postCount - Number of posts to retrieve (1-100)
   * @param keywords - Optional keywords to filter articles
   * @returns Promise<PTTArticle[]>
   */
  async searchPTTPosts(
    boardName: string, 
    postCount: number = 20, 
    keywords: string[] = []
  ): Promise<PTTArticle[]> {
    // Validate input parameters
    if (!boardName || boardName.trim() === '') {
      throw new PTTScrapingError('Board name is required', undefined, false)
    }

    if (postCount < 1 || postCount > 100) {
      throw new PTTScrapingError('Post count must be between 1 and 100', undefined, false)
    }

    const boardUrl = `${PTT_BASE_URL}/bbs/${boardName}/index.html`
    
    try {
      console.log(`Fetching articles from PTT board: ${boardName}`)
      
      // Handle age verification and get board HTML
      const html = await this.handleAgeVerification(boardUrl)
      
      // Parse articles from HTML
      const allArticles = this.parseArticlesFromHTML(html, boardName)
      
      if (allArticles.length === 0) {
        console.log(`No articles found on board: ${boardName}`)
        return []
      }

      // Filter by keywords if provided
      let filteredArticles = this.filterArticlesByKeywords(allArticles, keywords)
      
      // If we need more articles and have keywords, we might need to fetch more pages
      // For now, we'll work with what we have from the first page
      
      // Limit to requested count
      const limitedArticles = filteredArticles.slice(0, postCount)
      
      console.log(`Found ${limitedArticles.length} articles matching criteria`)
      
      return limitedArticles
    } catch (error: any) {
      if (error instanceof PTTScrapingError) {
        throw error
      }
      
      throw new PTTScrapingError(`Failed to scrape PTT board ${boardName}: ${error.message}`)
    }
  }

  /**
   * Get multiple pages of articles if needed to reach the desired count
   */
  async searchPTTPostsMultiPage(
    boardName: string,
    postCount: number = 20,
    keywords: string[] = []
  ): Promise<PTTArticle[]> {
    const allArticles: PTTArticle[] = []
    let currentPage = 1
    const maxPages = 5 // Limit to prevent infinite loops

    while (allArticles.length < postCount && currentPage <= maxPages) {
      try {
        const pageUrl = currentPage === 1 
          ? `${PTT_BASE_URL}/bbs/${boardName}/index.html`
          : `${PTT_BASE_URL}/bbs/${boardName}/index${currentPage}.html`

        console.log(`Fetching page ${currentPage} for board: ${boardName}`)
        
        const html = await this.handleAgeVerification(pageUrl)
        const pageArticles = this.parseArticlesFromHTML(html, boardName)
        
        if (pageArticles.length === 0) {
          break // No more articles available
        }

        // Filter by keywords
        const filteredPageArticles = this.filterArticlesByKeywords(pageArticles, keywords)
        allArticles.push(...filteredPageArticles)
        
        currentPage++
      } catch (error: any) {
        console.log(`Failed to fetch page ${currentPage}: ${error.message}`)
        break
      }
    }

    return allArticles.slice(0, postCount)
  }
}

/**
 * Convenience function to create a PTT scraper instance and search posts
 */
export async function searchPTTPosts(
  boardName: string,
  postCount: number = 20,
  keywords: string[] = []
): Promise<PTTArticle[]> {
  const scraper = new PTTScraper()
  return scraper.searchPTTPosts(boardName, postCount, keywords)
}

/**
 * Convenience function for multi-page searching
 */
export async function searchPTTPostsMultiPage(
  boardName: string,
  postCount: number = 20,
  keywords: string[] = []
): Promise<PTTArticle[]> {
  const scraper = new PTTScraper()
  return scraper.searchPTTPostsMultiPage(boardName, postCount, keywords)
}