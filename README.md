# PTT Telegram Scheduler

Automated PTT article fetcher with Telegram bot integration built with Next.js and Google Cloud Platform.

## Features

- Web-based configuration interface for PTT article fetching
- Scheduled article retrieval with keyword filtering
- Telegram bot integration for article delivery
- Execution history and monitoring dashboard
- Google Cloud Platform integration (Firestore, Secret Manager, Cloud Functions)

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Google Cloud Firestore
- **Authentication**: Google Cloud IAM
- **Deployment**: Google Cloud Run, Cloud Functions
- **Scheduling**: Google Cloud Scheduler

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account with billing enabled
- Telegram Bot Token (create via @BotFather)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`

5. Set up Google Cloud authentication:
   - Create a service account with Firestore and Secret Manager permissions
   - Download the service account key JSON file
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your key file

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key file
- `FIRESTORE_DATABASE_ID`: Firestore database ID (default: "(default)")
- `TELEGRAM_BOT_TOKEN_SECRET_NAME`: Secret Manager secret name for Telegram bot token

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ConfigurationForm.tsx
│   ├── ConfigurationList.tsx
│   ├── Dashboard.tsx
│   └── TaskHistory.tsx
├── lib/                   # Utility libraries
│   ├── firestore.ts       # Firestore client
│   └── secret-manager.ts  # Secret Manager client
└── types/                 # TypeScript type definitions
    └── index.ts
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Deployment

This application is designed to be deployed on Google Cloud Platform:

1. **Cloud Run**: For the Next.js web application
2. **Cloud Functions**: For the PTT scraping and Telegram delivery
3. **Cloud Scheduler**: For triggering scheduled tasks
4. **Firestore**: For data storage
5. **Secret Manager**: For secure token storage

See the deployment documentation for detailed instructions.

## License

ISC