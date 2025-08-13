/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Docker 和 Cloud Run 最佳化
  output: 'standalone',
  
  // 環境變數配置
  env: {
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    TELEGRAM_BOT_TOKEN_SECRET_NAME: process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME,
  },
  
  // 圖片最佳化設定
  images: {
    domains: ['www.ptt.cc'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // 實驗性功能
  experimental: {
    // 啟用 App Router (如果需要)
    appDir: false,
  },
  
  // 安全標頭
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
  
  // 重寫規則
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ]
  },
}

module.exports = nextConfig