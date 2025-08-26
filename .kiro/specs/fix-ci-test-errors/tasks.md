# Implementation Plan

- [x] 1. 修復 React 19 與測試庫相容性問題
  - 更新 package.json 中的 @testing-library/react 到 v16.0.0+
  - 添加 npm overrides 確保版本一致性
  - 解決 peer dependency 衝突和 ERESOLVE 錯誤
  - 驗證所有測試相關依賴與 React 19 相容
  - _Requirements: 1.1, 1.3, 4.3_

- [x] 2. 修復 Jest 配置語法錯誤
  - 修正 jest.config.js 中 moduleNameMapper 的語法錯誤
  - 確保所有路徑映射正確結束並有適當的分隔符
  - 驗證 Jest 配置能正確解析 TypeScript 和 JSX 檔案
  - 測試模組路徑解析功能正常運作
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 3. 優化 npm 依賴安裝策略
  - 更新 package-lock.json 以反映新的依賴版本
  - 在 CI 中使用 --legacy-peer-deps 標誌處理警告
  - 實施依賴安裝的錯誤處理和重試機制
  - 驗證本地和 CI 環境的依賴安裝一致性
  - _Requirements: 1.2, 1.4, 4.2_

- [x] 4. 增強 GitHub Actions workflow 穩定性
  - 更新 CI workflow 以處理新的依賴安裝需求
  - 優化快取策略以提升安裝速度和穩定性
  - 添加更詳細的錯誤日誌和診斷資訊
  - 實施測試失敗時的詳細報告機制
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 5. 驗證測試環境配置正確性
  - 確保 jest.setup.js 正確載入所有必要的測試工具
  - 驗證 @testing-library/jest-dom 與新版本相容
  - 測試 DOM 測試環境和 React 組件渲染功能
  - 確認測試覆蓋率報告正確生成
  - _Requirements: 2.3, 2.4, 4.1_

- [x] 6. 執行完整的回歸測試
  - 在本地環境執行所有測試套件確保通過
  - 驗證單元測試、整合測試和 E2E 測試都正常運作
  - 檢查測試執行時間和效能沒有顯著下降
  - 確認所有現有功能不受修復影響
  - _Requirements: 1.2, 2.2, 4.4_

- [ ] 7. 最佳化 CI/CD pipeline 效能
  - 實施多層快取策略（node_modules, npm cache, build artifacts）
  - 優化並行執行設定以提升整體執行速度
  - 添加 CI 執行時間監控和效能基準
  - 測試 pipeline 在不同條件下的穩定性
  - _Requirements: 3.2, 3.4_