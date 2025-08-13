"""
Cloud Function for PTT Article Scraping and Telegram Delivery

This function is triggered by Cloud Scheduler to:
1. Query Firestore for active configurations
2. Check which configurations are due for execution
3. Scrape PTT articles for each due configuration
4. Send articles via Telegram Bot
5. Log execution results to Firestore
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import functions_framework
from google.cloud import firestore
from google.cloud import secretmanager
import requests
from flask import Request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients
db = firestore.Client()
secret_client = secretmanager.SecretManagerServiceClient()

# Constants
TELEGRAM_API_BASE = "https://api.telegram.org/bot"
MAX_RETRIES = 3
BASE_DELAY = 1.0
MAX_DELAY = 10.0
TELEGRAM_MESSAGE_MAX_LENGTH = 4096


class PTTScrapingError(Exception):
    """Custom exception for PTT scraping errors"""
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class TelegramBotError(Exception):
    """Custom exception for Telegram Bot errors"""
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


def get_telegram_bot_token() -> str:
    """Retrieve Telegram Bot token from Secret Manager"""
    try:
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT')
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set")
        
        secret_name = os.environ.get('TELEGRAM_BOT_TOKEN_SECRET_NAME', 'telegram-bot-token')
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        
        response = secret_client.access_secret_version(request={"name": name})
        token = response.payload.data.decode("UTF-8")
        
        if not token:
            raise ValueError(f"Secret {secret_name} is empty")
        
        logger.info(f"Successfully retrieved Telegram bot token from secret {secret_name}")
        return token
    except Exception as e:
        logger.error(f"Failed to retrieve Telegram bot token: {e}")
        raise


def is_configuration_due(config: Dict[str, Any]) -> bool:
    """Check if a configuration is due for execution based on its schedule"""
    try:
        config_id = config.get('id', 'unknown')
        config_name = config.get('name', 'Unknown')
        schedule = config.get('schedule', {})
        schedule_type = schedule.get('type')
        last_executed = config.get('lastExecuted')
        
        now = datetime.utcnow()
        
        logger.info(f"Checking schedule for config '{config_name}' ({config_id}): type={schedule_type}")
        
        # If never executed, it's due
        if not last_executed:
            logger.info(f"Config '{config_name}' has never been executed - marking as due")
            return True
        
        # Convert Firestore timestamp to datetime if needed
        if hasattr(last_executed, 'timestamp'):
            last_executed = datetime.fromtimestamp(last_executed.timestamp())
        elif isinstance(last_executed, str):
            last_executed = datetime.fromisoformat(last_executed.replace('Z', '+00:00'))
        
        logger.info(f"Config '{config_name}' last executed: {last_executed}, current time: {now}")
        
        if schedule_type == 'hourly':
            next_due = last_executed + timedelta(hours=1)
            is_due = now >= next_due
            logger.info(f"Hourly schedule - next due: {next_due}, is due: {is_due}")
            return is_due
            
        elif schedule_type == 'daily':
            # For daily schedules, check if it's past the scheduled time
            scheduled_time = schedule.get('time', '09:00')  # Default to 9 AM
            try:
                hour, minute = map(int, scheduled_time.split(':'))
            except (ValueError, AttributeError):
                logger.warning(f"Invalid scheduled time format '{scheduled_time}', using 09:00")
                hour, minute = 9, 0
            
            # Get today's scheduled time
            today_scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If we haven't executed today and it's past the scheduled time
            is_due = last_executed.date() < now.date() and now >= today_scheduled
            
            logger.info(f"Daily schedule at {scheduled_time} - today's scheduled time: {today_scheduled}")
            logger.info(f"Last executed date: {last_executed.date()}, current date: {now.date()}")
            logger.info(f"Is past scheduled time today: {now >= today_scheduled}, is due: {is_due}")
            
            return is_due
            
        elif schedule_type == 'custom':
            interval_minutes = schedule.get('interval', 60)  # Default to 60 minutes
            next_due = last_executed + timedelta(minutes=interval_minutes)
            is_due = now >= next_due
            
            logger.info(f"Custom schedule - interval: {interval_minutes} minutes, next due: {next_due}, is due: {is_due}")
            return is_due
        
        else:
            logger.warning(f"Unknown schedule type '{schedule_type}' for config '{config_name}' - marking as not due")
            return False
            
    except Exception as e:
        logger.error(f"Error checking if configuration is due: {e}")
        return False


def log_scheduler_trigger():
    """Log information about the scheduler trigger"""
    try:
        trigger_time = datetime.utcnow()
        logger.info(f"=== Cloud Scheduler Trigger at {trigger_time} ===")
        
        # Log environment information
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'unknown')
        function_name = os.environ.get('FUNCTION_NAME', 'unknown')
        function_region = os.environ.get('FUNCTION_REGION', 'unknown')
        
        logger.info(f"Project: {project_id}")
        logger.info(f"Function: {function_name}")
        logger.info(f"Region: {function_region}")
        
        # Log execution context
        logger.info(f"Execution ID: {os.environ.get('FUNCTION_EXECUTION_ID', 'unknown')}")
        
    except Exception as e:
        logger.warning(f"Failed to log scheduler trigger info: {e}")


def calculate_next_execution_time(config: Dict[str, Any]) -> Optional[datetime]:
    """Calculate the next execution time for a configuration"""
    try:
        schedule = config.get('schedule', {})
        schedule_type = schedule.get('type')
        now = datetime.utcnow()
        
        if schedule_type == 'hourly':
            # Next hour
            return now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            
        elif schedule_type == 'daily':
            scheduled_time = schedule.get('time', '09:00')
            try:
                hour, minute = map(int, scheduled_time.split(':'))
            except (ValueError, AttributeError):
                hour, minute = 9, 0
            
            # Next occurrence of the scheduled time
            next_execution = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_execution <= now:
                next_execution += timedelta(days=1)
            
            return next_execution
            
        elif schedule_type == 'custom':
            interval_minutes = schedule.get('interval', 60)
            return now + timedelta(minutes=interval_minutes)
        
        return None
        
    except Exception as e:
        logger.error(f"Error calculating next execution time: {e}")
        return None


def scrape_ptt_articles(board_name: str, post_count: int, keywords: List[str]) -> List[Dict[str, Any]]:
    """
    Scrape PTT articles using the existing logic adapted for Python
    This is a simplified version - in production, you'd want to use the full scraper
    """
    try:
        import cloudscraper
        
        scraper = cloudscraper.create_scraper()
        url = f"https://www.ptt.cc/bbs/{board_name}/index.html"
        
        # Handle 18+ verification
        response = scraper.get(url)
        
        if 'ask/over18' in response.url or '我同意，我已年滿十八歲' in response.text:
            logger.info("Age verification required, accepting terms...")
            verification_url = f"https://www.ptt.cc/ask/over18?from={url}"
            scraper.post(verification_url, data={'yes': 'yes'})
            response = scraper.get(url)
        
        # Parse articles using BeautifulSoup
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        articles = []
        article_entries = soup.find_all('div', class_='r-ent')
        
        for entry in article_entries[:post_count * 2]:  # Get more than needed for filtering
            title_link = entry.find('div', class_='title').find('a')
            if not title_link:
                continue
            
            title = title_link.text.strip()
            link = f"https://www.ptt.cc{title_link['href']}"
            
            author_elem = entry.find('div', class_='author')
            author = author_elem.text.strip() if author_elem else 'Unknown'
            
            date_elem = entry.find('div', class_='date')
            date = date_elem.text.strip() if date_elem else 'Unknown'
            
            # Filter by keywords if provided
            if keywords:
                title_lower = title.lower()
                if not any(keyword.lower() in title_lower for keyword in keywords):
                    continue
            
            articles.append({
                'title': title,
                'author': author,
                'date': date,
                'link': link,
                'board': board_name
            })
            
            if len(articles) >= post_count:
                break
        
        logger.info(f"Scraped {len(articles)} articles from {board_name}")
        return articles
        
    except Exception as e:
        logger.error(f"Error scraping PTT board {board_name}: {e}")
        raise PTTScrapingError(f"Failed to scrape PTT board {board_name}: {e}")


def format_articles_for_telegram(articles: List[Dict[str, Any]], board_name: str) -> List[str]:
    """Format articles for Telegram messages"""
    if not articles:
        return [f"📋 **{board_name}** 看板目前沒有符合條件的文章"]
    
    messages = []
    current_message = f"📋 **{board_name}** 看板最新文章 ({len(articles)} 篇)\n\n"
    
    for i, article in enumerate(articles, 1):
        article_text = f"{i}. **{article['title']}**\n"
        article_text += f"   👤 {article['author']} | 📅 {article['date']}\n"
        article_text += f"   🔗 {article['link']}\n\n"
        
        # Check if adding this article would exceed message length
        if len(current_message + article_text) > TELEGRAM_MESSAGE_MAX_LENGTH:
            if current_message.strip():
                messages.append(current_message.strip())
            current_message = f"📋 **{board_name}** 看板最新文章 (續)\n\n" + article_text
        else:
            current_message += article_text
    
    if current_message.strip():
        messages.append(current_message.strip())
    
    return messages


def send_telegram_messages(token: str, chat_id: str, messages: List[str]) -> None:
    """Send messages to Telegram with retry logic"""
    for i, message in enumerate(messages):
        retry_count = 0
        while retry_count < MAX_RETRIES:
            try:
                url = f"{TELEGRAM_API_BASE}{token}/sendMessage"
                payload = {
                    'chat_id': chat_id,
                    'text': message,
                    'parse_mode': 'Markdown',
                    'disable_web_page_preview': True
                }
                
                response = requests.post(url, json=payload, timeout=30)
                response.raise_for_status()
                
                result = response.json()
                if not result.get('ok'):
                    raise TelegramBotError(f"Telegram API error: {result.get('description', 'Unknown error')}")
                
                logger.info(f"Successfully sent message {i+1}/{len(messages)} to chat {chat_id}")
                
                # Add delay between messages to avoid rate limiting
                if i < len(messages) - 1:
                    time.sleep(1)
                
                break
                
            except requests.exceptions.RequestException as e:
                retry_count += 1
                if retry_count >= MAX_RETRIES:
                    raise TelegramBotError(f"Failed to send message after {MAX_RETRIES} retries: {e}")
                
                delay = min(BASE_DELAY * (2 ** retry_count), MAX_DELAY)
                logger.warning(f"Telegram request failed (attempt {retry_count}/{MAX_RETRIES}), retrying in {delay}s...")
                time.sleep(delay)
            
            except Exception as e:
                raise TelegramBotError(f"Unexpected error sending Telegram message: {e}")


def create_execution_record(config_id: str, status: str, articles_found: int, 
                          articles_sent: int, duration: float, error_message: str = None) -> None:
    """Create an execution record in Firestore"""
    try:
        execution_data = {
            'configurationId': config_id,
            'executedAt': firestore.SERVER_TIMESTAMP,
            'status': status,
            'articlesFound': articles_found,
            'articlesSent': articles_sent,
            'executionDuration': duration,
            'errorMessage': error_message
        }
        
        db.collection('executions').add(execution_data)
        logger.info(f"Created execution record for config {config_id}")
        
    except Exception as e:
        logger.error(f"Failed to create execution record: {e}")


def update_configuration_status(config_id: str, status: str, message: str = None) -> None:
    """Update configuration's last execution status"""
    try:
        update_data = {
            'lastExecuted': firestore.SERVER_TIMESTAMP,
            'lastExecutionStatus': status,
            'lastExecutionMessage': message,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('configurations').document(config_id).update(update_data)
        logger.info(f"Updated configuration {config_id} status to {status}")
        
    except Exception as e:
        logger.error(f"Failed to update configuration status: {e}")


def execute_scraping_job(config: Dict[str, Any], telegram_token: str) -> Dict[str, Any]:
    """Execute a single scraping job for a configuration"""
    config_id = config['id']
    config_name = config.get('name', 'Unknown')
    
    start_time = time.time()
    articles_found = 0
    articles_sent = 0
    status = 'error'
    error_message = None
    
    try:
        logger.info(f"Executing scraping job for configuration: {config_name} ({config_id})")
        
        # Extract configuration parameters
        board_name = config['pttBoard']
        post_count = config.get('postCount', 20)
        keywords = config.get('keywords', [])
        chat_id = config['telegramChatId']
        
        # Scrape PTT articles
        articles = scrape_ptt_articles(board_name, post_count, keywords)
        articles_found = len(articles)
        
        if articles_found == 0:
            status = 'no_articles'
            logger.info(f"No articles found for configuration {config_name}")
        else:
            # Format and send articles via Telegram
            messages = format_articles_for_telegram(articles, board_name)
            send_telegram_messages(telegram_token, chat_id, messages)
            
            articles_sent = articles_found
            status = 'success'
            logger.info(f"Successfully sent {articles_sent} articles for configuration {config_name}")
        
    except PTTScrapingError as e:
        error_message = f"PTT scraping error: {str(e)}"
        logger.error(f"PTT scraping failed for {config_name}: {e}")
        
    except TelegramBotError as e:
        error_message = f"Telegram delivery error: {str(e)}"
        logger.error(f"Telegram delivery failed for {config_name}: {e}")
        
    except Exception as e:
        error_message = f"Unexpected error: {str(e)}"
        logger.error(f"Unexpected error in scraping job for {config_name}: {e}")
    
    finally:
        # Record execution time
        execution_duration = time.time() - start_time
        
        # Update configuration status
        update_configuration_status(config_id, status, error_message)
        
        # Create execution record
        create_execution_record(
            config_id, status, articles_found, articles_sent, 
            execution_duration, error_message
        )
        
        return {
            'config_id': config_id,
            'config_name': config_name,
            'status': status,
            'articles_found': articles_found,
            'articles_sent': articles_sent,
            'execution_duration': execution_duration,
            'error_message': error_message
        }


@functions_framework.http
def main(request: Request) -> Dict[str, Any]:
    """
    Main Cloud Function entry point triggered by Cloud Scheduler
    
    This function:
    1. Queries Firestore for active configurations
    2. Checks which configurations are due for execution
    3. Executes scraping jobs for due configurations
    4. Returns execution summary
    """
    start_time = time.time()
    execution_results = []
    
    try:
        # Log scheduler trigger information
        log_scheduler_trigger()
        
        logger.info("Starting PTT scraping scheduler execution")
        
        # Get Telegram bot token from Secret Manager
        telegram_token = get_telegram_bot_token()
        
        # Query Firestore for active configurations
        configs_ref = db.collection('configurations')
        active_configs = configs_ref.where('isActive', '==', True).stream()
        
        # Convert to list and add document IDs
        configurations = []
        for doc in active_configs:
            config_data = doc.to_dict()
            config_data['id'] = doc.id
            configurations.append(config_data)
        
        logger.info(f"Found {len(configurations)} active configurations")
        
        if not configurations:
            logger.info("No active configurations found")
            return {
                'success': True,
                'message': 'No active configurations found',
                'execution_time': time.time() - start_time,
                'results': []
            }
        
        # Check which configurations are due for execution
        due_configurations = []
        for config in configurations:
            if is_configuration_due(config):
                due_configurations.append(config)
                logger.info(f"Configuration '{config.get('name')}' is due for execution")
            else:
                logger.debug(f"Configuration '{config.get('name')}' is not due yet")
        
        logger.info(f"Found {len(due_configurations)} configurations due for execution")
        
        # Execute scraping jobs for due configurations
        for config in due_configurations:
            try:
                result = execute_scraping_job(config, telegram_token)
                execution_results.append(result)
            except Exception as e:
                logger.error(f"Failed to execute job for config {config.get('name')}: {e}")
                execution_results.append({
                    'config_id': config['id'],
                    'config_name': config.get('name', 'Unknown'),
                    'status': 'error',
                    'articles_found': 0,
                    'articles_sent': 0,
                    'execution_duration': 0,
                    'error_message': str(e)
                })
        
        # Prepare response
        total_execution_time = time.time() - start_time
        successful_jobs = sum(1 for r in execution_results if r['status'] == 'success')
        total_articles_sent = sum(r['articles_sent'] for r in execution_results)
        
        response = {
            'success': True,
            'message': f'Executed {len(execution_results)} jobs, {successful_jobs} successful',
            'execution_time': total_execution_time,
            'total_articles_sent': total_articles_sent,
            'results': execution_results
        }
        
        logger.info(f"Scheduler execution completed in {total_execution_time:.2f}s")
        logger.info(f"Summary: {successful_jobs}/{len(execution_results)} jobs successful, {total_articles_sent} articles sent")
        
        return response
        
    except Exception as e:
        logger.error(f"Critical error in scheduler execution: {e}")
        return {
            'success': False,
            'error': str(e),
            'execution_time': time.time() - start_time,
            'results': execution_results
        }


if __name__ == '__main__':
    # For local testing
    from flask import Flask, request
    
    app = Flask(__name__)
    
    @app.route('/', methods=['POST', 'GET'])
    def test_main():
        return main(request)
    
    app.run(debug=True, port=8080)