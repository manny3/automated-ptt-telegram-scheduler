#!/bin/bash

# Deployment script for PTT Scraper Cloud Function
# This script deploys the Cloud Function with proper configuration

set -e

# Configuration
FUNCTION_NAME="ptt-scraper"
REGION="us-central1"
RUNTIME="python39"
ENTRY_POINT="main"
MEMORY="512MB"
TIMEOUT="540s"
MAX_INSTANCES="10"

# Environment variables
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
TELEGRAM_BOT_TOKEN_SECRET_NAME=${TELEGRAM_BOT_TOKEN_SECRET_NAME:-"telegram-bot-token"}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GOOGLE_CLOUD_PROJECT environment variable is not set"
    echo "Please set it or configure gcloud: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Deploying PTT Scraper Cloud Function..."
echo "Project ID: $PROJECT_ID"
echo "Function Name: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Runtime: $RUNTIME"

# Deploy the function
gcloud functions deploy $FUNCTION_NAME \
    --runtime $RUNTIME \
    --trigger-http \
    --entry-point $ENTRY_POINT \
    --memory $MEMORY \
    --timeout $TIMEOUT \
    --max-instances $MAX_INSTANCES \
    --region $REGION \
    --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,TELEGRAM_BOT_TOKEN_SECRET_NAME=$TELEGRAM_BOT_TOKEN_SECRET_NAME \
    --allow-unauthenticated \
    --source .

echo "Cloud Function deployed successfully!"

# Get the function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format="value(httpsTrigger.url)")
echo "Function URL: $FUNCTION_URL"

echo ""
echo "Next steps:"
echo "1. Create a Cloud Scheduler job to trigger this function periodically"
echo "2. Set up the Telegram bot token in Secret Manager"
echo "3. Configure Firestore security rules"
echo ""
echo "Example Cloud Scheduler command:"
echo "gcloud scheduler jobs create http ptt-telegram-scheduler \\"
echo "    --schedule='*/15 * * * *' \\"
echo "    --uri='$FUNCTION_URL' \\"
echo "    --http-method=POST \\"
echo "    --location=$REGION"