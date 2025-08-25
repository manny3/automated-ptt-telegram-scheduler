# Design Document

## Overview

本設計文件旨在解決當前 CI/CD pipeline 中的測試錯誤，主要問題包括：
1. React 19 與 @testing-library/react@15.0.0 的相容性問題
2. Jest 配置文件中的語法錯誤（moduleNameMapper 配置不完整）
3. npm 依賴解析錯誤（ERESOLVE 問題）
4. GitHub Actions 中的依賴安裝失敗

## Architecture

### 問題分析架構

```
CI Pipeline Issues
├── Dependency Resolution
│   ├── React 19 compatibility
│   ├── Testing library versions
│   └── Peer dependency conflicts
├── Configuration Issues
│   ├── Jest configuration syntax errors
│   ├── Module name mapping
│   └── TypeScript integration
└── CI/CD Environment
    ├── Node.js version compatibility
    ├── npm cache strategy
    └── Workflow optimization
```

### 解決方案架構

```
Solution Components
├── Package Management
│   ├── Update @testing-library/react to v16+
│   ├── Resolve peer dependencies
│   └── Lock compatible versions
├── Configuration Fixes
│   ├── Fix Jest moduleNameMapper syntax
│   ├── Update TypeScript paths
│   └── Optimize test environment
└── CI/CD Improvements
    ├── Enhanced caching strategy
    ├── Better error handling
    └── Parallel execution optimization
```

## Components and Interfaces

### 1. 依賴管理組件

**目標**: 解決 React 19 相容性和依賴衝突

**關鍵更新**:
- `@testing-library/react`: 升級到 v16.0.0+ (支援 React 19)
- `@testing-library/jest-dom`: 確保版本相容
- `@types/react` 和 `@types/react-dom`: 保持與 React 19 一致

**解決策略**:
```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/user-event": "^14.5.2"
  },
  "overrides": {
    "@testing-library/react": "^16.0.0"
  }
}
```

### 2. Jest 配置修復組件

**目標**: 修復 Jest 配置語法錯誤和模組解析問題

**問題識別**:
- `moduleNameMapper` 中每個路徑映射都缺少結尾引號和逗號
- 語法錯誤導致 Jest 無法正確解析模組路徑

**修復方案**:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@/components/(.*)$': '<rootDir>/src/components/$1',
  '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
  '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
  '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
  '^@/types/(.*)$': '<rootDir>/src/types/$1',
  '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
}
```

### 3. CI/CD 優化組件

**目標**: 提升 GitHub Actions 執行穩定性和效能

**優化策略**:
- 使用 `npm ci` 替代 `npm install` 確保一致性
- 實施多層快取策略（node_modules, npm cache, build cache）
- 添加 `--legacy-peer-deps` 標誌處理 peer dependency 警告
- 優化並行執行和資源分配

## Data Models

### 依賴版本矩陣

```typescript
interface DependencyMatrix {
  react: "^19.1.1";
  "@testing-library/react": "^16.0.0";
  "@types/react": "^19.1.10";
  jest: "^29.7.0";
  "jest-environment-jsdom": "^29.7.0";
}
```

### CI 配置模型

```typescript
interface CIConfiguration {
  nodeVersions: ["18.x", "20.x"];
  testGroups: ["unit", "integration", "e2e", "performance"];
  cacheStrategy: {
    paths: string[];
    key: string;
    restoreKeys: string[];
  };
  timeouts: {
    install: number;
    test: number;
    build: number;
  };
}
```

## Error Handling

### 1. 依賴解析錯誤處理

**策略**: 使用 npm overrides 和 resolutions 強制版本一致性
```json
{
  "overrides": {
    "@testing-library/react": "^16.0.0"
  },
  "resolutions": {
    "@testing-library/react": "^16.0.0"
  }
}
```

### 2. Jest 配置錯誤處理

**策略**: 添加配置驗證和錯誤回報
- 使用 `jest --showConfig` 驗證配置正確性
- 添加詳細的錯誤日誌輸出
- 實施配置語法檢查

### 3. CI 環境錯誤處理

**策略**: 多重備援和優雅降級
- 快取失效時的備用安裝策略
- 測試失敗時的詳細錯誤報告
- 超時處理和重試機制

## Testing Strategy

### 1. 本地測試驗證

**步驟**:
1. 清除 node_modules 和 package-lock.json
2. 重新安裝依賴並驗證無 ERESOLVE 錯誤
3. 執行所有測試套件確保通過
4. 驗證測試覆蓋率報告生成

### 2. CI 環境測試

**步驟**:
1. 在多個 Node.js 版本上測試
2. 驗證快取策略有效性
3. 測試並行執行穩定性
4. 確認錯誤報告機制

### 3. 回歸測試

**步驟**:
1. 確保現有功能不受影響
2. 驗證所有測試案例仍然有效
3. 檢查效能沒有顯著下降
4. 確認部署流程正常

## Implementation Phases

### Phase 1: 依賴修復
- 更新 package.json 中的測試庫版本
- 解決 peer dependency 衝突
- 驗證本地環境正常運作

### Phase 2: 配置修復
- 修復 Jest 配置語法錯誤
- 更新 TypeScript 配置
- 優化測試環境設定

### Phase 3: CI/CD 優化
- 更新 GitHub Actions workflow
- 實施增強的快取策略
- 添加錯誤處理和監控

### Phase 4: 驗證和測試
- 執行完整的測試套件
- 驗證 CI pipeline 穩定性
- 效能基準測試和優化