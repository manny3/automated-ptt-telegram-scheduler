import {
  Firestore,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
} from "@google-cloud/firestore";
import {
  ScrapingConfiguration,
  CreateConfigurationRequest,
  UpdateConfigurationRequest,
  ExecutionResult,
} from "@/types";

let firestoreInstance: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
    });
  }
  return firestoreInstance;
}

// Export the db instance for direct use in API routes
export const db = getFirestore();

// Collection names
export const COLLECTIONS = {
  CONFIGURATIONS: "configurations",
  EXECUTIONS: "executions",
} as const;

// Helper function to convert Firestore timestamp to Date
export function firestoreTimestampToDate(timestamp: any): Date {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  }
  return new Date();
}

// Helper function to convert Firestore document to ScrapingConfiguration
function documentToConfiguration(
  doc: DocumentSnapshot
): ScrapingConfiguration | null {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name,
    pttBoard: data.pttBoard,
    keywords: data.keywords || [],
    postCount: data.postCount,
    schedule: data.schedule,
    telegramChatId: data.telegramChatId,
    isActive: data.isActive ?? true,
    createdAt: firestoreTimestampToDate(data.createdAt),
    updatedAt: firestoreTimestampToDate(data.updatedAt),
    lastExecuted: data.lastExecuted
      ? firestoreTimestampToDate(data.lastExecuted)
      : undefined,
    lastExecutionStatus: data.lastExecutionStatus,
    lastExecutionMessage: data.lastExecutionMessage,
  };
}

// Helper function to convert Firestore document to ExecutionResult
function documentToExecution(doc: DocumentSnapshot): ExecutionResult | null {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    configurationId: data.configurationId,
    executedAt: firestoreTimestampToDate(data.executedAt),
    status: data.status,
    articlesFound: data.articlesFound || 0,
    articlesSent: data.articlesSent || 0,
    errorMessage: data.errorMessage,
    executionDuration: data.executionDuration || 0,
  };
}

// Configuration CRUD Operations

/**
 * Create a new scraping configuration
 */
export async function createConfiguration(
  configData: CreateConfigurationRequest
): Promise<ScrapingConfiguration> {
  const db = getFirestore();
  const now = new Date();

  const docData = {
    ...configData,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = await db.collection(COLLECTIONS.CONFIGURATIONS).add(docData);
    const doc = await docRef.get();
    const configuration = documentToConfiguration(doc);

    if (!configuration) {
      throw new Error("Failed to create configuration");
    }

    return configuration;
  } catch (error) {
    console.error("Error creating configuration:", error);
    throw new Error("Failed to create configuration");
  }
}

/**
 * Get all configurations
 */
export async function getAllConfigurations(): Promise<ScrapingConfiguration[]> {
  const db = getFirestore();

  try {
    const snapshot = await db
      .collection(COLLECTIONS.CONFIGURATIONS)
      .orderBy("createdAt", "desc")
      .get();

    const configurations: ScrapingConfiguration[] = [];
    snapshot.forEach((doc) => {
      const config = documentToConfiguration(doc);
      if (config) {
        configurations.push(config);
      }
    });

    return configurations;
  } catch (error) {
    console.error("Error getting configurations:", error);
    throw new Error("Failed to get configurations");
  }
}

/**
 * Get active configurations (for scheduler)
 */
export async function getActiveConfigurations(): Promise<
  ScrapingConfiguration[]
> {
  const db = getFirestore();

  try {
    const snapshot = await db
      .collection(COLLECTIONS.CONFIGURATIONS)
      .where("isActive", "==", true)
      .get();

    const configurations: ScrapingConfiguration[] = [];
    snapshot.forEach((doc) => {
      const config = documentToConfiguration(doc);
      if (config) {
        configurations.push(config);
      }
    });

    return configurations;
  } catch (error) {
    console.error("Error getting active configurations:", error);
    throw new Error("Failed to get active configurations");
  }
}

/**
 * Get a single configuration by ID
 */
export async function getConfigurationById(
  id: string
): Promise<ScrapingConfiguration | null> {
  const db = getFirestore();

  try {
    const doc = await db.collection(COLLECTIONS.CONFIGURATIONS).doc(id).get();
    return documentToConfiguration(doc);
  } catch (error) {
    console.error("Error getting configuration:", error);
    throw new Error("Failed to get configuration");
  }
}

/**
 * Update an existing configuration
 */
export async function updateConfiguration(
  id: string,
  updateData: UpdateConfigurationRequest
): Promise<ScrapingConfiguration> {
  const db = getFirestore();
  const now = new Date();

  const docData = {
    ...updateData,
    updatedAt: now,
  };

  try {
    const docRef = db.collection(COLLECTIONS.CONFIGURATIONS).doc(id);
    await docRef.update(docData);

    const doc = await docRef.get();
    const configuration = documentToConfiguration(doc);

    if (!configuration) {
      throw new Error("Configuration not found after update");
    }

    return configuration;
  } catch (error) {
    console.error("Error updating configuration:", error);
    throw new Error("Failed to update configuration");
  }
}

/**
 * Delete a configuration
 */
export async function deleteConfiguration(id: string): Promise<void> {
  const db = getFirestore();

  try {
    await db.collection(COLLECTIONS.CONFIGURATIONS).doc(id).delete();
  } catch (error) {
    console.error("Error deleting configuration:", error);
    throw new Error("Failed to delete configuration");
  }
}

/**
 * Update configuration execution status
 */
export async function updateConfigurationStatus(
  id: string,
  status: "success" | "error" | "no_articles",
  message?: string
): Promise<void> {
  const db = getFirestore();
  const now = new Date();

  try {
    await db
      .collection(COLLECTIONS.CONFIGURATIONS)
      .doc(id)
      .update({
        lastExecuted: now,
        lastExecutionStatus: status,
        lastExecutionMessage: message || null,
        updatedAt: now,
      });
  } catch (error) {
    console.error("Error updating configuration status:", error);
    throw new Error("Failed to update configuration status");
  }
}

// Execution History Operations

/**
 * Create a new execution record
 */
export async function createExecution(
  configurationId: string,
  status: "success" | "error" | "no_articles",
  articlesFound: number = 0,
  articlesSent: number = 0,
  executionDuration: number = 0,
  errorMessage?: string
): Promise<ExecutionResult> {
  const db = getFirestore();
  const now = new Date();

  const docData = {
    configurationId,
    executedAt: now,
    status,
    articlesFound,
    articlesSent,
    executionDuration,
    errorMessage: errorMessage || null,
  };

  try {
    const docRef = await db.collection(COLLECTIONS.EXECUTIONS).add(docData);
    const doc = await docRef.get();
    const execution = documentToExecution(doc);

    if (!execution) {
      throw new Error("Failed to create execution record");
    }

    return execution;
  } catch (error) {
    console.error("Error creating execution record:", error);
    throw new Error("Failed to create execution record");
  }
}

/**
 * Get execution history for a specific configuration
 */
export async function getExecutionHistory(
  configurationId: string,
  limit: number = 50
): Promise<ExecutionResult[]> {
  const db = getFirestore();

  try {
    const snapshot = await db
      .collection(COLLECTIONS.EXECUTIONS)
      .where("configurationId", "==", configurationId)
      .orderBy("executedAt", "desc")
      .limit(limit)
      .get();

    const executions: ExecutionResult[] = [];
    snapshot.forEach((doc) => {
      const execution = documentToExecution(doc);
      if (execution) {
        executions.push(execution);
      }
    });

    return executions;
  } catch (error) {
    console.error("Error getting execution history:", error);
    throw new Error("Failed to get execution history");
  }
}

/**
 * Get recent executions across all configurations
 */
export async function getRecentExecutions(
  limit: number = 100
): Promise<ExecutionResult[]> {
  const db = getFirestore();

  try {
    const snapshot = await db
      .collection(COLLECTIONS.EXECUTIONS)
      .orderBy("executedAt", "desc")
      .limit(limit)
      .get();

    const executions: ExecutionResult[] = [];
    snapshot.forEach((doc) => {
      const execution = documentToExecution(doc);
      if (execution) {
        executions.push(execution);
      }
    });

    return executions;
  } catch (error) {
    console.error("Error getting recent executions:", error);
    throw new Error("Failed to get recent executions");
  }
}

/**
 * Get execution statistics for a configuration
 */
export async function getExecutionStats(configurationId: string): Promise<{
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalArticlesSent: number;
  lastExecution?: ExecutionResult;
}> {
  const db = getFirestore();

  try {
    const snapshot = await db
      .collection(COLLECTIONS.EXECUTIONS)
      .where("configurationId", "==", configurationId)
      .orderBy("executedAt", "desc")
      .get();

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalArticlesSent = 0;
    let lastExecution: ExecutionResult | undefined;

    snapshot.forEach((doc, index) => {
      const execution = documentToExecution(doc);
      if (execution) {
        totalExecutions++;
        totalArticlesSent += execution.articlesSent;

        if (execution.status === "success") {
          successfulExecutions++;
        } else if (execution.status === "error") {
          failedExecutions++;
        }

        if (index === 0) {
          lastExecution = execution;
        }
      }
    });

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      totalArticlesSent,
      lastExecution,
    };
  } catch (error) {
    console.error("Error getting execution stats:", error);
    throw new Error("Failed to get execution statistics");
  }
}

/**
 * Clean up old execution records (keep last 1000 per configuration)
 */
export async function cleanupOldExecutions(): Promise<void> {
  const db = getFirestore();

  try {
    // Get all configurations
    const configsSnapshot = await db
      .collection(COLLECTIONS.CONFIGURATIONS)
      .get();

    for (const configDoc of configsSnapshot.docs) {
      const configId = configDoc.id;

      // Get executions for this config, ordered by date (oldest first)
      const executionsSnapshot = await db
        .collection(COLLECTIONS.EXECUTIONS)
        .where("configurationId", "==", configId)
        .orderBy("executedAt", "asc")
        .get();

      // If more than 1000 executions, delete the oldest ones
      if (executionsSnapshot.size > 1000) {
        const toDelete = executionsSnapshot.docs.slice(
          0,
          executionsSnapshot.size - 1000
        );
        const batch = db.batch();

        toDelete.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(
          `Cleaned up ${toDelete.length} old executions for config ${configId}`
        );
      }
    }
  } catch (error) {
    console.error("Error cleaning up old executions:", error);
    throw new Error("Failed to cleanup old executions");
  }
}
