#!/bin/bash

# Cloud Function 部署腳本
# 此腳本會部署 PTT 抓取 Cloud Function

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
FUNCTION_NAME=${FUNCTION_NAME:-"ptt-scraper"}
RUNTIME=${RUNTIME:-"python39"}
MEMORY=${MEMORY:-"512MB"}
TIMEOUT=${TIMEOUT:-"540s"}
MAX_INSTANCES=${MAX_INSTANCES:-"10"}
SOURCE_DIR=${SOURCE_DIR:-"functions/ptt-scraper"}
ENTRY_POINT=${ENTRY_POINT:-"main"}

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
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 未安裝。"
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
    print_info "函數名稱: $FUNCTION_NAME"
    print_info "原始碼目錄: $SOURCE_DIR"
    
    # 檢查專案是否存在
    if ! gcloud projects describe "$PROJECT_ID" &> /dev/null; then
        print_error "專案 $PROJECT_ID 不存在或無法存取"
        exit 1
    fi
    
    # 檢查原始碼目錄是否存在
    if [ ! -d "$SOURCE_DIR" ]; then
        print_error "原始碼目錄不存在: $SOURCE_DIR"
        exit 1
    fi
    
    # 檢查必要檔案
    if [ ! -f "$SOURCE_DIR/main.py" ]; then
        print_error "找不到主要檔案: $SOURCE_DIR/main.py"
        exit 1
    fi
    
    if [ ! -f "$SOURCE_DIR/requirements.txt" ]; then
        print_error "找不到依賴檔案: $SOURCE_DIR/requirements.txt"
        exit 1
    fi
    
    print_success "專案驗證完成"
}

# 函數：啟用必要的 API
enable_apis() {
    print_info "啟用必要的 Google Cloud API..."
    
    local apis=(
        "cloudfunctions.googleapis.com"
        "cloudbuild.googleapis.com"
        "firestore.googleapis.com"
        "secretmanager.googleapis.com"
        "logging.googleapis.com"
        "monitoring.googleapis.com"
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

# 函數：驗證依賴
validate_dependencies() {
    print_info "驗證 Python 依賴..."
    
    # 檢查 requirements.txt 內容
    print_info "檢查 requirements.txt 內容:"
    cat "$SOURCE_DIR/requirements.txt"
    
    # 可選：在本地環境中測試依賴安裝
    if [ "${VALIDATE_DEPS:-false}" = "true" ]; then
        print_info "在本地測試依賴安裝..."
        
        # 建立暫存虛擬環境
        local temp_venv="/tmp/cf-test-env"
        python3 -m venv "$temp_venv"
        source "$temp_venv/bin/activate"
        
        if pip install -r "$SOURCE_DIR/requirements.txt"; then
            print_success "依賴驗證通過"
        else
            print_error "依賴驗證失敗"
            deactivate
            rm -rf "$temp_venv"
            exit 1
        fi
        
        deactivate
        rm -rf "$temp_venv"
    fi
    
    print_success "依賴驗證完成"
}

# 函數：部署 Cloud Function
deploy_function() {
    print_info "部署 Cloud Function..."
    
    # 建構部署命令
    local deploy_cmd="gcloud functions deploy $FUNCTION_NAME"
    deploy_cmd="$deploy_cmd --runtime=$RUNTIME"
    deploy_cmd="$deploy_cmd --trigger=http"
    deploy_cmd="$deploy_cmd --entry-point=$ENTRY_POINT"
    deploy_cmd="$deploy_cmd --memory=$MEMORY"
    deploy_cmd="$deploy_cmd --timeout=$TIMEOUT"
    deploy_cmd="$deploy_cmd --max-instances=$MAX_INSTANCES"
    deploy_cmd="$deploy_cmd --region=$REGION"
    deploy_cmd="$deploy_cmd --project=$PROJECT_ID"
    deploy_cmd="$deploy_cmd --source=$SOURCE_DIR"
    deploy_cmd="$deploy_cmd --allow-unauthenticated"
    
    # 設定環境變數
    deploy_cmd="$deploy_cmd --set-env-vars=GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
    deploy_cmd="$deploy_cmd --set-env-vars=TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token"
    
    # 設定標籤
    deploy_cmd="$deploy_cmd --update-labels=app=ptt-telegram-scheduler,component=scraper,version=1.0.0"
    
    print_info "執行部署命令..."
    print_info "命令: $deploy_cmd"
    
    if eval "$deploy_cmd"; then
        print_success "Cloud Function 部署完成"
    else
        print_error "Cloud Function 部署失敗"
        exit 1
    fi
}

# 函數：設定 IAM 權限
setup_iam_permissions() {
    print_info "設定 IAM 權限..."
    
    # 取得 Cloud Functions 服務帳戶
    local cf_sa="$PROJECT_ID@appspot.gserviceaccount.com"
    
    print_info "Cloud Functions 服務帳戶: $cf_sa"
    
    # 設定必要權限
    local roles=(
        "roles/firestore.user"
        "roles/secretmanager.secretAccessor"
        "roles/logging.logWriter"
        "roles/monitoring.metricWriter"
    )
    
    for role in "${roles[@]}"; do
        print_info "授予角色: $role"
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:$cf_sa" \
            --role="$role" || print_warning "無法授予角色 $role"
    done
    
    print_success "IAM 權限設定完成"
}

# 函數：測試 Cloud Function
test_function() {
    print_info "測試 Cloud Function..."
    
    # 取得函數 URL
    local function_url=$(gcloud functions describe "$FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(httpsTrigger.url)")
    
    if [ -z "$function_url" ]; then
        print_error "無法取得函數 URL"
        return 1
    fi
    
    print_info "函數 URL: $function_url"
    
    # 測試函數調用
    print_info "測試函數調用..."
    
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        print_info "嘗試 $attempt/$max_attempts: 調用函數"
        
        local response=$(curl -s -w "%{http_code}" -X POST "$function_url" \
            -H "Content-Type: application/json" \
            -d '{}' || echo "000")
        
        local http_code="${response: -3}"
        local body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            print_success "函數調用成功"
            print_info "回應: $body"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "函數調用失敗 (HTTP $http_code)"
                print_error "回應: $body"
                return 1
            else
                print_warning "函數調用失敗 (HTTP $http_code)，10 秒後重試..."
                sleep 10
            fi
        fi
        
        ((attempt++))
    done
    
    print_success "函數測試完成"
}

# 函數：查看函數日誌
show_logs() {
    print_info "顯示最近的函數日誌..."
    
    gcloud functions logs read "$FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --limit=20 \
        --format="table(timestamp,severity,textPayload)" || print_warning "無法取得日誌"
}

# 函數：顯示部署資訊
show_deployment_info() {
    print_info "部署資訊摘要:"
    
    local function_url=$(gcloud functions describe "$FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(httpsTrigger.url)")
    
    local function_status=$(gcloud functions describe "$FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status)")
    
    echo "  專案 ID: $PROJECT_ID"
    echo "  地區: $REGION"
    echo "  函數名稱: $FUNCTION_NAME"
    echo "  函數 URL: $function_url"
    echo "  狀態: $function_status"
    echo "  執行時間: $RUNTIME"
    echo "  記憶體: $MEMORY"
    echo "  逾時: $TIMEOUT"
    echo "  最大實例數: $MAX_INSTANCES"
    echo
    echo "管理命令:"
    echo "  查看函數: gcloud functions describe $FUNCTION_NAME --region=$REGION"
    echo "  查看日誌: gcloud functions logs read $FUNCTION_NAME --region=$REGION --limit=50"
    echo "  調用函數: curl -X POST $function_url -H 'Content-Type: application/json' -d '{}'"
    echo "  刪除函數: gcloud functions delete $FUNCTION_NAME --region=$REGION"
    echo
}

# 主函數
main() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - Cloud Function 部署"
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
            --function-name)
                FUNCTION_NAME="$2"
                shift 2
                ;;
            --runtime)
                RUNTIME="$2"
                shift 2
                ;;
            --memory)
                MEMORY="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --max-instances)
                MAX_INSTANCES="$2"
                shift 2
                ;;
            --source-dir)
                SOURCE_DIR="$2"
                shift 2
                ;;
            --skip-test)
                SKIP_TEST="true"
                shift
                ;;
            --validate-deps)
                VALIDATE_DEPS="true"
                shift
                ;;
            --show-logs)
                SHOW_LOGS="true"
                shift
                ;;
            --help)
                echo "使用方式: $0 [選項]"
                echo
                echo "選項:"
                echo "  --project PROJECT_ID          GCP 專案 ID"
                echo "  --region REGION               部署地區 (預設: us-central1)"
                echo "  --function-name NAME          Cloud Function 名稱 (預設: ptt-scraper)"
                echo "  --runtime RUNTIME             Python 執行時間 (預設: python39)"
                echo "  --memory MEMORY               記憶體限制 (預設: 512MB)"
                echo "  --timeout TIMEOUT             逾時設定 (預設: 540s)"
                echo "  --max-instances NUM           最大實例數 (預設: 10)"
                echo "  --source-dir DIR              原始碼目錄 (預設: functions/ptt-scraper)"
                echo "  --skip-test                   跳過函數測試"
                echo "  --validate-deps               驗證 Python 依賴"
                echo "  --show-logs                   顯示部署後的日誌"
                echo "  --help                        顯示此說明"
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
    
    # 執行部署步驟
    check_prerequisites
    validate_project
    enable_apis
    validate_dependencies
    deploy_function
    setup_iam_permissions
    
    if [ "${SKIP_TEST:-false}" != "true" ]; then
        test_function
    else
        print_warning "跳過函數測試"
    fi
    
    if [ "${SHOW_LOGS:-false}" = "true" ]; then
        show_logs
    fi
    
    show_deployment_info
    
    print_success "Cloud Function 部署完成！"
}

# 處理中斷信號
trap 'echo -e "\n部署已中斷"; exit 1' INT

# 執行主函數
main "$@"