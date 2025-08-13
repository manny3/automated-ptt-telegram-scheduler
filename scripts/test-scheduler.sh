#!/bin/bash

# Cloud Scheduler 測試腳本
# 此腳本用於測試 Cloud Scheduler 和 Cloud Function 的整合

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

# 函數：檢查必要設定
check_prerequisites() {
    print_info "檢查測試前置條件..."
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "GOOGLE_CLOUD_PROJECT 環境變數未設定"
        exit 1
    fi
    
    # 檢查 gcloud 是否已安裝
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI 未安裝"
        exit 1
    fi
    
    # 檢查是否已登入
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 &> /dev/null; then
        print_error "請先執行 gcloud auth login"
        exit 1
    fi
    
    print_success "前置條件檢查完成"
}

# 函數：檢查 Cloud Function 狀態
check_cloud_function() {
    print_info "檢查 Cloud Function 狀態..."
    
    if gcloud functions describe "$CLOUD_FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" &> /dev/null; then
        
        print_success "Cloud Function '$CLOUD_FUNCTION_NAME' 存在"
        
        # 取得函數狀態
        local status=$(gcloud functions describe "$CLOUD_FUNCTION_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status)")
        
        print_info "函數狀態: $status"
        
        if [ "$status" != "ACTIVE" ]; then
            print_warning "函數狀態不是 ACTIVE，可能影響測試結果"
        fi
        
        return 0
    else
        print_error "Cloud Function '$CLOUD_FUNCTION_NAME' 不存在"
        print_info "請先部署 Cloud Function"
        return 1
    fi
}

# 函數：檢查 Scheduler 工作狀態
check_scheduler_job() {
    print_info "檢查 Scheduler 工作狀態..."
    
    if gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" &> /dev/null; then
        
        print_success "Scheduler 工作 '$SCHEDULER_JOB_NAME' 存在"
        
        # 取得工作狀態
        local state=$(gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(state)")
        
        print_info "工作狀態: $state"
        
        if [ "$state" = "PAUSED" ]; then
            print_warning "工作已暫停，測試前將自動恢復"
            gcloud scheduler jobs resume "$SCHEDULER_JOB_NAME" \
                --location="$REGION" \
                --project="$PROJECT_ID"
        fi
        
        return 0
    else
        print_error "Scheduler 工作 '$SCHEDULER_JOB_NAME' 不存在"
        print_info "請先執行 ./scripts/setup-cloud-scheduler.sh"
        return 1
    fi
}

# 函數：測試手動觸發
test_manual_trigger() {
    print_info "測試手動觸發 Scheduler 工作..."
    
    # 記錄觸發前的時間
    local trigger_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    print_info "觸發時間: $trigger_time"
    
    # 手動觸發工作
    if gcloud scheduler jobs run "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID"; then
        
        print_success "工作觸發成功"
        
        # 等待一段時間讓函數執行
        print_info "等待 10 秒讓函數執行..."
        sleep 10
        
        return 0
    else
        print_error "工作觸發失敗"
        return 1
    fi
}

# 函數：檢查執行結果
check_execution_results() {
    print_info "檢查執行結果..."
    
    # 檢查 Cloud Function 日誌
    print_info "查看 Cloud Function 日誌..."
    
    local logs=$(gcloud functions logs read "$CLOUD_FUNCTION_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --limit=20 \
        --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "")
    
    if [ -n "$logs" ]; then
        echo "$logs"
        
        # 檢查是否有錯誤
        local error_count=$(echo "$logs" | grep -c "ERROR" || echo "0")
        local success_indicators=$(echo "$logs" | grep -c "execution completed\|Successfully sent\|工作觸發成功" || echo "0")
        
        if [ "$error_count" -gt 0 ]; then
            print_warning "發現 $error_count 個錯誤日誌"
        fi
        
        if [ "$success_indicators" -gt 0 ]; then
            print_success "發現成功執行的指標"
        fi
    else
        print_warning "無法取得 Cloud Function 日誌"
    fi
    
    # 檢查 Scheduler 工作的最後執行狀態
    print_info "檢查 Scheduler 工作的最後執行狀態..."
    
    local job_status=$(gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --format="table(lastAttemptTime,status.code,status.message)" 2>/dev/null || echo "")
    
    if [ -n "$job_status" ]; then
        echo "$job_status"
    else
        print_warning "無法取得工作執行狀態"
    fi
}

# 函數：測試 Firestore 連接
test_firestore_connection() {
    print_info "測試 Firestore 連接..."
    
    # 嘗試列出 configurations 集合
    if gcloud firestore collections list --project="$PROJECT_ID" 2>/dev/null | grep -q "configurations"; then
        print_success "Firestore configurations 集合存在"
        
        # 檢查是否有活躍的配置
        local config_count=$(gcloud firestore documents list \
            --collection-ids=configurations \
            --project="$PROJECT_ID" \
            --format="value(name)" 2>/dev/null | wc -l || echo "0")
        
        print_info "找到 $config_count 個配置文件"
        
        if [ "$config_count" -eq 0 ]; then
            print_warning "沒有找到任何配置，Scheduler 可能不會執行任何任務"
        fi
    else
        print_warning "Firestore configurations 集合不存在或無法存取"
    fi
}

# 函數：測試 Secret Manager
test_secret_manager() {
    print_info "測試 Secret Manager 連接..."
    
    local secret_name=${TELEGRAM_BOT_TOKEN_SECRET_NAME:-"telegram-bot-token"}
    
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &> /dev/null; then
        print_success "Secret Manager 密鑰 '$secret_name' 存在"
        
        # 測試存取權限（不顯示實際值）
        if gcloud secrets versions access latest \
            --secret="$secret_name" \
            --project="$PROJECT_ID" > /dev/null 2>&1; then
            print_success "密鑰存取權限正常"
        else
            print_warning "密鑰存取權限可能有問題"
        fi
    else
        print_warning "Secret Manager 密鑰 '$secret_name' 不存在"
        print_info "請先執行 ./scripts/setup-secret-manager.sh"
    fi
}

# 函數：執行完整測試
run_full_test() {
    print_info "執行完整的 Cloud Scheduler 測試..."
    
    local test_passed=0
    local test_failed=0
    
    # 測試 1: 檢查 Cloud Function
    if check_cloud_function; then
        ((test_passed++))
    else
        ((test_failed++))
    fi
    
    # 測試 2: 檢查 Scheduler 工作
    if check_scheduler_job; then
        ((test_passed++))
    else
        ((test_failed++))
        return 1  # 如果 Scheduler 工作不存在，無法繼續測試
    fi
    
    # 測試 3: 測試 Firestore 連接
    test_firestore_connection
    
    # 測試 4: 測試 Secret Manager
    test_secret_manager
    
    # 測試 5: 手動觸發測試
    if test_manual_trigger; then
        ((test_passed++))
    else
        ((test_failed++))
    fi
    
    # 測試 6: 檢查執行結果
    check_execution_results
    
    # 顯示測試摘要
    echo
    print_info "測試摘要:"
    echo "  通過: $test_passed"
    echo "  失敗: $test_failed"
    
    if [ "$test_failed" -eq 0 ]; then
        print_success "所有核心測試都通過了！"
        return 0
    else
        print_warning "有 $test_failed 個測試失敗，請檢查上述錯誤訊息"
        return 1
    fi
}

# 函數：持續監控模式
monitor_mode() {
    print_info "進入持續監控模式（每 30 秒更新一次，按 Ctrl+C 停止）"
    
    while true; do
        clear
        echo "=== Cloud Scheduler 監控 ==="
        echo "時間: $(date)"
        echo "專案: $PROJECT_ID"
        echo "地區: $REGION"
        echo
        
        # 顯示工作狀態
        echo "--- Scheduler 工作狀態 ---"
        gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --format="table(name.basename():label=NAME,state:label=STATE,schedule:label=SCHEDULE,lastAttemptTime:label=LAST_ATTEMPT)" 2>/dev/null || echo "無法取得工作狀態"
        
        echo
        echo "--- 最近的 Function 日誌 ---"
        gcloud functions logs read "$CLOUD_FUNCTION_NAME" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --limit=5 \
            --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "無法取得日誌"
        
        echo
        echo "按 Ctrl+C 停止監控"
        
        sleep 30
    done
}

# 函數：顯示使用說明
show_help() {
    echo "Cloud Scheduler 測試腳本"
    echo
    echo "使用方式: $0 [選項]"
    echo
    echo "選項:"
    echo "  --full-test          執行完整測試套件"
    echo "  --trigger-only       只測試手動觸發"
    echo "  --check-only         只檢查狀態，不執行觸發"
    echo "  --monitor            持續監控模式"
    echo "  --logs               只顯示最近的日誌"
    echo "  --help               顯示此說明"
    echo
    echo "環境變數:"
    echo "  GOOGLE_CLOUD_PROJECT      GCP 專案 ID"
    echo "  REGION                    地區 (預設: us-central1)"
    echo "  SCHEDULER_JOB_NAME        Scheduler 工作名稱 (預設: ptt-telegram-scheduler)"
    echo "  CLOUD_FUNCTION_NAME       Cloud Function 名稱 (預設: ptt-scraper)"
    echo
}

# 主函數
main() {
    echo "=================================================="
    echo "    PTT Telegram Scheduler - Cloud Scheduler 測試"
    echo "=================================================="
    echo
    
    # 解析命令列參數
    case "${1:-}" in
        --full-test)
            check_prerequisites
            run_full_test
            ;;
        --trigger-only)
            check_prerequisites
            test_manual_trigger
            check_execution_results
            ;;
        --check-only)
            check_prerequisites
            check_cloud_function
            check_scheduler_job
            test_firestore_connection
            test_secret_manager
            ;;
        --monitor)
            check_prerequisites
            monitor_mode
            ;;
        --logs)
            check_prerequisites
            check_execution_results
            ;;
        --help)
            show_help
            ;;
        "")
            # 預設執行完整測試
            check_prerequisites
            run_full_test
            ;;
        *)
            print_error "未知選項: $1"
            show_help
            exit 1
            ;;
    esac
}

# 處理 Ctrl+C
trap 'echo -e "\n測試已中斷"; exit 0' INT

# 執行主函數
main "$@"