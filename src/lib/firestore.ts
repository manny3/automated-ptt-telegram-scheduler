import { Firestore } from '@google-cloud/firestore'

let firestoreInstance: Firestore | null = null

export function getFirestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    })
  }
  return firestoreInstance
}

// Collection names
export const COLLECTIONS = {
  CONFIGURATIONS: 'configurations',
  EXECUTIONS: 'executions',
} as const

// Helper function to convert Firestore timestamp to Date
export function firestoreTimestampToDate(timestamp: any): Date {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp)
  }
  return new Date()
}