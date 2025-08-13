# PTT Telegram Scheduler - Next.js Application Dockerfile
# 多階段建構，最佳化映像大小和安全性

# 階段 1: 依賴安裝
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 複製 package 檔案
COPY package.json package-lock.json* ./

# 安裝依賴
RUN npm ci --only=production && npm cache clean --force

# 階段 2: 建構應用程式
FROM node:18-alpine AS builder
WORKDIR /app

# 複製依賴
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 設定建構時環境變數
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# 建構應用程式
RUN npm run build

# 階段 3: 生產執行環境
FROM node:18-alpine AS runner
WORKDIR /app

# 建立非 root 使用者
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 設定執行時環境變數
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 複製必要檔案
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# 複製建構輸出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 安裝生產依賴
COPY --from=deps /app/node_modules ./node_modules

# 切換到非 root 使用者
USER nextjs

# 暴露端口
EXPOSE 3000

# 設定環境變數
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# 啟動應用程式
CMD ["node", "server.js"]