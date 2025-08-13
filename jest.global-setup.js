/**
 * Jest 全域設定
 * 在所有測試開始前執行
 */

module.exports = async () => {
  // 設定測試環境變數
  process.env.NODE_ENV = 'test'
  process.env.GOOGLE_CLOUD_PROJECT = 'test-project'
  process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME = 'test-telegram-token'
  process.env.FIRESTORE_DATABASE_ID = '(default)'
  process.env.LOG_LEVEL = 'error' // 減少測試期間的日誌輸出
  
  // 設定時區
  process.env.TZ = 'UTC'
  
  console.log('🚀 Jest global setup completed')
}