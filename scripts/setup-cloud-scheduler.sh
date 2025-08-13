#!/bin/bash

# Cloud Scheduler 設定腳本
# 此腳本會建立 Cloud Scheduler 工作來定期觸發 PTT 抓取 Cloud Function

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${REGION:-"us-central1"}
SCHEDULER_JOB_NAME=${SCHEDULER_JOB_NAME:-"ptt-telegram-scheduler"}
CLOUD_FUNCTION_NAME=${CLOUD_FUNCTION_NAME:-"ptt-scraper"}
SCHEDULE=${SCHEDULE:-"*/15 * * * *"}  # 每 15 分鐘執行一次
TIME_ZONE=${TIME_ZONE:-"Asia/Taipei"}
SERVICE_ACCOUNT_EMAIL=""

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
    print_info "使用地區: $REGION"
    print_info "排程設定: $SCHEDULE"
    print_info "時區: $TIME_ZONE"
    
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
        "cloudscheduler.googleapis.com"
        "cloudfunctions.googleapis.com"
        "appengine.googleapis.com"  # Cloud Scheduler 需要
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

# 函數：檢查 Cloud Function 是否存在
check_cloud_function() {
    print_info "檢查 Cloud Function 是否存在..."
    
    if gcloud functions describe "$CLOUD_FUNCTION_NAME" --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
        print_success "Cloud Function '$CLOUD_FUNCTION_NAME' 已存在"
        
        # 取得 Function URL
        FUNCTION_URL=$(gcloud functions describe "$CLOUD_FUNCTION_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(httpsTrigger.url)")
        
        print_info "Function URL: $FUNCTION_URL"
        return 0
    else
        print_warning "Cloud Function '$CLOUD_FUNCTION_NAME' 不存在"
        print_info "請先部署 Cloud Function，或指定正確的函數名稱"
        
        read -p "是否要繼續設定 Scheduler（稍後可更新 Function URL）？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消設定"
            exit 0
        fi
        
        # 使用預設 URL 格式
        FUNCTION_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/$CLOUD_FUNCTION_NAME"
        print_warning "使用預設 URL 格式: $FUNCTION_URL"
        return 1
    fi
}

# 函數：建立或更新 App Engine 應用程式（Cloud Scheduler 需要）
setup_app_engine() {
    print_info "檢查 App Engine 應用程式..."
    
    if gcloud app describe --project="$PROJECT_ID" &> /dev/null; then
        print_success "App Engine 應用程式已存在"
    else
        print_info "建立 App Engine 應用程式..."
        print_warning "這是 Cloud Scheduler 的必要條件"
        
        if gcloud app create --region="$REGION" --project="$PROJECT_ID"; then
            print_success "App Engine 應用程式已建立"
        else
            print_error "無法建立 App Engine 應用程式"
            exit 1
        fi
    fi
}

# 函數：建立或更新 Cloud Scheduler 工作
create_scheduler_job() {
    print_info "設定 Cloud Scheduler 工作..."
    
    # 檢查工作是否已存在
    if gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" &> /dev/null; then
        
        print_warning "Scheduler 工作 '$SCHEDULER_JOB_NAME' 已存在"
        
        read -p "是否要更新現有工作？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            update_scheduler_job
        else
            print_info "跳過工作建立"
            return 0
        fi
    else
        print_info "建立新的 Scheduler 工作: $SCHEDULER_JOB_NAME"
        
        local create_cmd="gcloud scheduler jobs create http $SCHEDULER_JOB_NAME"
        create_cmd="$create_cmd --location=$REGION"
        create_cmd="$create_cmd --project=$PROJECT_ID"
        create_cmd="$create_cmd --schedule='$SCHEDULE'"
        create_cmd="$create_cmd --time-zone='$TIME_ZONE'"
        create_cmd="$create_cmd --uri='$FUNCTION_URL'"
        create_cmd="$create_cmd --http-method=POST"
        create_cmd="$create_cmd --headers='Content-Type=application/json'"
        create_cmd="$create_cmd --message-body='{}'"
        create_cmd="$create_cmd --description='定期觸發 PTT 文章抓取和 Telegram 傳送任務'"
        
        # 如果有指定服務帳戶，加入 OIDC token
        if [ -n "$SERVICE_ACCOUNT_EMAIL" ]; then
            create_cmd="$create_cmd --oidc-service-account-email=$SERVICE_ACCOUNT_EMAIL"
        fi
        
        if eval "$create_cmd"; then
            print_success "Scheduler 工作已建立"
        else
            print_error "無法建立 Scheduler 工作"
            exit 1
        fi
    fi
}

# 函數：更新現有的 Scheduler 工作
update_scheduler_job() {
    print_info "更新 Scheduler 工作: $SCHEDULER_JOB_NAME"
    
    local update_cmd="gcloud scheduler jobs update http $SCHEDULER_JOB_NAME"
    update_cmd="$update_cmd --location=$REGION"
    update_cmd="$update_cmd --project=$PROJECT_ID"
    update_cmd="$update_cmd --schedule='$SCHEDULE'"
    update_cmd="$update_cmd --time-zone='$TIME_ZONE'"
    update_cmd="$update_cmd --uri='$FUNCTION_URL'"
    update_cmd="$update_cmd --http-method=POST"
    update_cmd="$update_cmd --headers='Content-Type=application/json'"
    update_cmd="$update_cmd --message-body='{}'"
    update_cmd="$update_cmd --description='定期觸發 PTT 文章抓取和 Telegram 傳送任務'"
    
    # 如果有指定服務帳戶，加入 OIDC token
    if [ -n "$SERVICE_ACCOUNT_EMAIL" ]; then
        update_cmd="$update_cmd --oidc-service-account-email=$SERVICE_ACCOUNT_EMAIL"
    fi
    
    if eval "$update_cmd"; then
        print_success "Scheduler 工作已更新"
    else
        print_error "無法更新 Scheduler 工作"
        exit 1
    fi
}

# 函數：設定 IAM 權限
setup_iam_permissions() {
    print_info "設定 IAM 權限..."
    
    # 取得 Cloud Scheduler 服務帳戶
    local scheduler_sa="service-$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
    
    print_info "Cloud Scheduler 服務帳戶: $scheduler_sa"
    
    # 為 Cloud Scheduler 設定 Cloud Functions Invoker 權限
    print_info "設定 Cloud Functions 調用權限..."
    
    if [ -n "$FUNCTION_URL" ]; then
        # 如果 Cloud Function 存在，直接設定權限
        gcloud functions add-iam-policy-binding "$CLOUD_FUNCTION_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --member="serviceAccount:$scheduler_sa" \
            --role="roles/cloudfunctions.invoker" || print_warning "無法設定 Cloud Function 權限（可能函數不存在）"
    fi
    
    # 設定專案層級的權限（備用）
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$scheduler_sa" \
        --role="roles/cloudfunctions.invoker" || print_warning "無法設定專案層級權限"
    
    print_success "IAM 權限設定完成"
}

# 函數：測試 Scheduler 工作
test_scheduler_job() {
    print_info "測試 Scheduler 工作..."
    
    print_info "手動觸發工作進行測試..."
    if gcloud scheduler jobs run "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID"; then
        print_success "工作觸發成功"
        print_info "請檢查 Cloud Function 日誌以確認執行結果"
        print_info "日誌查看命令: gcloud functions logs read $CLOUD_FUNCTION_NAME --region=$REGION --limit=50"
    else
        print_warning "工作觸發失敗，請檢查設定"
    fi
}

# 函數：顯示工作狀態
show_job_status() {
    print_info "顯示 Scheduler 工作狀態..."
    
    echo
    print_info "工作詳細資訊:"
    gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --format="table(
            name.basename():label=NAME,
            schedule:label=SCHEDULE,
            timeZone:label=TIMEZONE,
            state:label=STATE,
            httpTarget.uri:label=TARGET_URL
        )"
    
    echo
    print_info "最近的執行記錄:"
    gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --format="table(
            lastAttemptTime:label=LAST_ATTEMPT,
            status.code:label=STATUS_CODE,
            status.message:label=MESSAGE
        )" 2>/dev/null || print_warning "無法取得執行記錄"
}

# 函數：建立監控腳本
create_monitoring_script() {
    print_info "建立監控腳本..."
    
    cat > monitor-scheduler.sh << EOF
#!/bin/bash

# Cloud Scheduler 監控腳本

PROJECT_ID="$PROJECT_ID"
REGION="$REGION"
JOB_NAME="$SCHEDULER_JOB_NAME"
FUNCTION_NAME="$CLOUD_FUNCTION_NAME"

echo "=== Cloud Scheduler 監控 ==="
echo "專案: \$PROJECT_ID"
echo "地區: \$REGION"
echo "工作名稱: \$JOB_NAME"
echo

# 顯示工作狀態
echo "--- 工作狀態 ---"
gcloud scheduler jobs describe "\$JOB_NAME" \\
    --location="\$REGION" \\
    --project="\$PROJECT_ID" \\
    --format="value(state,schedule,lastAttemptTime)"

echo

# 顯示最近的 Cloud Function 日誌
echo "--- 最近的 Function 日誌 ---"
gcloud functions logs read "\$FUNCTION_NAME" \\
    --region="\$REGION" \\
    --project="\$PROJECT_ID" \\
    --limit=10 \\
    --format="table(timestamp,severity,textPayload)"

echo

# 手動觸發工作（可選）
read -p "是否要手動觸發工作？(y/N): " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]\$ ]]; then
    echo "觸發工作..."
    gcloud scheduler jobs run "\$JOB_NAME" \\
        --location="\$REGION" \\
        --project="\$PROJECT_ID"
    echo "工作已觸發，請稍後檢查日誌"
fi
EOF
    
    chmod +x monitor-scheduler.sh
    print_success "監控腳本已建立: monitor-scheduler.sh"
}

# 函數：顯示後續步驟
show_next_steps() {
    echo
    print_success "Cloud Scheduler 設定完成！"
    echo
    print_info "設定摘要:"
    echo "  工作名稱: $SCHEDULER_JOB_NAME"
    echo "  排程: $SCHEDULE"
    echo "  時區: $TIME_ZONE"
    echo "  目標 URL: $FUNCTION_URL"
    echo "  地區: $REGION"
    echo
    print_info "後續步驟:"
    echo "1. 檢查工作狀態: gcloud scheduler jobs describe $SCHEDULER_JOB_NAME --location=$REGION"
    echo "2. 查看執行日誌: gcloud functions logs read $CLOUD_FUNCTION_NAME --region=$REGION --limit=50"
    echo "3. 手動觸發測試: gcloud scheduler jobs run $SCHEDULER_JOB_NAME --location=$REGION"
    echo "4. 使用監控腳本: ./monitor-scheduler.sh"
    echo
    print_info "排程說明:"
    echo "  $SCHEDULE = 每 15 分鐘執行一次"
    echo "  如需修改排程，請使用: gcloud scheduler jobs update http $SCHEDULER_JOB_NAME --schedule='新的排程'"
    echo
    print_info "常用排程範例:"
    echo "  每小時: '0 * * * *'"
    echo "  每天上午 9 點: '0 9 * * *'"
    echo "  每 30 分鐘: '*/30 * * * *'"
    echo "  工作日上午 9 點: '0 9 * * 1-5'"
    echo
}

# 主函數
main() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - Cloud Scheduler 設定"
    echo "=================================================="
    echo
    
    # 解析命令列參數
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project)
                PROJECT_ID="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --job-name)
                SCHEDULER_JOB_NAME="$2"
                shift 2
                ;;
            --function-name)
                CLOUD_FUNCTION_NAME="$2"
                shift 2
                ;;
            --schedule)
                SCHEDULE="$2"
                shift 2
                ;;
            --timezone)
                TIME_ZONE="$2"
                shift 2
                ;;
            --service-account)
                SERVICE_ACCOUNT_EMAIL="$2"
                shift 2
                ;;
            --help)
                echo "使用方式: $0 [選項]"
                echo
                echo "選項:"
                echo "  --project PROJECT_ID              GCP 專案 ID"
                echo "  --region REGION                   地區 (預設: us-central1)"
                echo "  --job-name JOB_NAME               Scheduler 工作名稱 (預設: ptt-telegram-scheduler)"
                echo "  --function-name FUNCTION_NAME     Cloud Function 名稱 (預設: ptt-scraper)"
                echo "  --schedule SCHEDULE               Cron 排程 (預設: */15 * * * *)"
                echo "  --timezone TIMEZONE               時區 (預設: Asia/Taipei)"
                echo "  --service-account EMAIL           服務帳戶電子郵件"
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
    setup_app_engine
    check_cloud_function
    create_scheduler_job
    setup_iam_permissions
    test_scheduler_job
    show_job_status
    create_monitoring_script
    show_next_steps
}

# 執行主函數
main "$@"