# Cloud Scheduler 設定指南

本指南將協助您設定 Google Cloud Scheduler 來定期觸發 PTT 文章抓取和 Telegram 傳送任務。

## 概述

Cloud Scheduler 是 Google Cloud 提供的完全託管的 cron 工作排程服務。在我們的 PTT Telegram 排程器中，它負責定期觸發 Cloud Function 來執行文章抓取和傳送任務。

## 架構圖

```
Cloud Scheduler → Cloud Function → PTT 網站
                       ↓
                 Secret Manager (Bot Token)
                       ↓
                 Telegram Bot API
                       ↓
                 Firestore (配置 & 日誌)
```

## 前置需求

1. **Google Cloud 專案**：已建立並啟用計費的 GCP 專案
2. **Cloud Function**：已部署的 PTT 抓取 Cloud Function
3. **App Engine 應用程式**：Cloud Scheduler 需要（會自動建立）
4. **必要權限**：具有以下 IAM 角色的帳戶：
   - `roles/cloudscheduler.admin`（用於建立和管理排程工作）
   - `roles/cloudfunctions.admin`（用於設定函數調用權限）

## 快速設定

### 方法 1：使用自動設定腳本

```bash
# 執行 Cloud Scheduler 設定腳本
./scripts/setup-cloud-scheduler.sh

# 或者指定自訂參數
./scripts/setup-cloud-scheduler.sh \
  --project your-project-id \
  --region us-central1 \
  --schedule "*/15 * * * *" \
  --function-name ptt-scraper
```

### 方法 2：使用配置文件部署

```bash
# 編輯配置文件
cp config/scheduler-config.yaml config/my-scheduler-config.yaml
# 修改 my-scheduler-config.yaml 中的設定

# 部署配置
python3 scripts/deploy-scheduler-from-config.py \
  --config config/my-scheduler-config.yaml \
  --environment production
```

## 手動設定步驟

### 1. 啟用必要的 API

```bash
# 設定專案 ID
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 啟用必要的 API
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable appengine.googleapis.com
```

### 2. 建立 App Engine 應用程式

```bash
# Cloud Scheduler 需要 App Engine 應用程式
gcloud app create --region=us-central1
```

### 3. 建立 Scheduler 工作

```bash
# 基本的 HTTP 工作
gcloud scheduler jobs create http ptt-telegram-scheduler \
  --location=us-central1 \
  --schedule="*/15 * * * *" \
  --time-zone="Asia/Taipei" \
  --uri="https://us-central1-your-project-id.cloudfunctions.net/ptt-scraper" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body="{}" \
  --description="定期觸發 PTT 文章抓取和 Telegram 傳送任務"
```

### 4. 設定 IAM 權限

```bash
# 取得專案編號
PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format="value(projectNumber)")

# 為 Cloud Scheduler 設定 Cloud Functions 調用權限
gcloud functions add-iam-policy-binding ptt-scraper \
  --region=us-central1 \
  --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"
```

## 排程格式說明

Cloud Scheduler 使用標準的 Unix cron 格式：

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── 星期幾 (0-7, 0 和 7 都代表星期日)
│ │ │ └───── 月份 (1-12)
│ │ └─────── 日期 (1-31)
│ └───────── 小時 (0-23)
└─────────── 分鐘 (0-59)
```

### 常用排程範例

| 排程表達式     | 說明                         |
| -------------- | ---------------------------- |
| `*/15 * * * *` | 每 15 分鐘執行一次           |
| `*/30 * * * *` | 每 30 分鐘執行一次           |
| `0 * * * *`    | 每小時執行一次               |
| `0 */2 * * *`  | 每 2 小時執行一次            |
| `0 9 * * *`    | 每天上午 9 點執行            |
| `0 9,18 * * *` | 每天上午 9 點和下午 6 點執行 |
| `0 9 * * 1-5`  | 工作日上午 9 點執行          |
| `0 10 * * 6,7` | 週末上午 10 點執行           |
| `0 9 1 * *`    | 每月 1 日上午 9 點執行       |

## 管理和監控

### 使用管理工具

```bash
# 列出所有工作
npx tsx scripts/manage-scheduler.ts list

# 查看工作詳情
npx tsx scripts/manage-scheduler.ts describe ptt-telegram-scheduler

# 手動觸發工作
npx tsx scripts/manage-scheduler.ts run ptt-telegram-scheduler

# 暫停工作
npx tsx scripts/manage-scheduler.ts pause ptt-telegram-scheduler

# 恢復工作
npx tsx scripts/manage-scheduler.ts resume ptt-telegram-scheduler

# 更新排程
npx tsx scripts/manage-scheduler.ts update-schedule ptt-telegram-scheduler "*/30 * * * *"

# 查看執行日誌
npx tsx scripts/manage-scheduler.ts logs ptt-telegram-scheduler

# 持續監控
npx tsx scripts/manage-scheduler.ts monitor ptt-telegram-scheduler --watch
```

### 使用 gcloud 命令

```bash
# 列出所有工作
gcloud scheduler jobs list --location=us-central1

# 查看工作詳情
gcloud scheduler jobs describe ptt-telegram-scheduler --location=us-central1

# 手動觸發工作
gcloud scheduler jobs run ptt-telegram-scheduler --location=us-central1

# 暫停工作
gcloud scheduler jobs pause ptt-telegram-scheduler --location=us-central1

# 恢復工作
gcloud scheduler jobs resume ptt-telegram-scheduler --location=us-central1

# 更新工作
gcloud scheduler jobs update http ptt-telegram-scheduler \
  --location=us-central1 \
  --schedule="*/30 * * * *"

# 刪除工作
gcloud scheduler jobs delete ptt-telegram-scheduler --location=us-central1
```

## 測試和驗證

### 執行測試腳本

```bash
# 執行完整測試
./scripts/test-scheduler.sh --full-test

# 只測試手動觸發
./scripts/test-scheduler.sh --trigger-only

# 只檢查狀態
./scripts/test-scheduler.sh --check-only

# 持續監控模式
./scripts/test-scheduler.sh --monitor

# 查看日誌
./scripts/test-scheduler.sh --logs
```

### 手動驗證步驟

1. **檢查工作狀態**：

```bash
gcloud scheduler jobs describe ptt-telegram-scheduler --location=us-central1
```

2. **手動觸發測試**：

```bash
gcloud scheduler jobs run ptt-telegram-scheduler --location=us-central1
```

3. **查看 Cloud Function 日誌**：

```bash
gcloud functions logs read ptt-scraper --region=us-central1 --limit=50
```

4. **檢查 Firestore 執行記錄**：

```bash
gcloud firestore documents list --collection-ids=executions --limit=10
```

## 進階配置

### 多環境部署

```bash
# 開發環境（每 5 分鐘執行一次）
python3 scripts/deploy-scheduler-from-config.py \
  --environment development \
  --config config/scheduler-config.yaml

# 測試環境
python3 scripts/deploy-scheduler-from-config.py \
  --environment staging \
  --config config/scheduler-config.yaml

# 生產環境
python3 scripts/deploy-scheduler-from-config.py \
  --environment production \
  --config config/scheduler-config.yaml
```

### 自訂服務帳戶

```bash
# 建立自訂服務帳戶
gcloud iam service-accounts create ptt-scheduler \
  --display-name="PTT Scheduler Service Account"

# 授予必要權限
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
  --member="serviceAccount:ptt-scheduler@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"

# 在建立工作時指定服務帳戶
gcloud scheduler jobs create http ptt-telegram-scheduler \
  --oidc-service-account-email="ptt-scheduler@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
  # ... 其他參數
```

### 重試配置

```bash
# 設定重試參數
gcloud scheduler jobs create http ptt-telegram-scheduler \
  --max-retry-attempts=3 \
  --max-retry-duration=300s \
  --min-backoff-duration=5s \
  --max-backoff-duration=60s \
  # ... 其他參數
```

## 監控和警報

### 設定日誌監控

```bash
# 查看 Scheduler 日誌
gcloud logging read "resource.type=cloud_scheduler_job" \
  --limit=50 \
  --format="table(timestamp,severity,jsonPayload.message)"
```

### 建立警報政策

```yaml
# alerting-policy.yaml
displayName: "Cloud Scheduler Job Failures"
conditions:
  - displayName: "Scheduler job failures"
    conditionThreshold:
      filter: 'resource.type="cloud_scheduler_job" AND severity="ERROR"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 3
      duration: 300s
notificationChannels:
  - "projects/your-project-id/notificationChannels/your-channel-id"
```

### 效能監控

```bash
# 查看執行統計
gcloud scheduler jobs describe ptt-telegram-scheduler \
  --location=us-central1 \
  --format="table(lastAttemptTime,status.code,status.message)"
```

## 疑難排解

### 常見問題

#### 1. 工作建立失敗

**錯誤訊息**：

```
ERROR: App Engine application not found
```

**解決方案**：

```bash
# 建立 App Engine 應用程式
gcloud app create --region=us-central1
```

#### 2. 權限被拒絕

**錯誤訊息**：

```
ERROR: Permission denied on Cloud Function
```

**解決方案**：

```bash
# 設定 IAM 權限
PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format="value(projectNumber)")
gcloud functions add-iam-policy-binding ptt-scraper \
  --region=us-central1 \
  --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"
```

#### 3. 工作執行失敗

**錯誤訊息**：

```
Function execution failed
```

**解決方案**：

1. 檢查 Cloud Function 日誌
2. 驗證 Secret Manager 設定
3. 確認 Firestore 權限
4. 檢查網路連接

#### 4. 排程不正確

**問題**：工作沒有按預期時間執行

**解決方案**：

1. 檢查時區設定
2. 驗證 cron 表達式
3. 確認工作狀態為 ENABLED

### 除錯工具

#### 1. 檢查工作狀態

```bash
# 詳細狀態檢查
gcloud scheduler jobs describe ptt-telegram-scheduler \
  --location=us-central1 \
  --format="yaml"
```

#### 2. 測試網路連接

```bash
# 測試 Cloud Function URL
curl -X POST "https://us-central1-your-project-id.cloudfunctions.net/ptt-scraper" \
  -H "Content-Type: application/json" \
  -d "{}"
```

#### 3. 驗證 IAM 權限

```bash
# 檢查服務帳戶權限
gcloud functions get-iam-policy ptt-scraper --region=us-central1
```

## 成本最佳化

### 計費方式

Cloud Scheduler 的計費方式：

- **工作數量**：每個工作每月前 3 個免費，之後每個工作每月 $0.10
- **執行次數**：不額外收費

### 最佳化建議

1. **合理設定執行頻率**：

   - 避免過於頻繁的執行
   - 根據實際需求調整排程

2. **使用條件執行**：

   - 在 Cloud Function 中實作智慧排程邏輯
   - 避免不必要的執行

3. **監控使用量**：
   - 定期檢查執行統計
   - 移除不需要的工作

## 安全最佳實務

### 1. 最小權限原則

```bash
# 只授予必要的權限
gcloud functions add-iam-policy-binding ptt-scraper \
  --member="serviceAccount:scheduler-sa@project.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"
```

### 2. 網路安全

```bash
# 使用 HTTPS 端點
--uri="https://us-central1-project.cloudfunctions.net/function"

# 設定適當的標頭
--headers="Content-Type=application/json,Authorization=Bearer token"
```

### 3. 審計日誌

```bash
# 啟用審計日誌
gcloud logging sinks create scheduler-audit-sink \
  bigquery.googleapis.com/projects/project/datasets/audit_logs \
  --log-filter='protoPayload.serviceName="cloudscheduler.googleapis.com"'
```

## 相關資源

- [Google Cloud Scheduler 文件](https://cloud.google.com/scheduler/docs)
- [Cron 表達式參考](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules)
- [Cloud Functions 觸發器](https://cloud.google.com/functions/docs/calling)
- [IAM 最佳實務](https://cloud.google.com/iam/docs/using-iam-securely)

## 支援

如果您遇到問題：

1. 檢查本文件的疑難排解章節
2. 執行測試腳本：`./scripts/test-scheduler.sh --full-test`
3. 查看 Google Cloud Console 中的錯誤日誌
4. 使用管理工具進行診斷：`npx tsx scripts/manage-scheduler.ts check-env`
5. 聯繫專案維護者或建立 Issue
