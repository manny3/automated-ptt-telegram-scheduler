/**
 * Docker 健康檢查腳本
 * 檢查 Next.js 應用程式是否正常運行
 */

const http = require('http')

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 2000
}

const request = http.request(options, (res) => {
  console.log(`健康檢查狀態碼: ${res.statusCode}`)
  
  if (res.statusCode === 200) {
    process.exit(0) // 健康
  } else {
    process.exit(1) // 不健康
  }
})

request.on('error', (err) => {
  console.error('健康檢查錯誤:', err.message)
  process.exit(1)
})

request.on('timeout', () => {
  console.error('健康檢查逾時')
  request.destroy()
  process.exit(1)
})

request.end()