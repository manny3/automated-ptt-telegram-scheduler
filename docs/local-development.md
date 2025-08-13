# 本地開發指南

## 概述

這個專案支援完整的本地開發環境，你可以在不部署到 GCP 的情況下進行開發和測試。本地環境使用 Firestore 模擬器和其他本地服務來模擬生產環境。

## 快速開始

### 1. 環境需求

- **Node.js** 18+ 
- **Docker** 和 **Docker Compose**
- **Google Cloud SDK** (可選，用於某些功能)
- **Git**

### 2. 專案設定

```bash
# 1. 克隆專案
git clone <repository-url>
cd ptt-telegram-scheduler

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env.local
```

### 3. 環境變數配置

編輯 `.env.local` 文件：

```env
# === 基本設定 ===
NODE_ENV=development
GOOGLE_CLOUD_PROJECT=local-dev-project
PORT=3000

# === Firestore 模擬器 ===
FIRESTORE_EMULATOR_HOST=localhost:8080

# === Telegram 設定 ===
# 本地開發可以使用測試 Token 或跳過
TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token

# === 功能開關 ===
DEBUG=true
VERBOSE_LOGGING=true
NEXT_TELEMETRY_DISABLED=1
```

## 本地開發方式

### 方式一：使用 Docker Compose（推薦）

這是最簡單的方式，會自動設定所有必要的服務。

```bash
# 啟動所有服務
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f web

# 停止服務
docker-compose down
```

**服務端點**：
- **Web 應用程式**: http://localhost:3000
- **Firestore 模擬器**: http://localhost:8080
- **Redis**: localhost:6379

### 方式二：混合模式（部分 Docker）

只使用 Docker 運行資料庫服務，本地運行 Next.js 應用程式。

```bash
# 1. 啟動資料庫服務
docker-compose up -d firestore redis

# 2. 本地運行應用程式
npm run dev
```

### 方式三：完全本地模式

不使用 Docker，手動設定所有服務。

#### 設定 Firestore 模擬器

```bash
# 1. 安裝 Google Cloud SDK
# macOS: brew install google-cloud-sdk
# 其他系統: https://cloud.google.com/sdk/docs/install

# 2. 安裝 Firestore 模擬器
gcloud components install cloud-firestore-emulator

# 3. 啟動模擬器
gcloud emulators firestore start --host-port=localhost:8080
```

#### 運行應用程式

```bash
# 在另一個終端中
export FIRESTORE_EMULATOR_HOST=localhost:8080
npm run dev
```

## 本地測試

### 1. 運行測試套件

```bash
# 運行所有測試
npm test

# 運行特定類型的測試
npm run test:unit
npm run test:integration
npm run test:e2e

# 運行測試並生成覆蓋率報告
npm run test:coverage
```

### 2. 手動測試 API

```bash
# 健康檢查
curl http://localhost:3000/api/health

# 測試配置 API
curl -X POST http://localhost:3000/api/configurations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "測試配置",
    "pttBoard": "Gossiping",
    "keywords": ["測試"],
    "postCount": 5,
    "schedule": {"type": "interval", "intervalMinutes": 60},
    "telegramChatId": "123456789"
  }'
```

### 3. 測試 PTT 爬取功能

由於本地環境沒有 Cloud Function，你可以：

1. **使用測試腳本**：
```bash
# 創建測試腳本
node -e "
const { searchPttPosts } = require('./src/lib/ptt-scraper');
searchPttPosts('Gossiping', ['測試'], 5).then(console.log);
"
```

2. **使用 API 端點測試**：
```bash
curl -X POST http://localhost:3000/api/test/ptt-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "board": "Gossiping",
    "keywords": ["測試"],
    "postCount": 5
  }'
```

## 本地開發功能

### 1. 熱重載

Next.js 支援熱重載，修改程式碼後會自動重新載入：

```bash
npm run dev
# 應用程式會在 http://localhost:3000 啟動
```

### 2. 資料庫管理

#### Firestore 模擬器 UI

訪問 http://localhost:4000 查看 Firestore 模擬器的 Web UI。

#### 資料庫操作

```bash
# 清空本地資料庫
curl -X DELETE http://localhost:8080/emulator/v1/projects/local-dev-project/databases/(default)/documents

# 匯出資料
gcloud emulators firestore export ./firestore-export

# 匯入資料
gcloud emulators firestore import ./firestore-export
```

### 3. 除錯模式

啟用除錯模式以獲得更詳細的日誌：

```env
# .env.local
DEBUG=true
VERBOSE_LOGGING=true
```

### 4. 模擬外部服務

#### 模擬 Telegram API

創建 `src/lib/__mocks__/telegram-bot.ts`：

```typescript
export class TelegramBotClient {
  constructor(private token: string, private isTest: boolean = true) {}
  
  async sendMessage(chatId: string, text: string) {
    console.log(`[MOCK] 發送訊息到 ${chatId}: ${text}`)
    return { ok: true, result: { message_id: Math.random() } }
  }
  
  async sendArticleBatch(chatId: string, articles: any[], boardName: string) {
    console.log(`[MOCK] 發送 ${articles.length} 篇文章到 ${chatId}`)
    return Promise.resolve()
  }
}
```

#### 模擬 Secret Manager

在本地環境中，你可以直接使用環境變數：

```env
# .env.local
TELEGRAM_BOT_TOKEN=123456789:your-test-bot-token
```

然後修改 `src/lib/secret-manager.ts` 以在本地環境中使用環境變數。

## 常見問題

### Q: Firestore 模擬器無法啟動

**A**: 檢查端口是否被占用：
```bash
lsof -i :8080
# 如果有程序占用，終止它或更改端口
```

### Q: 無法連接到 PTT

**A**: PTT 可能會限制某些 IP 或 User-Agent，嘗試：
1. 使用不同的 User-Agent
2. 添加延遲避免過於頻繁的請求
3. 檢查網路連接

### Q: 測試失敗

**A**: 確保：
1. 所有依賴都已安裝：`npm install`
2. 環境變數正確設定
3. 模擬器正在運行

### Q: Docker 容器無法啟動

**A**: 檢查：
```bash
# 檢查 Docker 狀態
docker --version
docker-compose --version

# 檢查容器日誌
docker-compose logs firestore
```

## 開發工作流程

### 1. 功能開發

```bash
# 1. 創建功能分支
git checkout -b feature/new-feature

# 2. 啟動開發環境
docker-compose up -d

# 3. 開發和測試
npm run dev
npm test

# 4. 提交變更
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

### 2. 除錯

```bash
# 啟用除錯模式
DEBUG=true npm run dev

# 查看詳細日誌
docker-compose logs -f web

# 使用 Chrome DevTools 除錯
# 在瀏覽器中打開 http://localhost:3000
```

### 3. 效能測試

```bash
# 運行效能測試
npm run test:performance

# 使用 Artillery 進行負載測試
npx artillery quick --count 10 --num 5 http://localhost:3000/api/health
```

## 生產環境準備

### 1. 建置檢查

```bash
# 建置應用程式
npm run build

# 啟動生產模式
npm start
```

### 2. Docker 建置

```bash
# 建置 Docker 映像
docker build -t ptt-telegram-scheduler .

# 測試 Docker 映像
docker run -p 3000:3000 ptt-telegram-scheduler
```

### 3. 部署前檢查

```bash
# 運行所有測試
npm run test:ci

# 檢查程式碼品質
npm run lint
npm run type-check

# 安全性掃描
npm audit
```

## 有用的腳本

創建 `scripts/dev-helpers.sh`：

```bash
#!/bin/bash

# 快速重設本地環境
reset_local() {
    docker-compose down -v
    docker-compose up -d
    npm run dev
}

# 匯出本地資料
export_data() {
    mkdir -p ./local-data
    curl -X GET http://localhost:8080/emulator/v1/projects/local-dev-project/databases/(default)/documents > ./local-data/firestore-export.json
}

# 匯入測試資料
import_test_data() {
    curl -X POST http://localhost:3000/api/test/seed-data
}

# 清理本地資料
clean_data() {
    curl -X DELETE http://localhost:8080/emulator/v1/projects/local-dev-project/databases/(default)/documents
}
```

## 總結

本地開發環境提供了：

- ✅ **完整的功能測試** - 無需部署到雲端
- ✅ **快速迭代** - 熱重載和即時反饋
- ✅ **成本效益** - 無雲端資源費用
- ✅ **離線開發** - 不依賴網路連接
- ✅ **除錯友好** - 完整的日誌和除錯工具

建議的開發流程：
1. 使用 Docker Compose 快速啟動
2. 在本地開發和測試功能
3. 運行完整測試套件
4. 部署到 staging 環境驗證
5. 部署到生產環境

這樣可以大大提高開發效率，減少對雲端資源的依賴！