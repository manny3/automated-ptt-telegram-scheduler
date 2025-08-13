"""
Integration tests for the PTT Scraper Cloud Function

These tests verify the complete scraping and delivery flow including:
- Configuration querying from Firestore
- PTT article scraping
- Telegram message delivery
- Execution logging
"""

import json
import os
import time
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

# Import the main function and utilities
from main import (
    main, execute_scraping_job, is_configuration_due, 
    scrape_ptt_articles, format_articles_for_telegram,
    send_telegram_messages, get_telegram_bot_token,
    create_execution_record, update_configuration_status
)


class TestPTTScraperCloudFunction(unittest.TestCase):
    """Test suite for PTT Scraper Cloud Function"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_config = {
            'id': 'test-config-123',
            'name': 'Test Configuration',
            'pttBoard': 'Tech_Job',
            'keywords': ['python', 'backend'],
            'postCount': 5,
            'schedule': {'type': 'hourly'},
            'telegramChatId': '123456789',
            'isActive': True,
            'lastExecuted': None
        }
        
        self.mock_articles = [
            {
                'title': '[徵才] Python Backend Engineer',
                'author': 'testuser1',
                'date': '12/25',
                'link': 'https://www.ptt.cc/bbs/Tech_Job/M.1234567890.A.123.html',
                'board': 'Tech_Job'
            },
            {
                'title': '[請益] Backend 開發問題',
                'author': 'testuser2', 
                'date': '12/24',
                'link': 'https://www.ptt.cc/bbs/Tech_Job/M.1234567891.A.124.html',
                'board': 'Tech_Job'
            }
        ]
        
        # Set up environment variables for testing
        os.environ['GOOGLE_CLOUD_PROJECT'] = 'test-project'
        os.environ['TELEGRAM_BOT_TOKEN_SECRET_NAME'] = 'test-telegram-token'

    def test_is_configuration_due_never_executed(self):
        """Test that configurations never executed are considered due"""
        config = self.mock_config.copy()
        config['lastExecuted'] = None
        
        self.assertTrue(is_configuration_due(config))

    def test_is_configuration_due_hourly_schedule(self):
        """Test hourly schedule logic"""
        config = self.mock_config.copy()
        
        # Test configuration executed 2 hours ago (should be due)
        config['lastExecuted'] = datetime.utcnow() - timedelta(hours=2)
        self.assertTrue(is_configuration_due(config))
        
        # Test configuration executed 30 minutes ago (should not be due)
        config['lastExecuted'] = datetime.utcnow() - timedelta(minutes=30)
        self.assertFalse(is_configuration_due(config))

    def test_is_configuration_due_daily_schedule(self):
        """Test daily schedule logic"""
        config = self.mock_config.copy()
        config['schedule'] = {'type': 'daily', 'time': '09:00'}
        
        now = datetime.utcnow()
        
        # Test configuration executed yesterday (should be due if past 9 AM)
        config['lastExecuted'] = now - timedelta(days=1)
        
        # Mock current time to be 10 AM
        with patch('main.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = now.replace(hour=10, minute=0)
            self.assertTrue(is_configuration_due(config))
        
        # Mock current time to be 8 AM (should not be due)
        with patch('main.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = now.replace(hour=8, minute=0)
            self.assertFalse(is_configuration_due(config))

    def test_is_configuration_due_custom_schedule(self):
        """Test custom interval schedule logic"""
        config = self.mock_config.copy()
        config['schedule'] = {'type': 'custom', 'interval': 30}  # 30 minutes
        
        # Test configuration executed 45 minutes ago (should be due)
        config['lastExecuted'] = datetime.utcnow() - timedelta(minutes=45)
        self.assertTrue(is_configuration_due(config))
        
        # Test configuration executed 15 minutes ago (should not be due)
        config['lastExecuted'] = datetime.utcnow() - timedelta(minutes=15)
        self.assertFalse(is_configuration_due(config))

    @patch('main.cloudscraper')
    @patch('main.BeautifulSoup')
    def test_scrape_ptt_articles_success(self, mock_bs, mock_cloudscraper):
        """Test successful PTT article scraping"""
        # Mock cloudscraper response
        mock_scraper = Mock()
        mock_response = Mock()
        mock_response.url = 'https://www.ptt.cc/bbs/Tech_Job/index.html'
        mock_response.text = '<html>mock html</html>'
        mock_scraper.get.return_value = mock_response
        mock_cloudscraper.create_scraper.return_value = mock_scraper
        
        # Mock BeautifulSoup parsing
        mock_soup = Mock()
        mock_bs.return_value = mock_soup
        
        # Mock article entries
        mock_entries = []
        for article in self.mock_articles:
            mock_entry = Mock()
            mock_title_div = Mock()
            mock_title_link = Mock()
            mock_title_link.text.strip.return_value = article['title']
            mock_title_link.__getitem__.return_value = article['link'].replace('https://www.ptt.cc', '')
            mock_title_div.find.return_value = mock_title_link
            mock_entry.find.side_effect = lambda class_name: {
                'title': mock_title_div,
                'author': Mock(text=Mock(strip=Mock(return_value=article['author']))),
                'date': Mock(text=Mock(strip=Mock(return_value=article['date'])))
            }.get(class_name)
            mock_entries.append(mock_entry)
        
        mock_soup.find_all.return_value = mock_entries
        
        # Test scraping
        articles = scrape_ptt_articles('Tech_Job', 5, ['python', 'backend'])
        
        self.assertEqual(len(articles), 2)  # Both articles match keywords
        self.assertEqual(articles[0]['title'], '[徵才] Python Backend Engineer')
        self.assertEqual(articles[1]['title'], '[請益] Backend 開發問題')

    def test_format_articles_for_telegram_empty(self):
        """Test formatting empty article list"""
        messages = format_articles_for_telegram([], 'Tech_Job')
        
        self.assertEqual(len(messages), 1)
        self.assertIn('Tech_Job', messages[0])
        self.assertIn('沒有符合條件的文章', messages[0])

    def test_format_articles_for_telegram_with_articles(self):
        """Test formatting articles for Telegram"""
        messages = format_articles_for_telegram(self.mock_articles, 'Tech_Job')
        
        self.assertGreater(len(messages), 0)
        self.assertIn('Tech_Job', messages[0])
        self.assertIn('Python Backend Engineer', messages[0])
        self.assertIn('Backend 開發問題', messages[0])

    @patch('main.requests.post')
    def test_send_telegram_messages_success(self, mock_post):
        """Test successful Telegram message sending"""
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {'ok': True}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        messages = ['Test message 1', 'Test message 2']
        
        # Should not raise any exception
        send_telegram_messages('test-token', '123456789', messages)
        
        # Verify requests were made
        self.assertEqual(mock_post.call_count, 2)

    @patch('main.requests.post')
    def test_send_telegram_messages_retry_on_failure(self, mock_post):
        """Test retry logic for Telegram message sending"""
        # Mock failure then success
        mock_response_fail = Mock()
        mock_response_fail.raise_for_status.side_effect = Exception('Network error')
        
        mock_response_success = Mock()
        mock_response_success.json.return_value = {'ok': True}
        mock_response_success.raise_for_status.return_value = None
        
        mock_post.side_effect = [mock_response_fail, mock_response_success]
        
        messages = ['Test message']
        
        # Should succeed after retry
        send_telegram_messages('test-token', '123456789', messages)
        
        # Verify retry occurred
        self.assertEqual(mock_post.call_count, 2)

    @patch('main.secret_client')
    def test_get_telegram_bot_token_success(self, mock_secret_client):
        """Test successful token retrieval from Secret Manager"""
        # Mock secret manager response
        mock_response = Mock()
        mock_response.payload.data.decode.return_value = 'test-bot-token-123'
        mock_secret_client.access_secret_version.return_value = [mock_response]
        
        token = get_telegram_bot_token()
        
        self.assertEqual(token, 'test-bot-token-123')

    @patch('main.db')
    def test_create_execution_record(self, mock_db):
        """Test creation of execution records in Firestore"""
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        
        create_execution_record(
            'test-config-123', 'success', 5, 5, 2.5, None
        )
        
        # Verify Firestore collection and add were called
        mock_db.collection.assert_called_with('executions')
        mock_collection.add.assert_called_once()

    @patch('main.db')
    def test_update_configuration_status(self, mock_db):
        """Test updating configuration status in Firestore"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        
        update_configuration_status('test-config-123', 'success', 'All good')
        
        # Verify Firestore update was called
        mock_db.collection.assert_called_with('configurations')
        mock_collection.document.assert_called_with('test-config-123')
        mock_document.update.assert_called_once()

    @patch('main.send_telegram_messages')
    @patch('main.scrape_ptt_articles')
    @patch('main.update_configuration_status')
    @patch('main.create_execution_record')
    def test_execute_scraping_job_success(self, mock_create_record, mock_update_status, 
                                        mock_scrape, mock_send_telegram):
        """Test successful execution of a scraping job"""
        # Mock successful scraping
        mock_scrape.return_value = self.mock_articles
        
        # Execute job
        result = execute_scraping_job(self.mock_config, 'test-token')
        
        # Verify result
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['articles_found'], 2)
        self.assertEqual(result['articles_sent'], 2)
        self.assertIsNone(result['error_message'])
        
        # Verify functions were called
        mock_scrape.assert_called_once()
        mock_send_telegram.assert_called_once()
        mock_update_status.assert_called_once()
        mock_create_record.assert_called_once()

    @patch('main.send_telegram_messages')
    @patch('main.scrape_ptt_articles')
    @patch('main.update_configuration_status')
    @patch('main.create_execution_record')
    def test_execute_scraping_job_no_articles(self, mock_create_record, mock_update_status,
                                            mock_scrape, mock_send_telegram):
        """Test scraping job when no articles are found"""
        # Mock empty scraping result
        mock_scrape.return_value = []
        
        # Execute job
        result = execute_scraping_job(self.mock_config, 'test-token')
        
        # Verify result
        self.assertEqual(result['status'], 'no_articles')
        self.assertEqual(result['articles_found'], 0)
        self.assertEqual(result['articles_sent'], 0)
        
        # Verify Telegram was not called
        mock_send_telegram.assert_not_called()

    @patch('main.get_telegram_bot_token')
    @patch('main.execute_scraping_job')
    @patch('main.is_configuration_due')
    @patch('main.db')
    def test_main_function_success(self, mock_db, mock_is_due, mock_execute_job, mock_get_token):
        """Test the main Cloud Function entry point"""
        # Mock Firestore query
        mock_doc = Mock()
        mock_doc.to_dict.return_value = self.mock_config
        mock_doc.id = 'test-config-123'
        
        mock_collection = Mock()
        mock_collection.where.return_value.stream.return_value = [mock_doc]
        mock_db.collection.return_value = mock_collection
        
        # Mock other dependencies
        mock_get_token.return_value = 'test-token'
        mock_is_due.return_value = True
        mock_execute_job.return_value = {
            'config_id': 'test-config-123',
            'config_name': 'Test Configuration',
            'status': 'success',
            'articles_found': 2,
            'articles_sent': 2,
            'execution_duration': 2.5,
            'error_message': None
        }
        
        # Create mock request
        mock_request = Mock()
        
        # Execute main function
        response = main(mock_request)
        
        # Verify response
        self.assertTrue(response['success'])
        self.assertEqual(len(response['results']), 1)
        self.assertEqual(response['results'][0]['status'], 'success')
        self.assertEqual(response['total_articles_sent'], 2)

    @patch('main.get_telegram_bot_token')
    @patch('main.db')
    def test_main_function_no_active_configs(self, mock_db, mock_get_token):
        """Test main function when no active configurations exist"""
        # Mock empty Firestore query
        mock_collection = Mock()
        mock_collection.where.return_value.stream.return_value = []
        mock_db.collection.return_value = mock_collection
        
        mock_get_token.return_value = 'test-token'
        
        # Create mock request
        mock_request = Mock()
        
        # Execute main function
        response = main(mock_request)
        
        # Verify response
        self.assertTrue(response['success'])
        self.assertIn('No active configurations', response['message'])
        self.assertEqual(len(response['results']), 0)

    @patch('main.get_telegram_bot_token')
    def test_main_function_token_retrieval_failure(self, mock_get_token):
        """Test main function when token retrieval fails"""
        # Mock token retrieval failure
        mock_get_token.side_effect = Exception('Secret Manager error')
        
        # Create mock request
        mock_request = Mock()
        
        # Execute main function
        response = main(mock_request)
        
        # Verify error response
        self.assertFalse(response['success'])
        self.assertIn('Secret Manager error', response['error'])


class TestIntegrationScenarios(unittest.TestCase):
    """Integration test scenarios for complete workflows"""
    
    @patch('main.requests.post')
    @patch('main.cloudscraper')
    @patch('main.BeautifulSoup')
    @patch('main.secret_client')
    @patch('main.db')
    def test_complete_scraping_and_delivery_flow(self, mock_db, mock_secret_client,
                                                mock_bs, mock_cloudscraper, mock_requests):
        """Test the complete flow from configuration to article delivery"""
        # Set up mocks for the complete flow
        
        # Mock Secret Manager
        mock_secret_response = Mock()
        mock_secret_response.payload.data.decode.return_value = 'test-bot-token'
        mock_secret_client.access_secret_version.return_value = [mock_secret_response]
        
        # Mock Firestore configuration query
        mock_config = {
            'id': 'integration-test-config',
            'name': 'Integration Test',
            'pttBoard': 'Tech_Job',
            'keywords': ['python'],
            'postCount': 3,
            'schedule': {'type': 'hourly'},
            'telegramChatId': '987654321',
            'isActive': True,
            'lastExecuted': datetime.utcnow() - timedelta(hours=2)  # Due for execution
        }
        
        mock_doc = Mock()
        mock_doc.to_dict.return_value = mock_config
        mock_doc.id = 'integration-test-config'
        
        mock_collection = Mock()
        mock_collection.where.return_value.stream.return_value = [mock_doc]
        mock_db.collection.return_value = mock_collection
        
        # Mock PTT scraping
        mock_scraper = Mock()
        mock_response = Mock()
        mock_response.url = 'https://www.ptt.cc/bbs/Tech_Job/index.html'
        mock_response.text = '<html>mock</html>'
        mock_scraper.get.return_value = mock_response
        mock_cloudscraper.create_scraper.return_value = mock_scraper
        
        # Mock article parsing
        mock_soup = Mock()
        mock_entry = Mock()
        mock_title_div = Mock()
        mock_title_link = Mock()
        mock_title_link.text.strip.return_value = '[徵才] Python Developer'
        mock_title_link.__getitem__.return_value = '/bbs/Tech_Job/M.123.A.456.html'
        mock_title_div.find.return_value = mock_title_link
        mock_entry.find.side_effect = lambda class_name: {
            'title': mock_title_div,
            'author': Mock(text=Mock(strip=Mock(return_value='testuser'))),
            'date': Mock(text=Mock(strip=Mock(return_value='12/25')))
        }.get(class_name)
        
        mock_soup.find_all.return_value = [mock_entry]
        mock_bs.return_value = mock_soup
        
        # Mock Telegram API
        mock_telegram_response = Mock()
        mock_telegram_response.json.return_value = {'ok': True}
        mock_telegram_response.raise_for_status.return_value = None
        mock_requests.return_value = mock_telegram_response
        
        # Mock Firestore updates
        mock_document = Mock()
        mock_collection.document.return_value = mock_document
        
        # Execute main function
        mock_request = Mock()
        response = main(mock_request)
        
        # Verify the complete flow executed successfully
        self.assertTrue(response['success'])
        self.assertEqual(len(response['results']), 1)
        self.assertEqual(response['results'][0]['status'], 'success')
        self.assertEqual(response['results'][0]['articles_found'], 1)
        self.assertEqual(response['results'][0]['articles_sent'], 1)
        
        # Verify Telegram message was sent
        mock_requests.assert_called()
        
        # Verify Firestore was updated
        mock_document.update.assert_called()


if __name__ == '__main__':
    # Set up test environment
    os.environ['GOOGLE_CLOUD_PROJECT'] = 'test-project'
    
    # Run tests
    unittest.main(verbosity=2)