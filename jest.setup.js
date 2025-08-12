// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock environment variables for tests
process.env.GOOGLE_CLOUD_PROJECT = 'test-project'
process.env.FIRESTORE_DATABASE_ID = '(default)'