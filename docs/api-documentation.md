# PTT Telegram Scheduler API 文檔

## 概述

PTT Telegram Scheduler 提供了一套完整的 RESTful API，用於管理 PTT 文章爬取配置、查看執行歷史和監控系統狀態。

## 基本資訊

- **Base URL**: `https://your-domain.com/api`
- **Content-Type**: `application/json`
- **認證**: API Key (可選)

## 通用回應格式

### 成功回應
```json
{
  "success": true,
  "data": {
    // 實際資料
  },
  "message": "操作成功訊息",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-123456"
}
```

### 錯誤回應
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤訊息",
    "details": {
      // 錯誤詳情
    },
    "timestamp": "2023-12-01T10:00:00.000Z",
    "requestId": "req-123456"
  }
}
```

## API 端點

### 配置管理

#### 1. 創建配置
**POST** `/configurations`

創建新的 PTT 爬取配置。

**請求體**:
```json
{
  "name": "新聞爬取配置",
  "pttBoard": "Gossiping",
  "keywords": ["新聞", "重要"],
  "postCount": 10,
  "schedule": {
    "type": "interval",
    "intervalMinutes": 60
  },
  "telegramChatId": "123456789"
}
```

**回應**:
```json
{
  "success": true,
  "data": {
    "id": "config-123",
    "name": "新聞爬取配置",
    "pttBoard": "Gossiping",
    "keywords": ["新聞", "重要"],
    "postCount": 10,
    "schedule": {
      "type": "interval",
      "intervalMinutes": 60
    },
    "telegramChatId": "123456789",
    "isActive": true,
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  },
  "message": "配置創建成功"
}
```

#### 2. 獲取所有配置
**GET** `/configurations`

獲取所有爬取配置列表。

**查詢參數**:
- `active` (boolean, 可選): 只返回活躍配置
- `limit` (number, 可選): 限制返回數量，預設 50
- `offset` (number, 可選): 分頁偏移量，預設 0

**回應**:
```json
{
  "success": true,
  "data": {
    "configurations": [
      {
        "id": "config-123",
        "name": "新聞爬取配置",
        "pttBoard": "Gossiping",
        "keywords": ["新聞", "重要"],
        "postCount": 10,
        "schedule": {
          "type": "interval",
          "intervalMinutes": 60
        },
        "telegramChatId": "123456789",
        "isActive": true,
        "createdAt": "2023-12-01T10:00:00.000Z",
        "updatedAt": "2023-12-01T10:00:00.000Z",
        "lastExecuted": "2023-12-01T11:00:00.000Z",
        "lastExecutionStatus": "success"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

#### 3. 獲取單個配置
**GET** `/configurations/{id}`

獲取特定配置的詳細資訊。

**路徑參數**:
- `id` (string): 配置 ID

**回應**:
```json
{
  "success": true,
  "data": {
    "id": "config-123",
    "name": "新聞爬取配置",
    "pttBoard": "Gossiping",
    "keywords": ["新聞", "重要"],
    "postCount": 10,
    "schedule": {
      "type": "interval",
      "intervalMinutes": 60
    },
    "telegramChatId": "123456789",
    "isActive": true,
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z",
    "lastExecuted": "2023-12-01T11:00:00.000Z",
    "lastExecutionStatus": "success"
  }
}
```

#### 4. 更新配置
**PUT** `/configurations/{id}`

更新現有配置。

**路徑參數**:
- `id` (string): 配置 ID

**請求體**:
```json
{
  "name": "更新後的配置名稱",
  "keywords": ["新聞", "重要", "更新"],
  "postCount": 15,
  "isActive": false
}
```

**回應**:
```json
{
  "success": true,
  "data": {
    "id": "config-123",
    "name": "更新後的配置名稱",
    "pttBoard": "Gossiping",
    "keywords": ["新聞", "重要", "更新"],
    "postCount": 15,
    "schedule": {
      "type": "interval",
      "intervalMinutes": 60
    },
    "telegramChatId": "123456789",
    "isActive": false,
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T12:00:00.000Z"
  },
  "message": "配置更新成功"
}
```

#### 5. 刪除配置
**DELETE** `/configurations/{id}`

刪除指定配置。

**路徑參數**:
- `id` (string): 配置 ID

**回應**:
```json
{
  "success": true,
  "message": "配置刪除成功"
}
```

### 執行歷史

#### 6. 獲取配置執行歷史
**GET** `/executions/{configId}`

獲取特定配置的執行歷史。

**路徑參數**:
- `configId` (string): 配置 ID

**查詢參數**:
- `limit` (number, 可選): 限制返回數量，預設 20，最大 100
- `offset` (number, 可選): 分頁偏移量，預設 0
- `startDate` (string, 可選): 開始日期 (ISO 8601 格式)
- `endDate` (string, 可選): 結束日期 (ISO 8601 格式)
- `status` (string, 可選): 執行狀態篩選 (`success`, `error`, `partial`)
- `sortBy` (string, 可選): 排序欄位 (`timestamp`, `articlesFound`, `articlesSent`)
- `sortOrder` (string, 可選): 排序順序 (`asc`, `desc`)

**回應**:
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "id": "exec-123",
        "configurationId": "config-123",
        "configurationName": "新聞爬取配置",
        "timestamp": "2023-12-01T11:00:00.000Z",
        "status": "success",
        "articlesFound": 5,
        "articlesSent": 5,
        "executionTime": 2500,
        "pttBoard": "Gossiping",
        "keywords": ["新聞", "重要"],
        "telegramChatId": "123456789",
        "details": {
          "scrapingDuration": 1500,
          "telegramDeliveryDuration": 1000,
          "articles": [
            {
              "title": "[新聞] 重要新聞標題",
              "author": "newsuser",
              "url": "https://www.ptt.cc/bbs/Gossiping/M.1701234567.A.123.html",
              "sent": true
            }
          ]
        }
      }
    ],
    "stats": {
      "totalExecutions": 10,
      "successCount": 8,
      "errorCount": 1,
      "partialCount": 1,
      "totalArticlesFound": 45,
      "totalArticlesSent": 42,
      "averageExecutionTime": 2200
    },
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 10,
      "hasMore": false
    }
  }
}
```

#### 7. 獲取執行歷史總覽
**GET** `/executions`

獲取所有配置的執行歷史總覽。

**查詢參數**:
- `limit` (number, 可選): 限制返回數量，預設 20，最大 100
- `offset` (number, 可選): 分頁偏移量，預設 0
- `startDate` (string, 可選): 開始日期 (ISO 8601 格式)
- `endDate` (string, 可選): 結束日期 (ISO 8601 格式)
- `status` (string, 可選): 執行狀態篩選
- `configurationId` (string, 可選): 特定配置 ID 篩選

**回應**:
```json
{
  "success": true,
  "data": {
    "recentExecutions": [
      {
        "id": "exec-123",
        "configurationId": "config-123",
        "configurationName": "新聞爬取配置",
        "timestamp": "2023-12-01T11:00:00.000Z",
        "status": "success",
        "articlesFound": 5,
        "articlesSent": 5,
        "executionTime": 2500
      }
    ],
    "configurationStats": [
      {
        "configurationId": "config-123",
        "configurationName": "新聞爬取配置",
        "totalExecutions": 10,
        "successCount": 8,
        "errorCount": 1,
        "partialCount": 1,
        "lastExecution": "2023-12-01T11:00:00.000Z",
        "averageArticlesFound": 4.5,
        "averageArticlesSent": 4.2,
        "successRate": 80.0
      }
    ],
    "overallStats": {
      "totalConfigurations": 3,
      "totalExecutions": 30,
      "totalSuccessCount": 24,
      "totalErrorCount": 3,
      "totalPartialCount": 3,
      "averageSuccessRate": 80.0,
      "totalArticlesFound": 135,
      "totalArticlesSent": 126
    },
    "trendData": [
      {
        "timestamp": "2023-12-01T10:00:00.000Z",
        "success": 2,
        "error": 0,
        "partial": 1
      }
    ]
  }
}
```

### 監控和健康檢查

#### 8. 系統健康檢查
**GET** `/health`

檢查系統健康狀態。

**查詢參數**:
- `detailed` (boolean, 可選): 返回詳細健康資訊
- `metrics` (boolean, 可選): 包含系統指標

**回應**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2023-12-01T12:00:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "environment": "production",
    "services": {
      "database": "connected",
      "secretManager": "accessible"
    },
    "metrics": {
      "memoryUsage": {
        "rss": 134217728,
        "heapTotal": 67108864,
        "heapUsed": 45088768,
        "external": 2097152
      },
      "activeHandles": 5,
      "activeRequests": 0
    },
    "checks": {
      "memory": {
        "healthy": true,
        "lastCheck": "2023-12-01T12:00:00.000Z"
      },
      "uptime": {
        "healthy": true,
        "lastCheck": "2023-12-01T12:00:00.000Z"
      }
    }
  }
}
```

#### 9. 獲取系統指標
**GET** `/monitoring/metrics`

獲取系統效能指標。

**查詢參數**:
- `names` (string[], 可選): 指定指標名稱
- `timeWindow` (number, 可選): 時間窗口（毫秒）
- `format` (string, 可選): 回應格式 (`json`, `prometheus`)
- `limit` (number, 可選): 限制資料點數量

**回應 (JSON 格式)**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2023-12-01T12:00:00.000Z",
    "timeWindow": 3600000,
    "metrics": {
      "api_response_time": {
        "metrics": [
          {
            "value": 150,
            "timestamp": "2023-12-01T11:59:00.000Z",
            "labels": {
              "endpoint": "/api/configurations",
              "method": "GET"
            },
            "unit": "ms"
          }
        ],
        "stats": {
          "count": 100,
          "sum": 15000,
          "avg": 150,
          "min": 50,
          "max": 500,
          "latest": 150
        },
        "count": 100
      }
    },
    "circuitBreakers": {
      "database": {
        "state": "closed",
        "failureCount": 0,
        "lastFailureTime": 0,
        "halfOpenCalls": 0
      }
    },
    "summary": {
      "totalMetrics": 5,
      "totalDataPoints": 500,
      "circuitBreakersCount": 2
    }
  }
}
```

#### 10. 警報管理
**GET** `/monitoring/alerts`

獲取系統警報。

**查詢參數**:
- `level` (string, 可選): 警報等級 (`info`, `warning`, `error`, `critical`)
- `source` (string, 可選): 警報來源
- `resolved` (boolean, 可選): 是否已解決
- `since` (string, 可選): 起始時間 (ISO 8601 格式)
- `limit` (number, 可選): 限制返回數量

**回應**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-123",
        "level": "warning",
        "title": "High Memory Usage",
        "message": "Heap memory usage is 512.5MB",
        "timestamp": "2023-12-01T11:30:00.000Z",
        "source": "performance_monitor",
        "metadata": {
          "heapUsedMB": 512.5,
          "heapTotalMB": 1024
        },
        "resolved": false
      }
    ],
    "summary": {
      "total": 5,
      "byLevel": {
        "warning": 3,
        "error": 2
      },
      "bySource": {
        "performance_monitor": 2,
        "api-error-handler": 3
      },
      "resolved": 2,
      "unresolved": 3
    }
  }
}
```

**POST** `/monitoring/alerts`

創建新警報。

**請求體**:
```json
{
  "level": "warning",
  "title": "Custom Alert",
  "message": "This is a custom alert message",
  "source": "user",
  "metadata": {
    "customField": "customValue"
  }
}
```

**PUT** `/monitoring/alerts?id={alertId}`

解決警報。

**請求體**:
```json
{
  "message": "Issue has been resolved"
}
```

### Secret Manager

#### 11. 驗證 Secret 存取
**GET** `/secrets/validate`

驗證 Secret Manager 中的密鑰是否可存取。

**查詢參數**:
- `secretName` (string): 密鑰名稱

**回應**:
```json
{
  "success": true,
  "data": {
    "secretName": "telegram-bot-token",
    "accessible": true,
    "lastChecked": "2023-12-01T12:00:00.000Z"
  }
}
```

## 錯誤代碼

| 代碼 | HTTP 狀態 | 描述 |
|------|-----------|------|
| `BAD_REQUEST` | 400 | 請求參數錯誤 |
| `UNAUTHORIZED` | 401 | 未授權存取 |
| `FORBIDDEN` | 403 | 禁止存取 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `METHOD_NOT_ALLOWED` | 405 | HTTP 方法不允許 |
| `CONFLICT` | 409 | 資源衝突 |
| `TOO_MANY_REQUESTS` | 429 | 請求過於頻繁 |
| `INTERNAL_ERROR` | 500 | 內部伺服器錯誤 |
| `SERVICE_UNAVAILABLE` | 503 | 服務暫時不可用 |

## 速率限制

- 預設速率限制：每 15 分鐘 100 個請求
- 超過限制時返回 `429 Too Many Requests`
- 回應標頭包含速率限制資訊：
  - `X-RateLimit-Limit`: 限制數量
  - `X-RateLimit-Remaining`: 剩餘請求數
  - `X-RateLimit-Reset`: 重設時間

## 認證

API 支援可選的 API Key 認證：

```http
X-API-Key: your-api-key-here
```

## 範例程式碼

### JavaScript/Node.js

```javascript
// 創建配置
const createConfiguration = async () => {
  const response = await fetch('/api/configurations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      name: '新聞爬取配置',
      pttBoard: 'Gossiping',
      keywords: ['新聞', '重要'],
      postCount: 10,
      schedule: {
        type: 'interval',
        intervalMinutes: 60
      },
      telegramChatId: '123456789'
    })
  })
  
  const data = await response.json()
  if (data.success) {
    console.log('配置創建成功:', data.data)
  } else {
    console.error('創建失敗:', data.error)
  }
}

// 獲取執行歷史
const getExecutionHistory = async (configId) => {
  const params = new URLSearchParams({
    limit: '20',
    status: 'success',
    sortBy: 'timestamp',
    sortOrder: 'desc'
  })
  
  const response = await fetch(`/api/executions/${configId}?${params}`)
  const data = await response.json()
  
  if (data.success) {
    console.log('執行歷史:', data.data.executions)
    console.log('統計資料:', data.data.stats)
  }
}
```

### Python

```python
import requests
import json

# 創建配置
def create_configuration():
    url = 'https://your-domain.com/api/configurations'
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key'
    }
    data = {
        'name': '新聞爬取配置',
        'pttBoard': 'Gossiping',
        'keywords': ['新聞', '重要'],
        'postCount': 10,
        'schedule': {
            'type': 'interval',
            'intervalMinutes': 60
        },
        'telegramChatId': '123456789'
    }
    
    response = requests.post(url, headers=headers, json=data)
    result = response.json()
    
    if result['success']:
        print('配置創建成功:', result['data'])
    else:
        print('創建失敗:', result['error'])

# 獲取執行歷史
def get_execution_history(config_id):
    url = f'https://your-domain.com/api/executions/{config_id}'
    params = {
        'limit': 20,
        'status': 'success',
        'sortBy': 'timestamp',
        'sortOrder': 'desc'
    }
    
    response = requests.get(url, params=params)
    result = response.json()
    
    if result['success']:
        print('執行歷史:', result['data']['executions'])
        print('統計資料:', result['data']['stats'])
```

## 版本資訊

- **當前版本**: v1.0.0
- **API 版本**: v1
- **最後更新**: 2023-12-01

## 支援

如有問題或建議，請聯繫開發團隊或查看專案文檔。