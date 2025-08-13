# PTT Scraper Cloud Function

This Cloud Function implements the scheduled scraping and delivery system for PTT articles via Telegram Bot. It's designed to be triggered by Cloud Scheduler to automatically fetch articles based on user configurations and deliver them through Telegram.

## Overview

The function performs the following operations:
1. Queries Firestore for active scraping configurations
2. Evaluates which configurations are due for execution based on their schedules
3. Scrapes PTT articles for each due configuration
4. Filters articles by keywords if specified
5. Formats and sends articles via Telegram Bot
6. Logs execution results and updates configuration status in Firestore

## Architecture

```
Cloud Scheduler → Cloud Function → PTT Website
                       ↓
                 Secret Manager (Bot Token)
                       ↓
                 Telegram Bot API
                       ↓
                 Firestore (Logs & Status)
```

## Dependencies

- `functions-framework`: Google Cloud Functions framework
- `google-cloud-firestore`: Firestore database client
- `google-cloud-secret-manager`: Secret Manager client for secure token storage
- `requests`: HTTP client for Telegram API calls
- `cloudscraper`: PTT website scraping with CloudFlare bypass
- `beautifulsoup4`: HTML parsing for article extraction

## Environment Variables

- `GOOGLE_CLOUD_PROJECT`: GCP project ID (automatically set in Cloud Functions)
- `TELEGRAM_BOT_TOKEN_SECRET_NAME`: Name of the secret in Secret Manager containing the Telegram bot token (default: `telegram-bot-token`)

## Configuration Format

The function expects configurations in Firestore with the following structure:

```json
{
  "id": "config-id",
  "name": "Configuration Name",
  "pttBoard": "Tech_Job",
  "keywords": ["python", "backend"],
  "postCount": 20,
  "schedule": {
    "type": "hourly|daily|custom",
    "interval": 60,
    "time": "09:00"
  },
  "telegramChatId": "123456789",
  "isActive": true,
  "lastExecuted": "2024-01-01T00:00:00Z",
  "lastExecutionStatus": "success|error|no_articles",
  "lastExecutionMessage": "Optional status message"
}
```

## Schedule Types

1. **Hourly**: Executes every hour from the last execution
2. **Daily**: Executes once per day at the specified time
3. **Custom**: Executes at custom intervals (in minutes)

## Deployment

### Prerequisites

1. **GCP Project Setup**:
   - Enable Cloud Functions API
   - Enable Firestore API
   - Enable Secret Manager API
   - Set up service account with appropriate permissions

2. **Telegram Bot Setup**:
   - Create a Telegram bot via @BotFather
   - Store the bot token in Secret Manager

3. **Firestore Setup**:
   - Create `configurations` and `executions` collections
   - Set up appropriate security rules

### Deploy the Function

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Set your project ID
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Deploy the function
./deploy.sh
```

### Set up Cloud Scheduler

After deployment, create a Cloud Scheduler job to trigger the function:

```bash
# Create a scheduler job that runs every 15 minutes
gcloud scheduler jobs create http ptt-telegram-scheduler \
    --schedule='*/15 * * * *' \
    --uri='https://REGION-PROJECT_ID.cloudfunctions.net/ptt-scraper' \
    --http-method=POST \
    --location=us-central1
```

## Testing

### Local Testing

Run the simple logic tests:

```bash
python test_simple.py
```

### Integration Testing

For full integration testing (requires Cloud Functions dependencies):

```bash
# Install dependencies
pip install -r requirements.txt

# Run comprehensive tests
python -m unittest test_main.py -v
```

### Manual Testing

You can test the function manually by sending a POST request to the deployed function URL:

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/ptt-scraper
```

## Error Handling

The function implements comprehensive error handling for:

- **PTT Scraping Errors**: Network timeouts, board not found, age verification issues
- **Telegram API Errors**: Invalid chat IDs, rate limiting, message formatting issues
- **Secret Manager Errors**: Token retrieval failures, permission issues
- **Firestore Errors**: Database connection issues, document not found

All errors are logged with appropriate detail levels and retry logic where applicable.

## Monitoring

### Logs

View function logs in Cloud Console:

```bash
gcloud functions logs read ptt-scraper --limit=50
```

### Metrics

Monitor function performance:
- Execution count and duration
- Error rates and types
- Memory and CPU usage
- Cold start frequency

### Alerts

Set up alerts for:
- Function execution failures
- High error rates
- Telegram API rate limiting
- Secret Manager access failures

## Security

### IAM Permissions

The function requires the following IAM roles:
- `roles/datastore.user`: For Firestore read/write access
- `roles/secretmanager.secretAccessor`: For retrieving Telegram bot tokens
- `roles/logging.logWriter`: For writing execution logs

### Secret Management

- Telegram bot tokens are stored securely in Secret Manager
- Tokens are only retrieved at runtime and kept in memory during execution
- No sensitive data is logged or stored in code

### Network Security

- Function uses HTTPS for all external API calls
- Implements proper retry logic with exponential backoff
- Validates all input data before processing

## Troubleshooting

### Common Issues

1. **Function Timeout**: Increase timeout in deployment configuration if processing many configurations
2. **Memory Limits**: Monitor memory usage and increase if needed for large article batches
3. **Rate Limiting**: Telegram API has rate limits; function implements delays between messages
4. **PTT Access**: Some boards require age verification; function handles this automatically

### Debug Mode

Enable debug logging by setting log level in the function:

```python
logging.basicConfig(level=logging.DEBUG)
```

### Performance Optimization

- Function scales automatically based on demand
- Cold starts are minimized through proper resource allocation
- Database queries are optimized with appropriate indexes
- Telegram messages are batched to reduce API calls

## Contributing

When modifying the function:

1. Update tests in `test_main.py`
2. Run local tests with `python test_simple.py`
3. Update this README if adding new features
4. Test deployment in a staging environment first
5. Monitor function performance after deployment

## Support

For issues and questions:
1. Check Cloud Functions logs for error details
2. Verify Firestore configuration and data format
3. Test Telegram bot token and chat ID validity
4. Review Secret Manager permissions and access