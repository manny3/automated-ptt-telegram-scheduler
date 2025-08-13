#!/bin/bash

# 統一部署腳本
# 此腳本會依序部署整個 PTT Telegram Scheduler 系統

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${REGION:-"us-central1"}
ENVIRONMENT=${ENVIRONMENT:-"production"}

# 部署選項
DEPLOY_SECRET_MANAGER=${DEPLOY_SECRET_MANAGER:-"true"}
DEPLOY_CLOUD_FUNCTION=${DEPLOY_CLOUD_FUNCTION:-"true"}
DEPLOY_CLOUD_RUN=${DEPLOY_CLOUD_RUN:-"true"}
DEPLOY_CLOUD_SCHEDULER=${DEPLOY_CLOUD_SCHEDULER:-"true"}

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

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 函數：顯示部署計劃
show_deployment_plan() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - 完整系統部署"
    echo "=================================================="
    echo
    print_info "部署計劃:"
    echo "  專案 ID: $PROJECT_ID"
    echo "  地區: $REGION"
    echo "  環境: $ENVIRONMENT"
    echo
    echo "部署組件:"
    [ "$DEPLOY_SECRET_MANAGER" = "true" ] && echo "  ✅ Secret Manager 設定" || echo "  ❌ Secret Manager 設定 (跳過)"
    [ "$DEPLOY_CLOUD_FUNCTION" = "true" ] && echo "  ✅ Cloud Function 部署" || echo "  ❌ Cloud Function 部署 (跳過)"
    [ "$DEPLOY_CLOUD_RUN" = "true" ] && echo "  ✅ Cloud Run 部署" || echo "  ❌ Cloud Run 部署 (跳過)"
    [ "$DEPLOY_CLOUD_SCHEDULER" = "true" ] && echo "  ✅ Cloud Scheduler 設定" || echo "  ❌ Cloud Scheduler 設定 (跳過)"
    echo
}

# 函數：檢查前置條件
check_prerequisites() {
    print_step "檢查前置條件"
    
    # 檢查必要工具
    local tools=("gcloud" "docker" "curl" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool 未安裝"
            exit 1
        fi
    done
    
    # 檢查專案設定
    if [ -z "$PROJECT_ID" ]; then
        print_error "GOOGLE_CLOUD_PROJECT 環境變數未設定"
        exit 1
    fi
    
    # 檢查 gcloud 認證
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 &> /dev/null; then
        print_error "請先執行 gcloud auth login"
        exit 1
    fi
    
    print_success "前置條件檢查完成"
}

# 函數：部署 Secret Manager
deploy_secret_manager() {
    if [ "$DEPLOY_SECRET_MANAGER" != "true" ]; then
        print_warning "跳過 Secret Manager 部署"
        return 0
    fi
    
    print_step "部署 Secret Manager"
    
    if [ -f "scripts/setup-secret-manager.sh" ]; then
        if ./scripts/setup-secret-manager.sh --project="$PROJECT_ID"; then
            print_success "Secret Manager 部署完成"
        else
            print_error "Secret Manager 部署失敗"
            return 1
        fi
    else
        print_error "找不到 Secret Manager 設定腳本"
        return 1
    fi
}

# 函數：部署 Cloud Function
deploy_cloud_function() {
    if [ "$DEPLOY_CLOUD_FUNCTION" != "true" ]; then
        print_warning "跳過 Cloud Function 部署"
        return 0
    fi
    
    print_step "部署 Cloud Function"
    
    if [ -f "scripts/deploy-cloud-function.sh" ]; then
        if ./scripts/deploy-cloud-function.sh \
            --project="$PROJECT_ID" \
            --region="$REGION"; then
            print_success "Cloud Function 部署完成"
        else
            print_error "Cloud Function 部署失敗"
            return 1
        fi
    else
        print_error "找不到 Cloud Function 部署腳本"
        return 1
    fi
}

# 函數：部署 Cloud Run
deploy_cloud_run() {
    if [ "$DEPLOY_CLOUD_RUN" != "true" ]; then
        print_warning "跳過 Cloud Run 部署"
        return 0
    fi
    
    print_step "部署 Cloud Run"
    
    if [ -f "scripts/deploy-cloud-run.sh" ]; then
        if ./scripts/deploy-cloud-run.sh \
            --project="$PROJECT_ID" \
            --region="$REGION"; then
            print_success "Cloud Run 部署完成"
        else
            print_error "Cloud Run 部署失敗"
            return 1
        fi
    else
        print_error "找不到 Cloud Run 部署腳本"
        return 1
    fi
}

# 函數：部署 Cloud Scheduler
deploy_cloud_scheduler() {
    if [ "$DEPLOY_CLOUD_SCHEDULER" != "true" ]; then
        print_warning "跳過 Cloud Scheduler 部署"
        return 0
    fi
    
    print_step "部署 Cloud Scheduler"
    
    if [ -f "scripts/setup-cloud-scheduler.sh" ]; then
        if ./scripts/setup-cloud-scheduler.sh \
            --project="$PROJECT_ID" \
            --region="$REGION"; then
            print_success "Cloud Scheduler 部署完成"
        else
            print_error "Cloud Scheduler 部署失敗"
            return 1
        fi
    else
        print_error "找不到 Cloud Scheduler 設定腳本"
        return 1
    fi
}

# 函數：執行部署後測試
run_post_deployment_tests() {
    print_step "執行部署後測試"
    
    local test_passed=0
    local test_failed=0
    
    # 測試 Cloud Function
    if [ "$DEPLOY_CLOUD_FUNCTION" = "true" ]; then
        print_info "測試 Cloud Function..."
        
        local function_url=$(gcloud functions describe ptt-scraper \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(httpsTrigger.url)" 2>/dev/null || echo "")
        
        if [ -n "$function_url" ]; then
            if curl -f -s -X POST "$function_url" -H "Content-Type: application/json" -d '{}' > /dev/null; then
                print_success "Cloud Function 測試通過"
                ((test_passed++))
            else
                print_warning "Cloud Function 測試失敗"
                ((test_failed++))
            fi
        else
            print_warning "無法取得 Cloud Function URL"
            ((test_failed++))
        fi
    fi
    
    # 測試 Cloud Run
    if [ "$DEPLOY_CLOUD_RUN" = "true" ]; then
        print_info "測試 Cloud Run..."
        
        local service_url=$(gcloud run services describe ptt-telegram-scheduler \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status.url)" 2>/dev/null || echo "")
        
        if [ -n "$service_url" ]; then
            if curl -f -s "$service_url/api/health" > /dev/null; then
                print_success "Cloud Run 測試通過"
                ((test_passed++))
            else
                print_warning "Cloud Run 測試失敗"
                ((test_failed++))
            fi
        else
            print_warning "無法取得 Cloud Run URL"
            ((test_failed++))
        fi
    fi
    
    # 測試 Cloud Scheduler
    if [ "$DEPLOY_CLOUD_SCHEDULER" = "true" ]; then
        print_info "測試 Cloud Scheduler..."
        
        if gcloud scheduler jobs describe ptt-telegram-scheduler \
            --location="$REGION" \
            --project="$PROJECT_ID" > /dev/null 2>&1; then
            print_success "Cloud Scheduler 測試通過"
            ((test_passed++))
        else
            print_warning "Cloud Scheduler 測試失敗"
            ((test_failed++))
        fi
    fi
    
    print_info "測試結果: $test_passed 通過, $test_failed 失敗"
    
    if [ $test_failed -eq 0 ]; then
        print_success "所有測試都通過了！"
        return 0
    else
        print_warning "有 $test_failed 個測試失敗"
        return 1
    fi
}

# 函數：顯示部署摘要
show_deployment_summary() {
    print_step "部署摘要"
    
    echo "部署完成的組件:"
    
    if [ "$DEPLOY_SECRET_MANAGER" = "true" ]; then
        echo "  🔐 Secret Manager:"
        echo "    - Telegram Bot Token 已安全儲存"
        echo "    - IAM 權限已設定"
    fi
    
    if [ "$DEPLOY_CLOUD_FUNCTION" = "true" ]; then
        local function_url=$(gcloud functions describe ptt-scraper \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(httpsTrigger.url)" 2>/dev/null || echo "未知")
        
        echo "  ⚡ Cloud Function:"
        echo "    - 名稱: ptt-scraper"
        echo "    - URL: $function_url"
        echo "    - 地區: $REGION"
    fi
    
    if [ "$DEPLOY_CLOUD_RUN" = "true" ]; then
        local service_url=$(gcloud run services describe ptt-telegram-scheduler \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status.url)" 2>/dev/null || echo "未知")
        
        echo "  🏃 Cloud Run:"
        echo "    - 服務: ptt-telegram-scheduler"
        echo "    - URL: $service_url"
        echo "    - 地區: $REGION"
    fi
    
    if [ "$DEPLOY_CLOUD_SCHEDULER" = "true" ]; then
        echo "  ⏰ Cloud Scheduler:"
        echo "    - 工作: ptt-telegram-scheduler"
        echo "    - 排程: 每 15 分鐘執行一次"
        echo "    - 地區: $REGION"
    fi
    
    echo
    print_info "後續步驟:"
    echo "1. 在 Cloud Run 介面中建立 PTT 抓取配置"
    echo "2. 測試 Telegram Bot 設定"
    echo "3. 監控 Cloud Scheduler 執行狀況"
    echo "4. 查看執行日誌和錯誤報告"
    echo
    print_info "管理命令:"
    echo "  查看 Cloud Function 日誌: gcloud functions logs read ptt-scraper --region=$REGION --limit=50"
    echo "  查看 Cloud Run 日誌: gcloud run services logs tail ptt-telegram-scheduler --region=$REGION"
    echo "  手動觸發 Scheduler: gcloud scheduler jobs run ptt-telegram-scheduler --location=$REGION"
    echo "  監控系統狀態: ./scripts/test-scheduler.sh --monitor"
}

# 函數：清理失敗的部署
cleanup_failed_deployment() {
    print_warning "檢測到部署失敗，是否要清理已部署的資源？"
    
    read -p "清理資源？(y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "清理部署資源..."
        
        # 清理 Cloud Scheduler
        gcloud scheduler jobs delete ptt-telegram-scheduler \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
        
        # 清理 Cloud Run
        gcloud run services delete ptt-telegram-scheduler \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
        
        # 清理 Cloud Function
        gcloud functions delete ptt-scraper \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
        
        print_success "資源清理完成"
    else
        print_info "保留已部署的資源"
    fi
}

# 主函數
main() {
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
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --skip-secret-manager)
                DEPLOY_SECRET_MANAGER="false"
                shift
                ;;
            --skip-cloud-function)
                DEPLOY_CLOUD_FUNCTION="false"
                shift
                ;;
            --skip-cloud-run)
                DEPLOY_CLOUD_RUN="false"
                shift
                ;;
            --skip-cloud-scheduler)
                DEPLOY_CLOUD_SCHEDULER="false"
                shift
                ;;
            --only-secret-manager)
                DEPLOY_SECRET_MANAGER="true"
                DEPLOY_CLOUD_FUNCTION="false"
                DEPLOY_CLOUD_RUN="false"
                DEPLOY_CLOUD_SCHEDULER="false"
                shift
                ;;
            --only-cloud-function)
                DEPLOY_SECRET_MANAGER="false"
                DEPLOY_CLOUD_FUNCTION="true"
                DEPLOY_CLOUD_RUN="false"
                DEPLOY_CLOUD_SCHEDULER="false"
                shift
                ;;
            --only-cloud-run)
                DEPLOY_SECRET_MANAGER="false"
                DEPLOY_CLOUD_FUNCTION="false"
                DEPLOY_CLOUD_RUN="true"
                DEPLOY_CLOUD_SCHEDULER="false"
                shift
                ;;
            --only-cloud-scheduler)
                DEPLOY_SECRET_MANAGER="false"
                DEPLOY_CLOUD_FUNCTION="false"
                DEPLOY_CLOUD_RUN="false"
                DEPLOY_CLOUD_SCHEDULER="true"
                shift
                ;;
            --help)
                echo "使用方式: $0 [選項]"
                echo
                echo "選項:"
                echo "  --project PROJECT_ID          GCP 專案 ID"
                echo "  --region REGION               部署地區 (預設: us-central1)"
                echo "  --environment ENV             部署環境 (預設: production)"
                echo "  --skip-secret-manager         跳過 Secret Manager 部署"
                echo "  --skip-cloud-function         跳過 Cloud Function 部署"
                echo "  --skip-cloud-run              跳過 Cloud Run 部署"
                echo "  --skip-cloud-scheduler         跳過 Cloud Scheduler 部署"
                echo "  --only-secret-manager          只部署 Secret Manager"
                echo "  --only-cloud-function          只部署 Cloud Function"
                echo "  --only-cloud-run               只部署 Cloud Run"
                echo "  --only-cloud-scheduler         只部署 Cloud Scheduler"
                echo "  --help                         顯示此說明"
                echo
                echo "範例:"
                echo "  $0                             # 完整部署"
                echo "  $0 --skip-cloud-run           # 跳過 Cloud Run"
                echo "  $0 --only-cloud-function      # 只部署 Cloud Function"
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
    
    # 顯示部署計劃
    show_deployment_plan
    
    # 確認部署
    read -p "確認開始部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "部署已取消"
        exit 0
    fi
    
    # 記錄開始時間
    local start_time=$(date +%s)
    
    # 執行部署步驟
    local deployment_failed=false
    
    check_prerequisites || deployment_failed=true
    
    if [ "$deployment_failed" = "false" ]; then
        deploy_secret_manager || deployment_failed=true
    fi
    
    if [ "$deployment_failed" = "false" ]; then
        deploy_cloud_function || deployment_failed=true
    fi
    
    if [ "$deployment_failed" = "false" ]; then
        deploy_cloud_run || deployment_failed=true
    fi
    
    if [ "$deployment_failed" = "false" ]; then
        deploy_cloud_scheduler || deployment_failed=true
    fi
    
    # 計算部署時間
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$deployment_failed" = "true" ]; then
        print_error "部署失敗！"
        print_info "部署時間: ${duration} 秒"
        cleanup_failed_deployment
        exit 1
    else
        print_success "所有組件部署完成！"
        print_info "部署時間: ${duration} 秒"
        
        # 執行部署後測試
        run_post_deployment_tests || print_warning "部分測試失敗，但部署已完成"
        
        # 顯示部署摘要
        show_deployment_summary
        
        print_success "🎉 PTT Telegram Scheduler 系統部署完成！"
    fi
}

# 處理中斷信號
trap 'echo -e "\n部署已中斷"; exit 1' INT

# 執行主函數
main "$@"