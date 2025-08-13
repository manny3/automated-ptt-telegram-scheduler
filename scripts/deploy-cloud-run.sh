#!/bin/bash

# Cloud Run 部署腳本
# 此腳本會建構 Docker 映像並部署到 Cloud Run

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
SERVICE_NAME=${SERVICE_NAME:-"ptt-telegram-scheduler"}
IMAGE_NAME=${IMAGE_NAME:-"ptt-telegram-scheduler"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"ptt-scheduler-sa"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
MAX_INSTANCES=${MAX_INSTANCES:-"10"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
CONCURRENCY=${CONCURRENCY:-"100"}
TIMEOUT=${TIMEOUT:-"300"}

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
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安裝。請安裝 Docker。"
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
    print_info "服務名稱: $SERVICE_NAME"
    
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
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "containerregistry.googleapis.com"
        "artifactregistry.googleapis.com"
        "firestore.googleapis.com"
        "secretmanager.googleapis.com"
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

# 函數：建立服務帳戶
create_service_account() {
    print_info "建立服務帳戶..."
    
    local sa_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # 檢查服務帳戶是否已存在
    if gcloud iam service-accounts describe "$sa_email" --project="$PROJECT_ID" &> /dev/null; then
        print_warning "服務帳戶 $sa_email 已存在"
    else
        print_info "建立服務帳戶: $sa_email"
        if gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
            --display-name="PTT Telegram Scheduler Service Account" \
            --description="Service account for PTT Telegram Scheduler Cloud Run service" \
            --project="$PROJECT_ID"; then
            print_success "服務帳戶已建立"
        else
            print_error "無法建立服務帳戶"
            exit 1
        fi
    fi
    
    # 設定必要權限
    print_info "設定服務帳戶權限..."
    
    local roles=(
        "roles/firestore.user"
        "roles/secretmanager.secretAccessor"
        "roles/logging.logWriter"
        "roles/monitoring.metricWriter"
        "roles/cloudtrace.agent"
    )
    
    for role in "${roles[@]}"; do
        print_info "授予角色: $role"
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:$sa_email" \
            --role="$role" || print_warning "無法授予角色 $role"
    done
    
    print_success "服務帳戶權限設定完成"
}

# 函數：建構 Docker 映像
build_docker_image() {
    print_info "建構 Docker 映像..."
    
    local image_tag="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"
    local build_tag="gcr.io/$PROJECT_ID/$IMAGE_NAME:$(date +%Y%m%d-%H%M%S)"
    
    print_info "映像標籤: $image_tag"
    print_info "建構標籤: $build_tag"
    
    # 建構映像
    if docker build -t "$image_tag" -t "$build_tag" .; then
        print_success "Docker 映像建構完成"
    else
        print_error "Docker 映像建構失敗"
        exit 1
    fi
    
    # 推送映像到 Container Registry
    print_info "推送映像到 Container Registry..."
    
    # 設定 Docker 認證
    gcloud auth configure-docker --quiet
    
    if docker push "$image_tag" && docker push "$build_tag"; then
        print_success "映像推送完成"
    else
        print_error "映像推送失敗"
        exit 1
    fi
}

# 函數：部署到 Cloud Run
deploy_to_cloud_run() {
    print_info "部署到 Cloud Run..."
    
    local image_url="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"
    local sa_email="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # 建構部署命令
    local deploy_cmd="gcloud run deploy $SERVICE_NAME"
    deploy_cmd="$deploy_cmd --image=$image_url"
    deploy_cmd="$deploy_cmd --platform=managed"
    deploy_cmd="$deploy_cmd --region=$REGION"
    deploy_cmd="$deploy_cmd --project=$PROJECT_ID"
    deploy_cmd="$deploy_cmd --service-account=$sa_email"
    deploy_cmd="$deploy_cmd --memory=$MEMORY"
    deploy_cmd="$deploy_cmd --cpu=$CPU"
    deploy_cmd="$deploy_cmd --max-instances=$MAX_INSTANCES"
    deploy_cmd="$deploy_cmd --min-instances=$MIN_INSTANCES"
    deploy_cmd="$deploy_cmd --concurrency=$CONCURRENCY"
    deploy_cmd="$deploy_cmd --timeout=$TIMEOUT"
    deploy_cmd="$deploy_cmd --port=3000"
    deploy_cmd="$deploy_cmd --allow-unauthenticated"
    
    # 設定環境變數
    deploy_cmd="$deploy_cmd --set-env-vars=NODE_ENV=production"
    deploy_cmd="$deploy_cmd --set-env-vars=GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
    deploy_cmd="$deploy_cmd --set-env-vars=TELEGRAM_BOT_TOKEN_SECRET_NAME=telegram-bot-token"
    
    # 設定標籤
    deploy_cmd="$deploy_cmd --labels=app=ptt-telegram-scheduler,version=1.0.0,environment=production"
    
    print_info "執行部署命令..."
    if eval "$deploy_cmd"; then
        print_success "Cloud Run 服務部署完成"
    else
        print_error "Cloud Run 服務部署失敗"
        exit 1
    fi
}

# 函數：測試部署
test_deployment() {
    print_info "測試部署..."
    
    # 取得服務 URL
    local service_url=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)")
    
    if [ -z "$service_url" ]; then
        print_error "無法取得服務 URL"
        return 1
    fi
    
    print_info "服務 URL: $service_url"
    
    # 測試健康檢查端點
    print_info "測試健康檢查端點..."
    
    local health_url="$service_url/api/health"
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        print_info "嘗試 $attempt/$max_attempts: 測試 $health_url"
        
        if curl -f -s -o /dev/null -w "%{http_code}" "$health_url" | grep -q "200"; then
            print_success "健康檢查通過"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "健康檢查失敗"
                return 1
            else
                print_warning "健康檢查失敗，10 秒後重試..."
                sleep 10
            fi
        fi
        
        ((attempt++))
    done
    
    # 測試詳細健康檢查
    print_info "測試詳細健康檢查..."
    local detailed_health_url="$service_url/api/health?detailed=true"
    
    if curl -s "$detailed_health_url" | jq . > /dev/null 2>&1; then
        print_success "詳細健康檢查通過"
        curl -s "$detailed_health_url" | jq .
    else
        print_warning "詳細健康檢查失敗或 jq 未安裝"
    fi
    
    print_success "部署測試完成"
}

# 函數：顯示部署資訊
show_deployment_info() {
    print_info "部署資訊摘要:"
    
    local service_url=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)")
    
    echo "  專案 ID: $PROJECT_ID"
    echo "  地區: $REGION"
    echo "  服務名稱: $SERVICE_NAME"
    echo "  服務 URL: $service_url"
    echo "  映像: gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"
    echo "  服務帳戶: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    echo
    echo "管理命令:"
    echo "  查看服務: gcloud run services describe $SERVICE_NAME --region=$REGION"
    echo "  查看日誌: gcloud run services logs tail $SERVICE_NAME --region=$REGION"
    echo "  更新服務: gcloud run services update $SERVICE_NAME --region=$REGION"
    echo "  刪除服務: gcloud run services delete $SERVICE_NAME --region=$REGION"
    echo
}

# 函數：清理資源
cleanup() {
    print_info "清理暫存資源..."
    
    # 清理本地 Docker 映像（可選）
    if [ "${CLEANUP_IMAGES:-false}" = "true" ]; then
        print_info "清理本地 Docker 映像..."
        docker rmi "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest" 2>/dev/null || true
    fi
    
    print_success "清理完成"
}

# 主函數
main() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - Cloud Run 部署"
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
            --service-name)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --image-name)
                IMAGE_NAME="$2"
                shift 2
                ;;
            --memory)
                MEMORY="$2"
                shift 2
                ;;
            --cpu)
                CPU="$2"
                shift 2
                ;;
            --max-instances)
                MAX_INSTANCES="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            --skip-test)
                SKIP_TEST="true"
                shift
                ;;
            --cleanup-images)
                CLEANUP_IMAGES="true"
                shift
                ;;
            --help)
                echo "使用方式: $0 [選項]"
                echo
                echo "選項:"
                echo "  --project PROJECT_ID          GCP 專案 ID"
                echo "  --region REGION               部署地區 (預設: us-central1)"
                echo "  --service-name NAME           Cloud Run 服務名稱 (預設: ptt-telegram-scheduler)"
                echo "  --image-name NAME             Docker 映像名稱 (預設: ptt-telegram-scheduler)"
                echo "  --memory MEMORY               記憶體限制 (預設: 512Mi)"
                echo "  --cpu CPU                     CPU 限制 (預設: 1)"
                echo "  --max-instances NUM           最大實例數 (預設: 10)"
                echo "  --skip-build                  跳過 Docker 建構"
                echo "  --skip-test                   跳過部署測試"
                echo "  --cleanup-images              清理本地 Docker 映像"
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
    create_service_account
    
    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        build_docker_image
    else
        print_warning "跳過 Docker 建構"
    fi
    
    deploy_to_cloud_run
    
    if [ "${SKIP_TEST:-false}" != "true" ]; then
        test_deployment
    else
        print_warning "跳過部署測試"
    fi
    
    show_deployment_info
    cleanup
    
    print_success "Cloud Run 部署完成！"
}

# 處理中斷信號
trap 'echo -e "\n部署已中斷"; exit 1' INT

# 執行主函數
main "$@"