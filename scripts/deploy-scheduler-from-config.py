#!/usr/bin/env python3

"""
Cloud Scheduler 配置部署腳本

此腳本讀取 YAML 配置文件並自動部署 Cloud Scheduler 工作
支援多個工作、不同環境和完整的配置管理
"""

import argparse
import json
import os
import subprocess
import sys
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional

# 顏色定義
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

def print_info(message: str):
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}")

def print_success(message: str):
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")

def print_error(message: str):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")

class SchedulerDeployer:
    def __init__(self, config_file: str, environment: str = 'production'):
        self.config_file = config_file
        self.environment = environment
        self.config = self.load_config()
        self.project_id = self.config.get('project_id')
        self.region = self.config.get('region', 'us-central1')
        self.timezone = self.config.get('timezone', 'Asia/Taipei')
        
    def load_config(self) -> Dict[str, Any]:
        """載入 YAML 配置文件"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            print_success(f"成功載入配置文件: {self.config_file}")
            return config
        except FileNotFoundError:
            print_error(f"配置文件不存在: {self.config_file}")
            sys.exit(1)
        except yaml.YAMLError as e:
            print_error(f"配置文件格式錯誤: {e}")
            sys.exit(1)
    
    def validate_config(self) -> bool:
        """驗證配置文件的完整性"""
        print_info("驗證配置文件...")
        
        required_fields = ['project_id', 'scheduler_jobs']
        for field in required_fields:
            if field not in self.config:
                print_error(f"配置文件缺少必要欄位: {field}")
                return False
        
        if not self.config['scheduler_jobs']:
            print_error("沒有定義任何 Scheduler 工作")
            return False
        
        # 驗證每個工作的配置
        for i, job in enumerate(self.config['scheduler_jobs']):
            job_name = job.get('name', f'job-{i}')
            
            required_job_fields = ['name', 'schedule', 'target']
            for field in required_job_fields:
                if field not in job:
                    print_error(f"工作 '{job_name}' 缺少必要欄位: {field}")
                    return False
            
            # 驗證目標配置
            target = job['target']
            if target.get('type') == 'http':
                if 'uri' not in target:
                    print_error(f"HTTP 工作 '{job_name}' 缺少 URI")
                    return False
        
        print_success("配置文件驗證通過")
        return True
    
    def run_gcloud_command(self, command: List[str]) -> tuple[bool, str]:
        """執行 gcloud 命令"""
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True
            )
            return True, result.stdout.strip()
        except subprocess.CalledProcessError as e:
            return False, e.stderr.strip()
    
    def check_prerequisites(self) -> bool:
        """檢查部署前置條件"""
        print_info("檢查部署前置條件...")
        
        # 檢查 gcloud CLI
        success, _ = self.run_gcloud_command(['gcloud', 'version'])
        if not success:
            print_error("gcloud CLI 未安裝或無法執行")
            return False
        
        # 檢查專案設定
        success, current_project = self.run_gcloud_command(['gcloud', 'config', 'get-value', 'project'])
        if not success or not current_project:
            print_error("gcloud 專案未設定")
            return False
        
        if current_project != self.project_id:
            print_warning(f"gcloud 目前專案 ({current_project}) 與配置不符 ({self.project_id})")
            print_info(f"將使用配置中的專案: {self.project_id}")
        
        # 檢查必要的 API
        required_apis = [
            'cloudscheduler.googleapis.com',
            'cloudfunctions.googleapis.com',
            'appengine.googleapis.com'
        ]
        
        for api in required_apis:
            success, result = self.run_gcloud_command([
                'gcloud', 'services', 'list',
                '--enabled',
                f'--filter=name:{api}',
                '--format=value(name)',
                f'--project={self.project_id}'
            ])
            
            if not success or api not in result:
                print_error(f"API 未啟用: {api}")
                return False
        
        print_success("前置條件檢查通過")
        return True
    
    def backup_existing_jobs(self) -> bool:
        """備份現有的 Scheduler 工作"""
        if not self.config.get('deployment', {}).get('backup_existing_config', True):
            return True
        
        print_info("備份現有的 Scheduler 工作...")
        
        # 列出現有工作
        success, result = self.run_gcloud_command([
            'gcloud', 'scheduler', 'jobs', 'list',
            f'--location={self.region}',
            f'--project={self.project_id}',
            '--format=value(name)'
        ])
        
        if not success:
            print_warning("無法列出現有工作，跳過備份")
            return True
        
        if not result.strip():
            print_info("沒有現有工作需要備份")
            return True
        
        # 建立備份目錄
        backup_dir = f"backup/scheduler/{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(backup_dir, exist_ok=True)
        
        job_names = result.strip().split('\n')
        for job_name in job_names:
            if not job_name:
                continue
            
            job_basename = job_name.split('/')[-1]
            
            # 匯出工作配置
            success, job_config = self.run_gcloud_command([
                'gcloud', 'scheduler', 'jobs', 'describe',
                job_basename,
                f'--location={self.region}',
                f'--project={self.project_id}',
                '--format=export'
            ])
            
            if success:
                backup_file = f"{backup_dir}/{job_basename}.yaml"
                with open(backup_file, 'w') as f:
                    f.write(job_config)
                print_info(f"已備份工作: {job_basename} -> {backup_file}")
        
        print_success(f"備份完成，備份目錄: {backup_dir}")
        return True
    
    def get_schedule_for_environment(self, job_config: Dict[str, Any]) -> str:
        """根據環境取得適當的排程"""
        base_schedule = job_config['schedule']
        
        if self.environment == 'development':
            dev_config = self.config.get('development', {})
            return dev_config.get('dev_schedule', base_schedule)
        elif self.environment == 'production':
            prod_config = self.config.get('production', {})
            return prod_config.get('prod_schedule', base_schedule)
        
        return base_schedule
    
    def deploy_job(self, job_config: Dict[str, Any]) -> bool:
        """部署單個 Scheduler 工作"""
        job_name = job_config['name']
        
        # 根據環境調整工作名稱
        if self.environment != 'production':
            job_name = f"{job_name}-{self.environment}"
        
        print_info(f"部署工作: {job_name}")
        
        # 檢查工作是否已存在
        success, _ = self.run_gcloud_command([
            'gcloud', 'scheduler', 'jobs', 'describe',
            job_name,
            f'--location={self.region}',
            f'--project={self.project_id}'
        ])
        
        job_exists = success
        command_type = 'update' if job_exists else 'create'
        
        # 建構 gcloud 命令
        target = job_config['target']
        schedule = self.get_schedule_for_environment(job_config)
        
        if target['type'] == 'http':
            cmd = [
                'gcloud', 'scheduler', 'jobs', command_type, 'http',
                job_name,
                f'--location={self.region}',
                f'--project={self.project_id}',
                f'--schedule={schedule}',
                f'--time-zone={self.timezone}',
                f'--uri={target["uri"]}',
                f'--http-method={target.get("http_method", "POST")}'
            ]
            
            # 加入描述
            if 'description' in job_config:
                cmd.extend(['--description', job_config['description']])
            
            # 加入標頭
            if 'headers' in target:
                for key, value in target['headers'].items():
                    cmd.extend(['--headers', f'{key}={value}'])
            
            # 加入請求體
            if 'body' in target:
                cmd.extend(['--message-body', target['body']])
            
            # 加入重試配置
            if 'retry_config' in job_config:
                retry_config = job_config['retry_config']
                if 'retry_count' in retry_config:
                    cmd.extend(['--max-retry-attempts', str(retry_config['retry_count'])])
                if 'max_retry_duration' in retry_config:
                    cmd.extend(['--max-retry-duration', retry_config['max_retry_duration']])
            
            # 加入 OIDC 認證（如果有自訂服務帳戶）
            iam_settings = self.config.get('iam_settings', {})
            custom_sa = iam_settings.get('custom_service_account', {})
            if 'email' in custom_sa:
                cmd.extend(['--oidc-service-account-email', custom_sa['email']])
        
        else:
            print_error(f"不支援的目標類型: {target['type']}")
            return False
        
        # 執行命令
        success, output = self.run_gcloud_command(cmd)
        
        if success:
            action = "更新" if job_exists else "建立"
            print_success(f"成功{action}工作: {job_name}")
            
            # 如果配置中指定停用，則暫停工作
            if not job_config.get('enabled', True):
                self.pause_job(job_name)
            
            return True
        else:
            print_error(f"部署工作失敗: {job_name}")
            print_error(f"錯誤訊息: {output}")
            return False
    
    def pause_job(self, job_name: str) -> bool:
        """暫停工作"""
        print_info(f"暫停工作: {job_name}")
        
        success, output = self.run_gcloud_command([
            'gcloud', 'scheduler', 'jobs', 'pause',
            job_name,
            f'--location={self.region}',
            f'--project={self.project_id}'
        ])
        
        if success:
            print_success(f"工作已暫停: {job_name}")
            return True
        else:
            print_error(f"暫停工作失敗: {job_name}")
            print_error(f"錯誤訊息: {output}")
            return False
    
    def test_deployment(self) -> bool:
        """測試部署結果"""
        if not self.config.get('deployment', {}).get('run_test_after_deploy', True):
            return True
        
        print_info("測試部署結果...")
        
        # 列出已部署的工作
        success, result = self.run_gcloud_command([
            'gcloud', 'scheduler', 'jobs', 'list',
            f'--location={self.region}',
            f'--project={self.project_id}',
            '--format=table(name.basename():label=NAME,schedule:label=SCHEDULE,state:label=STATE)'
        ])
        
        if success:
            print_info("已部署的工作:")
            print(result)
        else:
            print_warning("無法列出已部署的工作")
        
        # 測試手動觸發（僅針對啟用的工作）
        for job_config in self.config['scheduler_jobs']:
            if not job_config.get('enabled', True):
                continue
            
            job_name = job_config['name']
            if self.environment != 'production':
                job_name = f"{job_name}-{self.environment}"
            
            print_info(f"測試觸發工作: {job_name}")
            
            success, output = self.run_gcloud_command([
                'gcloud', 'scheduler', 'jobs', 'run',
                job_name,
                f'--location={self.region}',
                f'--project={self.project_id}'
            ])
            
            if success:
                print_success(f"工作觸發成功: {job_name}")
            else:
                print_warning(f"工作觸發失敗: {job_name}")
                print_warning(f"錯誤訊息: {output}")
        
        return True
    
    def deploy(self) -> bool:
        """執行完整部署流程"""
        print_info(f"開始部署 Cloud Scheduler 工作 (環境: {self.environment})")
        
        # 驗證配置
        if not self.validate_config():
            return False
        
        # 檢查前置條件
        if not self.check_prerequisites():
            return False
        
        # 備份現有工作
        if not self.backup_existing_jobs():
            return False
        
        # 部署每個工作
        success_count = 0
        total_count = len(self.config['scheduler_jobs'])
        
        for job_config in self.config['scheduler_jobs']:
            if self.deploy_job(job_config):
                success_count += 1
        
        # 顯示部署結果
        print_info(f"部署完成: {success_count}/{total_count} 個工作成功")
        
        if success_count == total_count:
            print_success("所有工作部署成功！")
            
            # 執行部署後測試
            self.test_deployment()
            
            return True
        else:
            print_error(f"有 {total_count - success_count} 個工作部署失敗")
            return False

def main():
    parser = argparse.ArgumentParser(description='Cloud Scheduler 配置部署工具')
    parser.add_argument(
        '--config',
        default='config/scheduler-config.yaml',
        help='配置文件路徑 (預設: config/scheduler-config.yaml)'
    )
    parser.add_argument(
        '--environment',
        choices=['development', 'staging', 'production'],
        default='production',
        help='部署環境 (預設: production)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='只驗證配置，不實際部署'
    )
    parser.add_argument(
        '--backup-only',
        action='store_true',
        help='只備份現有配置，不部署'
    )
    
    args = parser.parse_args()
    
    try:
        deployer = SchedulerDeployer(args.config, args.environment)
        
        if args.dry_run:
            print_info("執行 Dry Run 模式...")
            success = deployer.validate_config() and deployer.check_prerequisites()
            if success:
                print_success("配置驗證通過，可以進行部署")
            else:
                print_error("配置驗證失敗")
            return 0 if success else 1
        
        elif args.backup_only:
            print_info("執行備份模式...")
            success = deployer.backup_existing_jobs()
            return 0 if success else 1
        
        else:
            success = deployer.deploy()
            return 0 if success else 1
    
    except KeyboardInterrupt:
        print_error("部署已中斷")
        return 1
    except Exception as e:
        print_error(f"部署過程中發生錯誤: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())