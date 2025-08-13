#!/usr/bin/env python3
"""
Local testing script for PTT Scraper Cloud Function

This script allows you to test the Cloud Function locally without deploying it.
It sets up mock data and environment variables for testing.
"""

import os
import sys
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up environment variables for testing
os.environ['GOOGLE_CLOUD_PROJECT'] = 'test-project'
os.environ['TELEGRAM_BOT_TOKEN_SECRET_NAME'] = 'telegram-bot-token'

# Import the main function
from main import main


def create_mock_request():
    """Create a mock Flask request object"""
    mock_request = Mock()
    mock_request.get_json.return_value = {}
    mock_request.args = {}
    return mock_request


def create_test_configuration():
    """Create a test configuration for local testing"""
    return {
        'id': 'local-test-config',
        'name': 'Local Test Configuration',
        'pttBoard': 'Tech_Job',
        'keywords': ['python', 'backend'],
        'postCount': 3,
        'schedule': {'type': 'hourly'},
        'telegramChatId': '123456789',
        'isActive': True,
        'lastExecuted': datetime.utcnow() - timedelta(hours=2)  # Due for execution
    }


def create_mock_articles():
    """Create mock PTT articles for testing"""
    return [
        {
            'title': '[徵才] Senior Python Backend Engineer',
            'author': 'hr_tech_company',
            'date': '12/25',
            'link': 'https://www.ptt.cc/bbs/Tech_Job/M.1234567890.A.123.html',
            'board': 'Tech_Job'
        },
        {
            'title': '[請益] Python Backend 架構問題',
            'author': 'developer123',
            'date': '12/24',
            'link': 'https://www.ptt.cc/bbs/Tech_Job/M.1234567891.A.124.html',
            'board': 'Tech_Job'
        }
    ]


@patch('main.send_telegram_messages')
@patch('main.scrape_ptt_articles')
@patch('main.get_telegram_bot_token')
@patch('main.db')
def test_local_execution(mock_db, mock_get_token, mock_scrape, mock_send_telegram):
    """Test the Cloud Function with mocked dependencies"""
    
    print("Setting up mocks for local testing...")
    
    # Mock Secret Manager token retrieval
    mock_get_token.return_value = 'test-bot-token-123'
    
    # Mock Firestore configuration query
    test_config = create_test_configuration()
    mock_doc = Mock()
    mock_doc.to_dict.return_value = test_config
    mock_doc.id = test_config['id']
    
    mock_collection = Mock()
    mock_collection.where.return_value.stream.return_value = [mock_doc]
    mock_db.collection.return_value = mock_collection
    
    # Mock document updates
    mock_document = Mock()
    mock_collection.document.return_value = mock_document
    
    # Mock PTT scraping
    mock_articles = create_mock_articles()
    mock_scrape.return_value = mock_articles
    
    # Mock Telegram sending (no-op for local testing)
    mock_send_telegram.return_value = None
    
    print("Executing Cloud Function locally...")
    
    # Create mock request and execute
    mock_request = create_mock_request()
    response = main(mock_request)
    
    print("\n" + "="*50)
    print("LOCAL TEST RESULTS")
    print("="*50)
    print(f"Success: {response['success']}")
    print(f"Message: {response['message']}")
    print(f"Execution Time: {response['execution_time']:.2f}s")
    print(f"Total Articles Sent: {response['total_articles_sent']}")
    print(f"Number of Jobs Executed: {len(response['results'])}")
    
    if response['results']:
        print("\nJob Results:")
        for i, result in enumerate(response['results'], 1):
            print(f"  Job {i}:")
            print(f"    Config: {result['config_name']}")
            print(f"    Status: {result['status']}")
            print(f"    Articles Found: {result['articles_found']}")
            print(f"    Articles Sent: {result['articles_sent']}")
            print(f"    Duration: {result['execution_duration']:.2f}s")
            if result['error_message']:
                print(f"    Error: {result['error_message']}")
    
    print("\nMock Call Verification:")
    print(f"  get_telegram_bot_token called: {mock_get_token.called}")
    print(f"  scrape_ptt_articles called: {mock_scrape.called}")
    print(f"  send_telegram_messages called: {mock_send_telegram.called}")
    
    if mock_scrape.called:
        scrape_args = mock_scrape.call_args[0]
        print(f"  Scraping args: board={scrape_args[0]}, count={scrape_args[1]}, keywords={scrape_args[2]}")
    
    if mock_send_telegram.called:
        telegram_args = mock_send_telegram.call_args[0]
        print(f"  Telegram args: chat_id={telegram_args[1]}, messages_count={len(telegram_args[2])}")
    
    print("="*50)
    
    return response


def test_error_scenarios():
    """Test various error scenarios"""
    print("\n" + "="*50)
    print("TESTING ERROR SCENARIOS")
    print("="*50)
    
    # Test 1: No active configurations
    print("\nTest 1: No active configurations")
    with patch('main.get_telegram_bot_token') as mock_token, \
         patch('main.db') as mock_db:
        
        mock_token.return_value = 'test-token'
        mock_collection = Mock()
        mock_collection.where.return_value.stream.return_value = []
        mock_db.collection.return_value = mock_collection
        
        response = main(create_mock_request())
        print(f"  Result: {response['message']}")
        assert response['success'] is True
        assert len(response['results']) == 0
    
    # Test 2: Token retrieval failure
    print("\nTest 2: Token retrieval failure")
    with patch('main.get_telegram_bot_token') as mock_token:
        mock_token.side_effect = Exception("Secret Manager unavailable")
        
        response = main(create_mock_request())
        print(f"  Result: {response['error']}")
        assert response['success'] is False
    
    print("\nAll error scenario tests passed!")


def main_test():
    """Main testing function"""
    print("PTT Scraper Cloud Function - Local Testing")
    print("=" * 50)
    
    try:
        # Test normal execution
        response = test_local_execution()
        
        # Test error scenarios
        test_error_scenarios()
        
        print("\n✅ All local tests completed successfully!")
        
        # Show sample response format
        print("\nSample Response Format:")
        print(json.dumps(response, indent=2, default=str))
        
    except Exception as e:
        print(f"\n❌ Local testing failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main_test()