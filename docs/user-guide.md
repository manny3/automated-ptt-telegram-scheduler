# PTT Telegram Scheduler 用戶指南

## 目錄

1. [快速開始](#快速開始)
2. [配置設定](#配置設定)
3. [排程設定](#排程設定)
4. [監控和管理](#監控和管理)
5. [故障排除](#故障排除)
6. [最佳實踐](#最佳實踐)
7. [常見問題](#常見問題)

## 快速開始

### 系統需求

- Node.js 18+
- Google Cloud Platform 帳戶
- Telegram Bot Token
- Firestore 資料庫

### 初始設定

1. **部署應用程式**

   ```bash
   # 克隆專案
   git clone <repository-url>
   cd ptt-telegram-scheduler

   # 安裝依賴
   npm install

   # 設定環境變數
   cp .env.example .env
   ```

2. **設定環境變數**

   ```env
   GOOGLE_CLOUD_PROJECT=your-project-id
   TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token
   FIRESTORE_DATABASE_ID=(default)
   NODE_ENV=production
   ```

3. **設定 Google Cloud 服務**

   ```bash
   # 啟用必要的 API
   gcloud services enable firestore.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable cloudscheduler.googleapis.com
   ```

4. **部署服務**
   ```bash
   # 執行部署腳本
   ./scripts/deploy-all.sh
   ```

### 創建第一個配置

1. 開啟應用程式網頁介面
2. 點擊「新增配置」
3. 填寫配置資訊：

   - **配置名稱**: 為配置取一個有意義的名稱
   - **PTT 看板**: 選擇要爬取的看板（如 Gossiping）
   - **關鍵字**: 輸入要搜尋的關鍵字
   - **文章數量**: 設定每次爬取的文章數量
   - **Telegram Chat ID**: 輸入接收訊息的 Chat ID
   - **排程設定**: 選擇執行頻率

4. 點擊「儲存」完成配置

## 配置設定

### 基本設定

#### 配置名稱

- 用於識別不同的爬取任務
- 建議使用描述性名稱，如「科技新聞爬取」、「股市討論監控」

#### PTT 看板選擇

支援的熱門看板：

- `Gossiping` - 八卦板
- `Tech_Job` - 科技工作板
- `Stock` - 股票板
- `Baseball` - 棒球板
- `movie` - 電影板
- `NBA` - NBA 板

**注意**: 某些看板需要年齡驗證，系統會自動處理。

#### 關鍵字設定

- 支援多個關鍵字，用逗號分隔
- 關鍵字不區分大小寫
- 支援中文、英文和數字
- 建議使用具體的關鍵字以提高準確性

**範例**:

```
新聞, 重要, 突發
科技, AI, 人工智慧
股票, 投資, 財報
```

#### 文章數量

- 範圍：1-100 篇
- 建議設定：10-20 篇
- 過多可能導致 Telegram 訊息過量

### 進階設定

#### Telegram 設定

**獲取 Chat ID**:

1. 在 Telegram 中搜尋 `@userinfobot`
2. 發送 `/start` 命令
3. 複製返回的 Chat ID

**群組 Chat ID**:

1. 將 Bot 加入群組
2. 發送訊息 `/my_id@your_bot_name`
3. Bot 會回覆群組的 Chat ID

#### 排程設定詳解

**間隔執行**:

```json
{
  "type": "interval",
  "intervalMinutes": 60
}
```

- 每隔指定分鐘執行一次
- 最小間隔：15 分鐘
- 建議間隔：30-120 分鐘

**每日執行**:

```json
{
  "type": "daily",
  "hour": 9,
  "minute": 0
}
```

- 每天在指定時間執行
- 時間格式：24 小時制
- 時區：UTC

**每週執行**:

```json
{
  "type": "weekly",
  "dayOfWeek": 1,
  "hour": 9,
  "minute": 0
}
```

- 每週在指定日期和時間執行
- dayOfWeek: 0=週日, 1=週一, ..., 6=週六

**自訂 Cron**:

```json
{
  "type": "cron",
  "expression": "0 9 * * 1-5"
}
```

- 使用 Cron 表達式
- 支援複雜的排程需求
- 範例：`0 9 * * 1-5` = 週一到週五早上 9 點

## 排程設定

### 排程類型選擇指南

| 使用情境     | 建議排程類型 | 設定範例         |
| ------------ | ------------ | ---------------- |
| 即時新聞監控 | 間隔執行     | 每 30 分鐘       |
| 每日新聞摘要 | 每日執行     | 每天早上 8 點    |
| 週報整理     | 每週執行     | 每週一早上 9 點  |
| 工作日監控   | 自訂 Cron    | `0 9-18 * * 1-5` |

### 排程最佳實踐

1. **避免高峰時段**

   - 避免在整點執行（如 12:00, 18:00）
   - 建議錯開 5-10 分鐘

2. **合理設定頻率**

   - 新聞類：30-60 分鐘
   - 討論類：60-120 分鐘
   - 週報類：每日或每週

3. **考慮 PTT 負載**
   - 避免在 PTT 高峰時段（晚上 8-11 點）
   - 建議在早上或下午執行

## 監控和管理

### 執行狀態監控

#### 儀表板概覽

- 訪問 `/monitoring` 查看系統狀態
- 即時顯示各配置的執行狀況
- 系統健康狀態和效能指標

#### 執行歷史查看

1. 在配置列表中點擊「查看歷史」
2. 可以篩選：
   - 執行狀態（成功/失敗/部分成功）
   - 日期範圍
   - 排序方式

#### 執行狀態說明

- **成功**: 找到文章並成功發送到 Telegram
- **失敗**: 爬取或發送過程中發生錯誤
- **部分成功**: 找到文章但部分發送失敗

### 警報和通知

#### 自動警報

系統會在以下情況自動觸發警報：

- 連續執行失敗
- 系統資源使用過高
- 外部服務連接異常

#### 警報查看

- 訪問 `/monitoring` 查看活躍警報
- 警報等級：資訊、警告、錯誤、嚴重
- 可手動解決已處理的警報

### 效能監控

#### 關鍵指標

- **執行成功率**: 應保持在 95% 以上
- **平均執行時間**: 通常在 2-5 秒
- **記憶體使用量**: 監控是否有記憶體洩漏
- **API 回應時間**: 應保持在 500ms 以下

#### 效能優化建議

1. 定期清理舊的執行記錄
2. 監控並調整配置數量
3. 優化關鍵字設定以減少無效爬取

## 故障排除

### 常見問題診斷

#### 1. 配置無法執行

**症狀**: 配置顯示為活躍但沒有執行記錄

**可能原因**:

- Cloud Scheduler 未正確設定
- 服務帳戶權限不足
- Cloud Function 部署失敗

**解決步驟**:

```bash
# 檢查 Cloud Scheduler 狀態
gcloud scheduler jobs list

# 檢查 Cloud Function 日誌
gcloud functions logs read ptt-scraper --limit 50

# 重新部署 Scheduler
./scripts/setup-cloud-scheduler.sh
```

#### 2. PTT 爬取失敗

**症狀**: 執行記錄顯示「PTT 爬取失敗」

**可能原因**:

- PTT 網站暫時無法訪問
- 看板需要年齡驗證
- IP 被暫時封鎖

**解決步驟**:

1. 檢查 PTT 網站是否正常
2. 確認看板名稱正確
3. 等待一段時間後重試
4. 檢查 Cloud Function 的網路設定

#### 3. Telegram 發送失敗

**症狀**: 找到文章但無法發送到 Telegram

**可能原因**:

- Bot Token 無效或過期
- Chat ID 錯誤
- Telegram API 限制

**解決步驟**:

```bash
# 驗證 Bot Token
curl -X GET "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# 檢查 Secret Manager 中的 Token
gcloud secrets versions access latest --secret="telegram-bot-token"

# 測試發送訊息
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"<CHAT_ID>","text":"測試訊息"}'
```

#### 4. 資料庫連接問題

**症狀**: 無法儲存執行記錄或讀取配置

**可能原因**:

- Firestore 權限設定錯誤
- 網路連接問題
- 配額超限

**解決步驟**:

```bash
# 檢查 Firestore 狀態
gcloud firestore databases list

# 檢查服務帳戶權限
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT

# 檢查配額使用情況
gcloud logging read "resource.type=cloud_function" --limit 10
```

### 日誌查看

#### Cloud Function 日誌

```bash
# 查看最近的執行日誌
gcloud functions logs read ptt-scraper --limit 50

# 查看特定時間範圍的日誌
gcloud functions logs read ptt-scraper \
  --start-time="2023-12-01T00:00:00Z" \
  --end-time="2023-12-01T23:59:59Z"
```

#### Cloud Run 日誌

```bash
# 查看 Web 應用程式日誌
gcloud run services logs read ptt-telegram-scheduler --limit 50
```

#### 系統監控日誌

- 訪問 `/api/monitoring/metrics` 查看系統指標
- 訪問 `/api/monitoring/alerts` 查看警報記錄

## 最佳實踐

### 配置管理

1. **命名規範**

   - 使用描述性名稱
   - 包含看板和用途資訊
   - 範例：`Gossiping_科技新聞_每日`

2. **關鍵字優化**

   - 使用具體關鍵字而非泛用詞
   - 定期檢查和調整關鍵字
   - 避免過於寬泛的搜尋條件

3. **排程設定**
   - 根據內容更新頻率設定
   - 避免過於頻繁的執行
   - 考慮時區和目標用戶的作息

### 效能優化

1. **資源管理**

   - 定期清理舊的執行記錄
   - 監控系統資源使用情況
   - 適時調整 Cloud Function 的記憶體配置

2. **成本控制**

   - 合理設定執行頻率
   - 監控 API 呼叫次數
   - 使用 Cloud Monitoring 追蹤成本

3. **可靠性提升**
   - 設定適當的重試機制
   - 監控執行成功率
   - 建立警報和通知機制

### 安全性

1. **權限管理**

   - 使用最小權限原則
   - 定期檢查服務帳戶權限
   - 避免在程式碼中硬編碼敏感資訊

2. **密鑰管理**

   - 使用 Secret Manager 儲存敏感資訊
   - 定期輪換 API 金鑰
   - 監控密鑰存取記錄

3. **網路安全**
   - 使用 HTTPS 進行所有通信
   - 設定適當的防火牆規則
   - 監控異常存取模式

## 常見問題

### Q: 為什麼我的配置沒有找到任何文章？

**A**: 可能的原因包括：

- 關鍵字太具體，沒有匹配的文章
- 看板最近沒有相關內容
- 關鍵字拼寫錯誤

**建議**:

- 檢查關鍵字是否正確
- 嘗試使用更寬泛的關鍵字
- 手動訪問 PTT 確認是否有相關文章

### Q: 如何獲取 Telegram 群組的 Chat ID？

**A**: 步驟如下：

1. 將你的 Bot 加入群組
2. 在群組中發送任意訊息
3. 訪問 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. 在回應中找到 `chat.id` 欄位（通常是負數）

### Q: 系統支援多少個並發配置？

**A**: 理論上沒有硬性限制，但建議：

- 小型部署：10-20 個配置
- 中型部署：50-100 個配置
- 大型部署：100+ 個配置（需要額外的效能調優）

### Q: 如何備份我的配置？

**A**: 配置儲存在 Firestore 中，可以：

1. 使用 `gcloud firestore export` 匯出資料
2. 透過 API 端點匯出配置 JSON
3. 設定定期備份排程

### Q: 可以自訂 Telegram 訊息格式嗎？

**A**: 目前使用固定格式，包含：

- 文章標題
- 作者資訊
- PTT 連結

如需自訂格式，可以修改 Cloud Function 中的訊息模板。

### Q: 系統如何處理 PTT 的年齡驗證？

**A**: 系統會自動：

1. 檢測年齡驗證頁面
2. 自動點擊「已滿 18 歲」選項
3. 重新載入頁面內容

無需手動處理。

### Q: 如何監控系統的執行狀況？

**A**: 可以透過：

1. Web 介面的監控儀表板
2. `/api/health` 端點檢查系統健康
3. Cloud Monitoring 查看詳細指標
4. 設定警報通知

### Q: 遇到問題時如何獲得支援？

**A**: 可以：

1. 查看本文檔的故障排除章節
2. 檢查系統日誌和錯誤訊息
3. 查看專案的 GitHub Issues
4. 聯繫開發團隊

## 更新日誌

### v1.0.0 (2025-08-13)

- 初始版本發布
- 支援 PTT 文章爬取
- Telegram 訊息發送
- Web 管理介面
- 執行歷史和監控

---

**注意**: 本指南會隨著系統更新而持續更新。建議定期查看最新版本。
