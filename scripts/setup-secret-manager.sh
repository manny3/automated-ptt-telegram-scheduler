#!/bin/bash

# Secret Manager 設定腳本
# 此腳本會建立必要的密鑰並設定適當的 IAM 權限

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
TELEGRAM_BOT_TOKEN_SECRET_NAME=${TELEGRAM_BOT_TOKEN_SECRET_NAME:-"telegram-bot-token"}
SERVICE_ACCOUNT_EMAIL=""
REGION=${REGION:-"us-central1"}

# 函數：印出彩色訊息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 函數：檢查必要工具
check_prerequisites() {
    print_info "檢查必要工具..."
    
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI 未安裝。請安裝 Google Cloud SDK。"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_warning "jq 未安裝。某些功能可能無法正常運作。"
    fi
    
    print_success "必要工具檢查完成"
}

# 函數：驗證專案設定
validate_project() {
    print_info "驗證 GCP 專案設定..."
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "GOOGLE_CLOUD_PROJECT 環境變數未設定"
        print_info "請執行: export GOOGLE_CLOUD_PROJECT=your-project-id"
        print_info "或執行: gcloud config set project your-project-id"
        exit 1
    fi
    
    print_info "使用專案 ID: $PROJECT_ID"
    
    # 檢查專案是否存在
    if ! gcloud projects describe "$PROJECT_ID" &> /dev/null; then
        print_error "專案 $PROJECT_ID 不存在或無法存取"
        exit 1
    fi
    
    print_success "專案驗證完成"
}

# 函數：啟用必要的 API
enable_apis() {
    print_info "啟用必要的 Google Cloud API..."
    
    local apis=(
        "secretmanager.googleapis.com"
        "cloudfunctions.googleapis.com"
        "cloudscheduler.googleapis.com"
        "run.googleapis.com"
        "firestore.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        print_info "啟用 $api..."
        if gcloud services enable "$api" --project="$PROJECT_ID"; then
            print_success "$api 已啟用"
        else
            print_error "無法啟用 $api"
            exit 1
        fi
    done
    
    print_success "所有必要 API 已啟用"
}

# 函數：建立 Telegram Bot Token 密鑰
create_telegram_secret() {
    print_info "設定 Telegram Bot Token 密鑰..."
    
    # 檢查密鑰是否已存在
    if gcloud secrets describe "$TELEGRAM_BOT_TOKEN_SECRET_NAME" --project="$PROJECT_ID" &> /dev/null; then
        print_warning "密鑰 $TELEGRAM_BOT_TOKEN_SECRET_NAME 已存在"
        
        read -p "是否要更新現有密鑰？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "跳過密鑰建立"
            return 0
        fi
    else
        # 建立新密鑰
        print_info "建立新密鑰: $TELEGRAM_BOT_TOKEN_SECRET_NAME"
        if ! gcloud secrets create "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
            --project="$PROJECT_ID" \
            --labels="service=ptt-telegram-scheduler,environment=production"; then
            print_error "無法建立密鑰"
            exit 1
        fi
        print_success "密鑰已建立"
    fi
    
    # 提示使用者輸入 Token
    echo
    print_info "請輸入您的 Telegram Bot Token"
    print_info "Token 格式應該像這樣: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    print_info "您可以從 @BotFather 取得此 Token"
    echo
    
    read -s -p "Telegram Bot Token: " TELEGRAM_TOKEN
    echo
    
    if [ -z "$TELEGRAM_TOKEN" ]; then
        print_error "Token 不能為空"
        exit 1
    fi
    
    # 驗證 Token 格式
    if [[ ! $TELEGRAM_TOKEN =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        print_error "Token 格式無效。正確格式: 數字:字母數字字符"
        exit 1
    fi
    
    # 儲存 Token
    print_info "儲存 Telegram Bot Token..."
    if echo "$TELEGRAM_TOKEN" | gcloud secrets versions add "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
        --project="$PROJECT_ID" \
        --data-file=-; then
        print_success "Telegram Bot Token 已儲存"
    else
        print_error "無法儲存 Token"
        exit 1
    fi
}

# 函數：設定 IAM 權限
setup_iam_permissions() {
    print_info "設定 IAM 權限..."
    
    # 取得 Cloud Functions 服務帳戶
    local cf_service_account="$PROJECT_ID@appspot.gserviceaccount.com"
    
    # 取得 Cloud Run 服務帳戶
    local cr_service_account=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")-compute@developer.gserviceaccount.com
    
    # 為 Cloud Functions 設定權限
    print_info "為 Cloud Functions 設定 Secret Manager 存取權限..."
    gcloud secrets add-iam-policy-binding "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:$cf_service_account" \
        --role="roles/secretmanager.secretAccessor"
    
    # 為 Cloud Run 設定權限
    print_info "為 Cloud Run 設定 Secret Manager 存取權限..."
    gcloud secrets add-iam-policy-binding "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:$cr_service_account" \
        --role="roles/secretmanager.secretAccessor"
    
    # 如果有自訂服務帳戶，也為其設定權限
    if [ -n "$SERVICE_ACCOUNT_EMAIL" ]; then
        print_info "為自訂服務帳戶設定權限: $SERVICE_ACCOUNT_EMAIL"
        gcloud secrets add-iam-policy-binding "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
            --project="$PROJECT_ID" \
            --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
            --role="roles/secretmanager.secretAccessor"
    fi
    
    print_success "IAM 權限設定完成"
}

# 函數：驗證設定
verify_setup() {
    print_info "驗證 Secret Manager 設定..."
    
    # 檢查密鑰是否存在
    if ! gcloud secrets describe "$TELEGRAM_BOT_TOKEN_SECRET_NAME" --project="$PROJECT_ID" &> /dev/null; then
        print_error "密鑰 $TELEGRAM_BOT_TOKEN_SECRET_NAME 不存在"
        return 1
    fi
    
    # 檢查是否有最新版本
    local latest_version=$(gcloud secrets versions list "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
        --project="$PROJECT_ID" \
        --limit=1 \
        --format="value(name)")
    
    if [ -z "$latest_version" ]; then
        print_error "密鑰沒有任何版本"
        return 1
    fi
    
    print_success "密鑰驗證完成"
    print_info "密鑰名稱: $TELEGRAM_BOT_TOKEN_SECRET_NAME"
    print_info "最新版本: $latest_version"
    
    # 顯示 IAM 政策
    print_info "IAM 政策:"
    gcloud secrets get-iam-policy "$TELEGRAM_BOT_TOKEN_SECRET_NAME" \
        --project="$PROJECT_ID" \
        --format="table(bindings.role,bindings.members.flatten())"
}

# 函數：建立測試腳本
create_test_script() {
    print_info "建立測試腳本..."
    
    cat > test-secret-access.sh << EOF
#!/bin/bash

# Secret Manager 存取測試腳本

set -e

PROJECT_ID="$PROJECT_ID"
SECRET_NAME="$TELEGRAM_BOT_TOKEN_SECRET_NAME"

echo "測試 Secret Manager 存取..."
echo "專案 ID: \$PROJECT_ID"
echo "密鑰名稱: \$SECRET_NAME"
echo

# 測試密鑰存取
echo "正在取得密鑰..."
if SECRET_VALUE=\$(gcloud secrets versions access latest --secret="\$SECRET_NAME" --project="\$PROJECT_ID" 2>/dev/null); then
    echo "✅ 成功取得密鑰"
    echo "Token 長度: \${#SECRET_VALUE} 字符"
    
    # 驗證 Token 格式
    if [[ \$SECRET_VALUE =~ ^[0-9]+:[A-Za-z0-9_-]+\$ ]]; then
        echo "✅ Token 格式有效"
    else
        echo "❌ Token 格式無效"
        exit 1
    fi
else
    echo "❌ 無法取得密鑰"
    exit 1
fi

echo
echo "Secret Manager 設定測試完成！"
EOF
    
    chmod +x test-secret-access.sh
    print_success "測試腳本已建立: test-secret-access.sh"
}

# 函數：顯示後續步驟
show_next_steps() {
    echo
    print_success "Secret Manager 設定完成！"
    echo
    print_info "後續步驟:"
    echo "1. 執行測試腳本驗證設定: ./test-secret-access.sh"
    echo "2. 在您的應用程式中設定環境變數:"
    echo "   export GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
    echo "   export TELEGRAM_BOT_TOKEN_SECRET_NAME=$TELEGRAM_BOT_TOKEN_SECRET_NAME"
    echo "3. 部署 Cloud Function 和 Cloud Run 服務"
    echo "4. 設定 Cloud Scheduler 定期執行任務"
    echo
    print_info "重要提醒:"
    echo "- 請妥善保管您的 Telegram Bot Token"
    echo "- 定期檢查 IAM 權限設定"
    echo "- 監控 Secret Manager 的存取日誌"
    echo
}

# 主函數
main() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - Secret Manager 設定"
    echo "=================================================="
    echo
    
    # 解析命令列參數
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project)
                PROJECT_ID="$2"
                shift 2
                ;;
            --secret-name)
                TELEGRAM_BOT_TOKEN_SECRET_NAME="$2"
                shift 2
                ;;
            --service-account)
                SERVICE_ACCOUNT_EMAIL="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --help)
                echo "使用方式: $0 [選項]"
                echo
                echo "選項:"
                echo "  --project PROJECT_ID              GCP 專案 ID"
                echo "  --secret-name SECRET_NAME          密鑰名稱 (預設: telegram-bot-token)"
                echo "  --service-account EMAIL            自訂服務帳戶電子郵件"
                echo "  --region REGION                    地區 (預設: us-central1)"
                echo "  --help                             顯示此說明"
                echo
                exit 0
                ;;
            *)
                print_error "未知選項: $1"
                print_info "使用 --help 查看可用選項"
                exit 1
                ;;
        esac
    done
    
    # 執行設定步驟
    check_prerequisites
    validate_project
    enable_apis
    create_telegram_secret
    setup_iam_permissions
    verify_setup
    create_test_script
    show_next_steps
}

# 執行主函數
main "$@"