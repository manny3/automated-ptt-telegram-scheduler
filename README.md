# PTT Telegram Scheduler

Automated PTT article fetcher with Telegram bot integration built with Next.js and Google Cloud Platform.

## Features

- Web-based configuration interface for PTT article fetching
- Scheduled article retrieval with keyword filtering
- Telegram bot integration for article delivery
- Execution history and monitoring dashboard
- Google Cloud Platform integration (Firestore, Secret Manager, Cloud Functions)

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Google Cloud Firestore
- **Authentication**: Google Cloud IAM
- **Deployment**: Google Cloud Run, Cloud Functions
- **Scheduling**: Google Cloud Scheduler

## Getting Started

### 🚀 本地開發 (推薦)

最快的開始方式是在本地環境中開發和測試：

```bash
# 1. 克隆專案
git clone <repository-url>
cd automated-ptt-telegram-scheduler

# 2. 運行自動設定腳本
./scripts/dev-setup.sh
```

這個腳本會自動：
- ✅ 檢查系統需求 (Node.js, Docker)
- ✅ 安裝依賴
- ✅ 設定環境變數
- ✅ 啟動本地服務 (Firestore 模擬器等)
- ✅ 創建測試資料

**本地開發優勢**：
- 🚀 快速迭代，無需部署到雲端
- 💰 零雲端費用
- 🔧 完整的除錯工具
- 📱 離線開發
- 🧪 完整的測試環境

**本地服務端點**：
- Web 應用程式: http://localhost:3000
- Firestore 模擬器: http://localhost:8080
- Firestore UI: http://localhost:4000

詳細說明請參考：[📖 本地開發指南](docs/local-development.md)

### ☁️ 雲端部署

#### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account with billing enabled
- Telegram Bot Token (create via @BotFather)
- Docker (可選，但建議安裝)

#### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`

5. Set up Google Cloud authentication:
   - Create a service account with Firestore and Secret Manager permissions
   - Download the service account key JSON file
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your key file

6. Deploy to Google Cloud:
   ```bash
   ./scripts/deploy-all.sh
   ```

7. Or run locally:
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key file
- `FIRESTORE_DATABASE_ID`: Firestore database ID (default: "(default)")
- `TELEGRAM_BOT_TOKEN_SECRET_NAME`: Secret Manager secret name for Telegram bot token

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ConfigurationForm.tsx
│   ├── ConfigurationList.tsx
│   ├── Dashboard.tsx
│   └── TaskHistory.tsx
├── lib/                   # Utility libraries
│   ├── firestore.ts       # Firestore client
│   └── secret-manager.ts  # Secret Manager client
└── types/                 # TypeScript type definitions
    └── index.ts
```

## Development

### 開發命令

- `npm run dev` - 啟動開發伺服器
- `npm run build` - 建置生產版本
- `npm run start` - 啟動生產伺服器
- `npm run lint` - 執行 ESLint 檢查
- `npm run type-check` - 執行 TypeScript 類型檢查

### 測試命令

- `npm test` - 執行所有測試
- `npm run test:unit` - 執行單元測試
- `npm run test:integration` - 執行整合測試
- `npm run test:e2e` - 執行端到端測試
- `npm run test:performance` - 執行效能測試
- `npm run test:coverage` - 執行測試並生成覆蓋率報告
- `npm run test:watch` - 監視模式執行測試

### 本地測試 API

```bash
# 健康檢查
curl http://localhost:3000/api/health

# 測試 PTT 爬取
curl -X POST http://localhost:3000/api/test/ptt-scraper \
  -H "Content-Type: application/json" \
  -d '{"board": "Gossiping", "keywords": ["測試"], "postCount": 5}'

# 測試 Telegram 發送
curl -X POST http://localhost:3000/api/test/telegram \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456789", "message": "測試訊息", "testMode": true}'

# 創建測試資料
curl -X POST http://localhost:3000/api/test/seed-data
```

### Docker 開發

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

## Deployment

This application is designed to be deployed on Google Cloud Platform:

1. **Cloud Run**: For the Next.js web application
2. **Cloud Functions**: For the PTT scraping and Telegram delivery
3. **Cloud Scheduler**: For triggering scheduled tasks
4. **Firestore**: For data storage
5. **Secret Manager**: For secure token storage

See the deployment documentation for detailed instructions.

## License

ISC