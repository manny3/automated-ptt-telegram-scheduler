#!/bin/bash

# 本地開發環境設定腳本
# 用於快速設定和啟動本地開發環境

set -e

echo "🚀 PTT Telegram Scheduler - 本地開發環境設定"
echo "================================================"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查必要工具
check_requirements() {
    echo -e "${BLUE}檢查系統需求...${NC}"
    
    # 檢查 Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安裝。請安裝 Node.js 18+${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 版本過舊 (當前: $(node -v))。需要 18+${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
    
    # 檢查 npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安裝${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ npm $(npm -v)${NC}"
    
    # 檢查 Docker (可選)
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)${NC}"
        DOCKER_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠️  Docker 未安裝 (可選，但建議安裝)${NC}"
        DOCKER_AVAILABLE=false
    fi
    
    # 檢查 Docker Compose (可選)
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)${NC}"
        COMPOSE_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠️  Docker Compose 未安裝 (可選，但建議安裝)${NC}"
        COMPOSE_AVAILABLE=false
    fi
}

# 安裝依賴
install_dependencies() {
    echo -e "${BLUE}安裝 Node.js 依賴...${NC}"
    npm install
    echo -e "${GREEN}✅ 依賴安裝完成${NC}"
}

# 設定環境變數
setup_environment() {
    echo -e "${BLUE}設定環境變數...${NC}"
    
    if [ ! -f .env.local ]; then
        if [ -f .env.example ]; then
            cp .env.example .env.local
            echo -e "${GREEN}✅ 已創建 .env.local 文件${NC}"
            echo -e "${YELLOW}⚠️  請編輯 .env.local 文件並填入適當的值${NC}"
        else
            echo -e "${YELLOW}⚠️  .env.example 文件不存在，創建基本的 .env.local${NC}"
            cat > .env.local << EOF
# 本地開發環境變數
NODE_ENV=development
GOOGLE_CLOUD_PROJECT=local-dev-project
PORT=3000
FIRESTORE_EMULATOR_HOST=localhost:8080
DEBUG=true
VERBOSE_LOGGING=true
NEXT_TELEMETRY_DISABLED=1
EOF
        fi
    else
        echo -e "${GREEN}✅ .env.local 文件已存在${NC}"
    fi
}

# 啟動服務
start_services() {
    echo -e "${BLUE}選擇啟動方式:${NC}"
    echo "1) Docker Compose (推薦)"
    echo "2) 僅資料庫服務 (Docker) + 本地應用程式"
    echo "3) 完全本地模式"
    echo "4) 跳過，手動啟動"
    
    read -p "請選擇 (1-4): " choice
    
    case $choice in
        1)
            if [ "$DOCKER_AVAILABLE" = true ] && [ "$COMPOSE_AVAILABLE" = true ]; then
                echo -e "${BLUE}啟動 Docker Compose 服務...${NC}"
                docker-compose up -d
                echo -e "${GREEN}✅ 服務已啟動${NC}"
                echo -e "${BLUE}服務端點:${NC}"
                echo "  - Web 應用程式: http://localhost:3000"
                echo "  - Firestore 模擬器: http://localhost:8080"
                echo "  - Firestore UI: http://localhost:4000"
            else
                echo -e "${RED}❌ Docker 或 Docker Compose 不可用${NC}"
                exit 1
            fi
            ;;
        2)
            if [ "$DOCKER_AVAILABLE" = true ] && [ "$COMPOSE_AVAILABLE" = true ]; then
                echo -e "${BLUE}啟動資料庫服務...${NC}"
                docker-compose up -d firestore redis
                echo -e "${GREEN}✅ 資料庫服務已啟動${NC}"
                echo -e "${BLUE}啟動 Next.js 應用程式...${NC}"
                npm run dev &
                echo -e "${GREEN}✅ 應用程式已啟動在 http://localhost:3000${NC}"
            else
                echo -e "${RED}❌ Docker 不可用${NC}"
                exit 1
            fi
            ;;
        3)
            echo -e "${BLUE}完全本地模式需要手動設定 Firestore 模擬器${NC}"
            echo "請參考文檔: docs/local-development.md"
            echo -e "${BLUE}啟動 Next.js 應用程式...${NC}"
            npm run dev &
            echo -e "${GREEN}✅ 應用程式已啟動在 http://localhost:3000${NC}"
            ;;
        4)
            echo -e "${YELLOW}跳過自動啟動${NC}"
            ;;
        *)
            echo -e "${RED}無效選擇${NC}"
            exit 1
            ;;
    esac
}

# 運行測試
run_tests() {
    echo -e "${BLUE}是否運行測試套件? (y/n)${NC}"
    read -p "選擇: " run_test
    
    if [ "$run_test" = "y" ] || [ "$run_test" = "Y" ]; then
        echo -e "${BLUE}運行測試...${NC}"
        npm test
        echo -e "${GREEN}✅ 測試完成${NC}"
    fi
}

# 創建測試資料
seed_test_data() {
    echo -e "${BLUE}是否創建測試資料? (y/n)${NC}"
    read -p "選擇: " seed_data
    
    if [ "$seed_data" = "y" ] || [ "$seed_data" = "Y" ]; then
        echo -e "${BLUE}等待服務啟動...${NC}"
        sleep 5
        
        echo -e "${BLUE}創建測試資料...${NC}"
        curl -X POST http://localhost:3000/api/test/seed-data \
            -H "Content-Type: application/json" \
            -d '{}' || echo -e "${YELLOW}⚠️  無法創建測試資料，請確保服務正在運行${NC}"
    fi
}

# 顯示有用的命令
show_helpful_commands() {
    echo -e "${BLUE}有用的開發命令:${NC}"
    echo "  npm run dev          - 啟動開發伺服器"
    echo "  npm test             - 運行測試"
    echo "  npm run test:watch   - 監視模式運行測試"
    echo "  npm run build        - 建置應用程式"
    echo "  npm run lint         - 程式碼檢查"
    echo ""
    echo -e "${BLUE}Docker 命令:${NC}"
    echo "  docker-compose up -d    - 啟動所有服務"
    echo "  docker-compose down     - 停止所有服務"
    echo "  docker-compose logs -f  - 查看日誌"
    echo ""
    echo -e "${BLUE}測試 API:${NC}"
    echo "  curl http://localhost:3000/api/health"
    echo "  curl -X POST http://localhost:3000/api/test/seed-data"
    echo ""
    echo -e "${BLUE}文檔:${NC}"
    echo "  docs/local-development.md - 本地開發指南"
    echo "  docs/api-documentation.md - API 文檔"
    echo "  docs/user-guide.md        - 用戶指南"
}

# 主函數
main() {
    check_requirements
    install_dependencies
    setup_environment
    start_services
    run_tests
    seed_test_data
    
    echo ""
    echo -e "${GREEN}🎉 本地開發環境設定完成！${NC}"
    echo ""
    show_helpful_commands
    
    echo ""
    echo -e "${BLUE}開發環境已準備就緒！${NC}"
    echo -e "${BLUE}訪問 http://localhost:3000 開始開發${NC}"
}

# 執行主函數
main "$@"