# Requirements Document

## Introduction

This feature extends the existing ptt-article-finder project to create an automated system that periodically fetches PTT articles and sends them to Telegram users via a bot. The system will provide a web-based configuration interface built with Next.js, allowing users to customize their article fetching preferences including post quantity, keyword filtering, and scheduling. The architecture leverages Google Cloud Platform services for scalability and reliability.

## Requirements

### Requirement 1

**User Story:** As a user, I want to configure article fetching settings through a web interface, so that I can customize what PTT content gets sent to my Telegram.

#### Acceptance Criteria

1. WHEN a user accesses the web interface THEN the system SHALL display a configuration form with fields for post quantity, keywords, and schedule settings
2. WHEN a user sets the post quantity THEN the system SHALL accept values between 1 and 100 posts
3. WHEN a user enters title keywords THEN the system SHALL allow multiple comma-separated keywords for filtering
4. WHEN a user sets a schedule THEN the system SHALL accept time-based configurations (hourly, daily, custom intervals)
5. WHEN a user saves configuration THEN the system SHALL store the settings in Firestore database
6. WHEN configuration is saved successfully THEN the system SHALL display a confirmation message to the user

### Requirement 2

**User Story:** As a user, I want the system to automatically fetch PTT articles based on my schedule, so that I receive timely updates without manual intervention.

#### Acceptance Criteria

1. WHEN the scheduled time arrives THEN Cloud Scheduler SHALL trigger the article fetching process
2. WHEN the fetching process starts THEN the system SHALL query Firestore for active user configurations
3. WHEN fetching articles THEN the system SHALL retrieve the specified number of latest posts from PTT
4. IF keywords are configured THEN the system SHALL filter articles containing those keywords in the title
5. WHEN no articles match the keywords THEN the system SHALL log the event and skip sending
6. WHEN articles are successfully fetched THEN the system SHALL format them for Telegram delivery

### Requirement 3

**User Story:** As a user, I want to receive filtered PTT articles via Telegram bot, so that I can stay updated on topics of interest.

#### Acceptance Criteria

1. WHEN articles are ready for delivery THEN the system SHALL retrieve the Telegram Bot token from Secret Manager
2. WHEN sending to Telegram THEN the system SHALL format each article with title, author, and PTT link
3. WHEN multiple articles are found THEN the system SHALL send them as separate messages or combined based on configuration
4. IF Telegram API fails THEN the system SHALL retry up to 3 times with exponential backoff
5. WHEN delivery is successful THEN the system SHALL log the successful transmission
6. WHEN delivery fails after retries THEN the system SHALL log the error for troubleshooting

### Requirement 4

**User Story:** As a system administrator, I want secure API token management, so that sensitive credentials are protected.

#### Acceptance Criteria

1. WHEN the system needs Telegram Bot tokens THEN it SHALL retrieve them from Google Secret Manager
2. WHEN storing tokens THEN the system SHALL never store them in plain text in code or configuration files
3. WHEN accessing Secret Manager THEN the system SHALL use proper IAM authentication
4. IF Secret Manager access fails THEN the system SHALL log the error and halt the process
5. WHEN tokens are retrieved THEN they SHALL only be kept in memory during execution

### Requirement 5

**User Story:** As a user, I want to manage multiple PTT boards and configurations, so that I can monitor different topics separately.

#### Acceptance Criteria

1. WHEN configuring settings THEN the system SHALL allow users to specify PTT board names
2. WHEN multiple boards are configured THEN the system SHALL fetch articles from each board independently
3. WHEN saving configurations THEN the system SHALL store each board configuration as a separate document
4. WHEN displaying configurations THEN the system SHALL show all active configurations in a list view
5. WHEN editing configurations THEN the system SHALL allow users to modify or delete existing settings
6. WHEN deleting configurations THEN the system SHALL remove the scheduled tasks associated with that configuration

### Requirement 6

**User Story:** As a developer, I want the system to be deployed on Google Cloud Platform, so that it can scale automatically and integrate with other GCP services.

#### Acceptance Criteria

1. WHEN deploying the Next.js application THEN it SHALL be deployed on Cloud Run
2. WHEN the application receives traffic THEN Cloud Run SHALL automatically scale based on demand
3. WHEN storing configuration data THEN the system SHALL use Firestore in Datastore mode
4. WHEN scheduling tasks THEN the system SHALL use Cloud Scheduler for triggering
5. WHEN executing scraping tasks THEN the system SHALL use Cloud Functions
6. WHEN the system is idle THEN Cloud Run SHALL scale down to zero to minimize costs

### Requirement 7

**User Story:** As a user, I want to see the status and history of my scheduled tasks, so that I can monitor the system's performance.

#### Acceptance Criteria

1. WHEN viewing the dashboard THEN the system SHALL display the last execution time for each configuration
2. WHEN tasks are executed THEN the system SHALL update the execution status in Firestore
3. WHEN errors occur THEN the system SHALL log error details with timestamps
4. WHEN viewing task history THEN the system SHALL show the number of articles sent in each execution
5. IF a task fails THEN the system SHALL display the failure reason in the dashboard
6. WHEN tasks are successful THEN the system SHALL show success indicators with article counts