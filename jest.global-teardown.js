/**
 * Jest 全域清理
 * 在所有測試結束後執行
 */

module.exports = async () => {
  // 清理測試資料
  // 在實際環境中，這裡可能會清理測試資料庫或其他資源
  
  console.log('🧹 Jest global teardown completed')
}