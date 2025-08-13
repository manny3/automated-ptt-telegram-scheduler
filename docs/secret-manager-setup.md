# Secret Manager 設定指南

本指南將協助您設定 Google Cloud Secret Manager 來安全地儲存和管理 Telegram Bot Token。

## 概述

Secret Manager 是 Google Cloud 提供的安全密鑰管理服務，用於儲存 API 金鑰、密碼、憑證和其他敏感資料。在我們的 PTT Telegram 排程器中，我們使用它來安全地儲存 Telegram Bot Token。

## 前置需求

1. **Google Cloud 專案**：已建立並啟用計費的 GCP 專案
2. **gcloud CLI**：已安裝並設定的 Google Cloud SDK
3. **必要權限**：具有以下 IAM 角色的帳戶：
   - `roles/secretmanager.admin`（用於建立和管理密鑰）
   - `roles/iam.securityAdmin`（用於設定 IAM 權限）

## 快速設定

### 1. 執行自動設定腳本

我們提供了一個自動化腳本來簡化設定過程：

```bash
# 執行 Secret Manager 設定腳本
./scripts/setup-secret-manager.sh

# 或者指定自訂參數
./scripts/setup-secret-manager.sh \
  --project your-project-id \
  --secret-name telegram-bot-token \
  --region us-central1
```

腳本會自動執行以下步驟：
- 啟用必要的 Google Cloud API
- 建立 Telegram Bot Token 密鑰
- 設定適當的 IAM 權限
- 建立測試腳本驗證設定

### 2. 手動設定（進階使用者）

如果您偏好手動設定，請按照以下步驟：

#### 步驟 1：啟用 API

```bash
# 設定專案 ID
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 啟用必要的 API
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable run.googleapis.com
```

#### 步驟 2：建立密鑰

```bash
# 建立 Telegram Bot Token 密鑰
gcloud secrets create telegram-bot-token \
  --project=$GOOGLE_CLOUD_PROJECT \
  --labels="service=ptt-telegram-scheduler,environment=production"

# 儲存 Token 值（請替換為您的實際 Token）
echo "YOUR_TELEGRAM_BOT_TOKEN" | gcloud secrets versions add telegram-bot-token \
  --project=$GOOGLE_CLOUD_PROJECT \
  --data-file=-
```

#### 步驟 3：設定 IAM 權限

```bash
# 為 Cloud Functions 設定權限
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --project=$GOOGLE_CLOUD_PROJECT \
  --member="serviceAccount:$GOOGLE_CLOUD_PROJECT@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 為 Cloud Run 設定權限
PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --project=$GOOGLE_CLOUD_PROJECT \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 驗證設定

### 1. 使用測試腳本

```bash
# 執行自動產生的測試腳本
./test-secret-access.sh
```

### 2. 使用管理工具

```bash
# 檢查環境設定
npx tsx scripts/manage-secrets.ts check-env

# 列出所有密鑰
npx tsx scripts/manage-secrets.ts list

# 驗證特定密鑰
npx tsx scripts/manage-secrets.ts validate telegram-bot-token

# 測試 Telegram Bot Token
npx tsx scripts/manage-secrets.ts test-telegram
```

### 3. 手動驗證

```bash
# 檢查密鑰是否存在
gcloud secrets describe telegram-bot-token --project=$GOOGLE_CLOUD_PROJECT

# 測試密鑰存取（不會顯示實際值）
gcloud secrets versions access latest --secret=telegram-bot-token --project=$GOOGLE_CLOUD_PROJECT > /dev/null && echo "✅ 密鑰存取成功" || echo "❌ 密鑰存取失敗"
```

## 應用程式整合

### 環境變數設定

在您的應用程式中設定以下環境變數：

```bash
# .env 檔案
GOOGLE_CLOUD_PROJECT=your-project-id
TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token
```

### TypeScript 程式碼範例

```typescript
import { getTelegramBotToken, validateSecretAccess } from '@/lib/secret-manager'

async function initializeTelegramBot() {
  try {
    // 驗證密鑰是否可存取
    const isAccessible = await validateSecretAccess('telegram-bot-token')
    if (!isAccessible) {
      throw new Error('無法存取 Telegram Bot Token')
    }
    
    // 取得 Token
    const token = await getTelegramBotToken()
    
    // 初始化 Telegram Bot
    const bot = new TelegramBot(token)
    
    console.log('Telegram Bot 初始化成功')
    return bot
    
  } catch (error) {
    console.error('Telegram Bot 初始化失敗:', error)
    throw error
  }
}
```

### Cloud Function 部署

```bash
# 部署時設定環境變數
gcloud functions deploy ptt-scraper \
  --runtime python39 \
  --trigger-http \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token
```

### Cloud Run 部署

```bash
# 部署時設定環境變數
gcloud run deploy ptt-telegram-scheduler \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/ptt-telegram-scheduler \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token
```

## 安全最佳實務

### 1. 最小權限原則

只授予必要的最小權限：

```bash
# 只授予 secretAccessor 角色，不要授予 admin 角色
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --member="serviceAccount:service-account@project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. 定期輪換密鑰

```bash
# 建立新版本的密鑰
echo "NEW_TELEGRAM_BOT_TOKEN" | gcloud secrets versions add telegram-bot-token \
  --data-file=-

# 停用舊版本
gcloud secrets versions disable VERSION_NUMBER --secret=telegram-bot-token
```

### 3. 監控存取

```bash
# 檢視密鑰存取日誌
gcloud logging read "resource.type=secret_manager_secret AND resource.labels.secret_id=telegram-bot-token" \
  --limit=50 \
  --format="table(timestamp,severity,jsonPayload.method_name,jsonPayload.caller_ip)"
```

### 4. 備份和災難復原

```bash
# 匯出密鑰中繼資料（不包含實際值）
gcloud secrets describe telegram-bot-token --format=json > telegram-bot-token-metadata.json

# 在另一個專案中重建密鑰結構
gcloud secrets create telegram-bot-token \
  --project=backup-project \
  --labels="$(cat telegram-bot-token-metadata.json | jq -r '.labels | to_entries | map("\(.key)=\(.value)") | join(",")')"
```

## 疑難排解

### 常見問題

#### 1. 權限被拒絕錯誤

```
Error: Permission denied on secret telegram-bot-token
```

**解決方案：**
```bash
# 檢查 IAM 權限
gcloud secrets get-iam-policy telegram-bot-token

# 重新設定權限
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

#### 2. 密鑰不存在錯誤

```
Error: Secret telegram-bot-token not found
```

**解決方案：**
```bash
# 檢查密鑰是否存在
gcloud secrets list --filter="name:telegram-bot-token"

# 如果不存在，重新建立
gcloud secrets create telegram-bot-token
```

#### 3. Token 格式無效錯誤

```
Error: Telegram Bot Token 格式無效
```

**解決方案：**
- 確認 Token 格式為：`數字:字母數字字符`
- 從 @BotFather 重新取得正確的 Token
- 更新密鑰值

#### 4. 環境變數未設定

```
Error: GOOGLE_CLOUD_PROJECT environment variable is not set
```

**解決方案：**
```bash
# 設定環境變數
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 或在 .env 檔案中設定
echo "GOOGLE_CLOUD_PROJECT=your-project-id" >> .env
```

### 除錯工具

#### 1. 檢查服務帳戶權限

```bash
# 檢查目前使用的服務帳戶
gcloud auth list

# 檢查服務帳戶權限
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:YOUR_SERVICE_ACCOUNT"
```

#### 2. 測試 API 連接

```bash
# 測試 Secret Manager API
gcloud secrets list --limit=1

# 測試特定密鑰存取
gcloud secrets versions access latest --secret=telegram-bot-token --dry-run
```

#### 3. 檢查網路連接

```bash
# 測試 Google Cloud API 連接
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://secretmanager.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/secrets"
```

## 成本考量

Secret Manager 的計費方式：
- **密鑰版本儲存**：每個作用中版本每月 $0.06
- **API 操作**：每 10,000 次操作 $0.03
- **複製**：跨區域複製額外收費

### 成本最佳化建議

1. **定期清理舊版本**：
```bash
# 列出所有版本
gcloud secrets versions list telegram-bot-token

# 刪除不需要的版本
gcloud secrets versions destroy VERSION_NUMBER --secret=telegram-bot-token
```

2. **使用快取**：在應用程式中快取 Token，避免頻繁 API 呼叫

3. **監控使用量**：
```bash
# 檢視 Secret Manager 使用量
gcloud logging read "resource.type=secret_manager_secret" \
  --format="value(timestamp)" | wc -l
```

## 進階設定

### 1. 多環境管理

```bash
# 開發環境
gcloud secrets create telegram-bot-token-dev --labels="environment=development"

# 測試環境
gcloud secrets create telegram-bot-token-staging --labels="environment=staging"

# 生產環境
gcloud secrets create telegram-bot-token-prod --labels="environment=production"
```

### 2. 自動化部署

在 CI/CD 管道中設定密鑰：

```yaml
# GitHub Actions 範例
- name: Deploy to Cloud Functions
  run: |
    gcloud functions deploy ptt-scraper \
      --set-env-vars TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token-${{ github.ref_name }}
```

### 3. 監控和警報

```bash
# 建立密鑰存取警報
gcloud alpha monitoring policies create \
  --policy-from-file=secret-manager-alert-policy.yaml
```

## 相關資源

- [Google Cloud Secret Manager 文件](https://cloud.google.com/secret-manager/docs)
- [IAM 最佳實務](https://cloud.google.com/iam/docs/using-iam-securely)
- [Telegram Bot API 文件](https://core.telegram.org/bots/api)
- [Google Cloud 安全最佳實務](https://cloud.google.com/security/best-practices)

## 支援

如果您遇到問題：

1. 檢查本文件的疑難排解章節
2. 執行診斷工具：`npx tsx scripts/manage-secrets.ts check-env`
3. 查看 Google Cloud Console 中的錯誤日誌
4. 聯繫專案維護者或建立 Issue