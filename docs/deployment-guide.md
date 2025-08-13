# 部署指南

本指南將協助您將 PTT Telegram Scheduler 部署到 Google Cloud Platform。

## 概述

PTT Telegram Scheduler 包含以下組件：
- **Next.js 應用程式** (Cloud Run)：使用者介面和 API
- **Cloud Function**：PTT 文章抓取和 Telegram 傳送
- **Cloud Scheduler**：定期觸發抓取任務
- **Secret Manager**：安全儲存 Telegram Bot Token
- **Firestore**：儲存配置和執行歷史

## 架構圖

```
使用者 → Cloud Run (Next.js) → Firestore
                ↓
        Cloud Scheduler → Cloud Function → PTT 網站
                ↓              ↓
        Secret Manager → Telegram API
```

## 前置需求

### 1. Google Cloud Platform 設定

1. **建立 GCP 專案**：
```bash
gcloud projects create your-project-id
gcloud config set project your-project-id
```

2. **啟用計費**：
   - 在 GCP Console 中啟用專案計費

3. **安裝 Google Cloud SDK**：
   - 下載並安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
   - 執行 `gcloud auth login` 進行認證

### 2. 本地開發環境

1. **安裝 Node.js**：
   - 版本 18 或更高
   - 建議使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本

2. **安裝 Docker**：
   - [Docker Desktop](https://www.docker.com/products/docker-desktop) (macOS/Windows)
   - Docker Engine (Linux)

3. **安裝專案依賴**：
```bash
npm install
```

### 3. Telegram Bot 設定

1. **建立 Telegram Bot**：
   - 與 [@BotFather](https://t.me/botfather) 對話
   - 執行 `/newbot` 命令
   - 記錄 Bot Token

2. **取得 Chat ID**：
   - 將 Bot 加入群組或頻道
   - 使用 Bot API 取得 Chat ID

## 部署方式

### 方式 1：一鍵部署 (推薦)

使用統一部署腳本進行完整部署：

```bash
# 設定環境變數
export GOOGLE_CLOUD_PROJECT=your-project-id
export REGION=us-central1

# 執行完整部署
./scripts/deploy-all.sh
```

部署腳本會依序執行：
1. Secret Manager 設定
2. Cloud Function 部署
3. Cloud Run 部署
4. Cloud Scheduler 設定

### 方式 2：分步驟部署

#### 步驟 1：設定 Secret Manager

```bash
./scripts/setup-secret-manager.sh \
  --project your-project-id \
  --secret-name telegram-bot-token
```

#### 步驟 2：部署 Cloud Function

```bash
./scripts/deploy-cloud-function.sh \
  --project your-project-id \
  --region us-central1 \
  --function-name ptt-scraper
```

#### 步驟 3：部署 Cloud Run

```bash
./scripts/deploy-cloud-run.sh \
  --project your-project-id \
  --region us-central1 \
  --service-name ptt-telegram-scheduler
```

#### 步驟 4：設定 Cloud Scheduler

```bash
./scripts/setup-cloud-scheduler.sh \
  --project your-project-id \
  --region us-central1 \
  --schedule "*/15 * * * *"
```

### 方式 3：使用配置檔案部署

1. **編輯配置檔案**：
```bash
cp config/scheduler-config.yaml config/my-config.yaml
# 編輯 my-config.yaml
```

2. **執行配置部署**：
```bash
python3 scripts/deploy-scheduler-from-config.py \
  --config config/my-config.yaml \
  --environment production
```

## 本地開發

### 使用 Docker Compose

1. **啟動開發環境**：
```bash
# 複製環境變數範本
cp .env.example .env.local
# 編輯 .env.local

# 啟動服務
docker-compose -f docker-compose.dev.yml up -d
```

2. **存取服務**：
   - Next.js 應用程式: http://localhost:3000
   - Firestore 模擬器: http://localhost:4000
   - Redis: localhost:6379

3. **停止服務**：
```bash
docker-compose -f docker-compose.dev.yml down
```

### 直接執行

1. **啟動 Firestore 模擬器**：
```bash
gcloud emulators firestore start --host-port=localhost:8080
```

2. **設定環境變數**：
```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
export GOOGLE_CLOUD_PROJECT=your-project-id
```

3. **啟動開發伺服器**：
```bash
npm run dev
```

## 環境配置

### 環境變數

建立 `.env.local` 檔案：

```bash
# 必要設定
GOOGLE_CLOUD_PROJECT=your-project-id
TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token

# 開發環境
NODE_ENV=development
FIRESTORE_EMULATOR_HOST=localhost:8080

# 生產環境
NODE_ENV=production
# FIRESTORE_EMULATOR_HOST 留空
```

### 服務帳戶

1. **建立服務帳戶**：
```bash
gcloud iam service-accounts create ptt-scheduler-sa \
  --display-name="PTT Scheduler Service Account"
```

2. **授予權限**：
```bash
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:ptt-scheduler-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/firestore.user"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:ptt-scheduler-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 監控和維護

### 查看日誌

1. **Cloud Run 日誌**：
```bash
gcloud run services logs tail ptt-telegram-scheduler --region=us-central1
```

2. **Cloud Function 日誌**：
```bash
gcloud functions logs read ptt-scraper --region=us-central1 --limit=50
```

3. **Cloud Scheduler 日誌**：
```bash
gcloud logging read "resource.type=cloud_scheduler_job" --limit=50
```

### 健康檢查

1. **Cloud Run 健康檢查**：
```bash
curl https://your-service-url/api/health
```

2. **詳細健康檢查**：
```bash
curl https://your-service-url/api/health?detailed=true
```

### 效能監控

1. **使用 Google Cloud Monitoring**：
   - 在 GCP Console 中查看 Monitoring 儀表板
   - 設定警報和通知

2. **自訂監控**：
```bash
# 啟動 Prometheus 和 Grafana
docker-compose --profile monitoring up -d
```

## 疑難排解

### 常見問題

#### 1. 部署失敗

**檢查清單**：
- [ ] GCP 專案 ID 正確
- [ ] 必要 API 已啟用
- [ ] 服務帳戶權限正確
- [ ] Docker 正在執行
- [ ] 網路連接正常

**解決步驟**：
```bash
# 檢查 API 狀態
gcloud services list --enabled

# 檢查權限
gcloud projects get-iam-policy your-project-id

# 重新認證
gcloud auth login
gcloud auth application-default login
```

#### 2. Secret Manager 錯誤

**錯誤訊息**：`Permission denied on secret`

**解決方案**：
```bash
# 檢查密鑰是否存在
gcloud secrets list

# 檢查權限
gcloud secrets get-iam-policy telegram-bot-token

# 重新設定權限
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --member="serviceAccount:your-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 3. Firestore 連接問題

**本地開發**：
```bash
# 確認模擬器正在執行
curl http://localhost:8080

# 設定環境變數
export FIRESTORE_EMULATOR_HOST=localhost:8080
```

**生產環境**：
```bash
# 檢查 Firestore 狀態
gcloud firestore databases list

# 檢查權限
gcloud projects get-iam-policy your-project-id
```

#### 4. Docker 建構問題

**清理 Docker 快取**：
```bash
docker system prune -a
docker builder prune
```

**重新建構映像**：
```bash
docker build --no-cache -t ptt-telegram-scheduler .
```

### 除錯工具

1. **使用管理工具**：
```bash
# 檢查 Secret Manager
npx tsx scripts/manage-secrets.ts check-env

# 檢查 Cloud Scheduler
npx tsx scripts/manage-scheduler.ts check-env

# 測試完整系統
./scripts/test-scheduler.sh --full-test
```

2. **本地除錯**：
```bash
# 啟動除錯模式
npm run dev:debug

# 使用 VS Code 除錯器
# 在 .vscode/launch.json 中設定除錯配置
```

## 安全最佳實務

### 1. 權限管理

- 使用最小權限原則
- 定期檢查和更新 IAM 權限
- 使用服務帳戶而非個人帳戶

### 2. 密鑰管理

- 所有敏感資料使用 Secret Manager
- 定期輪換密鑰
- 監控密鑰存取日誌

### 3. 網路安全

- 使用 HTTPS 進行所有通信
- 設定適當的 CORS 政策
- 限制 Cloud Run 的入站流量

### 4. 監控和警報

- 設定失敗警報
- 監控異常活動
- 定期檢查日誌

## 成本最佳化

### 1. 資源配置

- 根據實際需求調整記憶體和 CPU
- 使用自動縮放功能
- 設定適當的逾時時間

### 2. 監控使用量

```bash
# 查看 Cloud Run 使用量
gcloud run services describe ptt-telegram-scheduler \
  --region=us-central1 \
  --format="table(status.traffic[].percent,status.traffic[].revisionName)"

# 查看 Cloud Function 使用量
gcloud functions describe ptt-scraper \
  --region=us-central1 \
  --format="table(status.updateTime,sourceArchiveUrl)"
```

### 3. 成本控制

- 設定預算警報
- 定期檢查計費報告
- 移除不使用的資源

## 更新和維護

### 1. 應用程式更新

```bash
# 更新 Cloud Run
./scripts/deploy-cloud-run.sh --skip-test

# 更新 Cloud Function
./scripts/deploy-cloud-function.sh --skip-test

# 零停機更新
gcloud run services update ptt-telegram-scheduler \
  --image=gcr.io/your-project-id/ptt-telegram-scheduler:new-version \
  --region=us-central1
```

### 2. 資料庫維護

```bash
# 備份 Firestore
gcloud firestore export gs://your-backup-bucket/firestore-backup

# 清理舊執行記錄
# (透過 Cloud Function 自動執行)
```

### 3. 監控維護

- 定期檢查警報設定
- 更新監控儀表板
- 檢查日誌保留政策

## 相關資源

- [Google Cloud Run 文件](https://cloud.google.com/run/docs)
- [Google Cloud Functions 文件](https://cloud.google.com/functions/docs)
- [Google Cloud Scheduler 文件](https://cloud.google.com/scheduler/docs)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- [Docker 最佳實務](https://docs.docker.com/develop/dev-best-practices/)

## 支援

如果您遇到問題：

1. 檢查本文件的疑難排解章節
2. 執行診斷工具檢查系統狀態
3. 查看 Google Cloud Console 中的錯誤日誌
4. 聯繫專案維護者或建立 Issue