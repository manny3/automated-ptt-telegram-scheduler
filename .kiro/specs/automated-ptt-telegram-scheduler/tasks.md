# Implementation Plan

- [x] 1. Set up Next.js project structure and core dependencies
  - Create Next.js project with TypeScript configuration
  - Install required dependencies: @google-cloud/firestore, @google-cloud/secret-manager, tailwindcss
  - Set up project directory structure for components, pages, and API routes
  - Configure environment variables and GCP service account authentication
  - _Requirements: 1.1, 6.1, 6.3_

- [x] 2. Implement Firestore database models and utilities
  - Create TypeScript interfaces for ScrapingConfiguration and ExecutionResult data models
  - Implement Firestore connection utilities and database client initialization
  - Create CRUD operations for configurations collection (create, read, update, delete)
  - Create operations for executions collection to store task history
  - Write unit tests for database operations with mock Firestore
  - _Requirements: 1.5, 5.3, 7.2_

- [x] 3. Build configuration management API routes
  - Implement POST /api/configurations endpoint to create new scraping configurations
  - Implement GET /api/configurations endpoint to list all active configurations
  - Implement PUT /api/configurations/[id] endpoint to update existing configurations
  - Implement DELETE /api/configurations/[id] endpoint to remove configurations
  - Add input validation for post count (1-100), keywords array, and schedule formats
  - Write unit tests for all API endpoints with mock database operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.4, 5.5_

- [x] 4. Create configuration form UI components
  - Build ConfigurationForm component with form fields for name, PTT board, keywords, post count
  - Implement schedule configuration UI with options for hourly, daily, and custom intervals
  - Add Telegram chat ID input field with validation
  - Implement form validation with error messages and success confirmations
  - Create responsive design using Tailwind CSS
  - Write component tests for form interactions and validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 5. Build configuration list and dashboard components
  - Create ConfigurationList component to display all active configurations in a table
  - Implement Dashboard component showing execution status and last run times
  - Add edit and delete functionality for existing configurations
  - Display execution history with success/error indicators and article counts
  - Implement real-time status updates using client-side data fetching
  - Write component tests for list operations and status display
  - _Requirements: 5.4, 5.5, 7.1, 7.5, 7.6_

- [ ] 6. Extract and adapt PTT scraping logic from existing project
  - Copy search_ptt_posts method from ptt-article-finder/main.py
  - Adapt cloudscraper configuration for Cloud Functions environment
  - Implement PTTArticle dataclass and article filtering by keywords
  - Add 18+ age verification handling using existing logic
  - Implement retry logic with exponential backoff for PTT access failures
  - Write unit tests for PTT scraping with mock responses
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 7. Implement Telegram Bot integration
  - Create TelegramBot class with send_message and send_article_batch methods
  - Implement article formatting for Telegram messages with title, author, and PTT link
  - Add message splitting logic for long content and multiple articles
  - Implement retry logic with exponential backoff for Telegram API failures
  - Add error handling for invalid chat IDs and rate limiting
  - Write unit tests for Telegram integration with mock API responses
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 8. Build Cloud Function for scheduled scraping tasks
  - Create main Cloud Function entry point that queries Firestore for active configurations
  - Implement execute_scraping_job function that processes individual configurations
  - Integrate PTT scraping logic with Telegram delivery in the function
  - Add Secret Manager integration to retrieve Telegram Bot tokens securely
  - Implement execution logging and status updates to Firestore executions collection
  - Write integration tests for the complete scraping and delivery flow
  - _Requirements: 2.1, 2.2, 4.1, 4.3, 4.4, 7.2, 7.3_

- [ ] 9. Set up Secret Manager for secure token storage
  - Create Secret Manager secret for Telegram Bot token storage
  - Implement secure token retrieval in Cloud Function using proper IAM authentication
  - Add error handling for Secret Manager access failures
  - Ensure tokens are only kept in memory during execution
  - Write tests for secret retrieval with mock Secret Manager responses
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Configure Cloud Scheduler for periodic task execution
  - Create Cloud Scheduler job to trigger Cloud Function every 15 minutes
  - Configure job to call Cloud Function HTTP endpoint with empty payload
  - Set up proper IAM permissions for Cloud Scheduler to invoke Cloud Function
  - Implement schedule evaluation logic in Cloud Function to determine due configurations
  - Add logging for scheduler triggers and execution timing
  - _Requirements: 2.1, 6.4_

- [ ] 11. Create deployment configurations and Docker setup
  - Create Dockerfile for Next.js application with multi-stage build
  - Configure Cloud Run deployment with proper resource limits and scaling settings
  - Set up Cloud Function deployment configuration with Python runtime
  - Create deployment scripts for both Cloud Run and Cloud Functions
  - Configure environment variables and service account permissions
  - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [ ] 12. Implement comprehensive error handling and logging
  - Add structured logging throughout Next.js application and Cloud Function
  - Implement error boundaries in React components for graceful error handling
  - Add database error handling with retry logic for Firestore operations
  - Implement proper error responses in API routes with appropriate HTTP status codes
  - Add monitoring and alerting for critical failures
  - Write tests for error scenarios and recovery mechanisms
  - _Requirements: 2.5, 3.5, 3.6, 7.3, 7.5_

- [ ] 13. Set up execution history and monitoring dashboard
  - Implement GET /api/executions/[configId] endpoint to retrieve execution history
  - Create TaskHistory component to display detailed execution logs
  - Add execution metrics display including articles found, sent, and error messages
  - Implement filtering and pagination for execution history
  - Add real-time status indicators and last execution timestamps
  - Write tests for execution history retrieval and display
  - _Requirements: 7.1, 7.4, 7.5, 7.6_

- [ ] 14. Write comprehensive test suite and documentation
  - Create end-to-end tests for complete user workflows from configuration to delivery
  - Implement integration tests for PTT scraping, Telegram delivery, and database operations
  - Add performance tests for multiple configurations and concurrent executions
  - Write API documentation for all endpoints with request/response examples
  - Create user guide for configuration setup and troubleshooting
  - Set up automated testing pipeline for continuous integration
  - _Requirements: All requirements validation_