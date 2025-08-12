import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

let secretManagerClient: SecretManagerServiceClient | null = null

export function getSecretManagerClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient()
  }
  return secretManagerClient
}

export async function getSecret(secretName: string): Promise<string> {
  try {
    const client = getSecretManagerClient()
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
    
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set')
    }

    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`
    const [version] = await client.accessSecretVersion({ name })
    
    const payload = version.payload?.data?.toString()
    if (!payload) {
      throw new Error(`Secret ${secretName} is empty or not found`)
    }
    
    return payload
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error)
    throw error
  }
}

export async function getTelegramBotToken(): Promise<string> {
  const secretName = process.env.TELEGRAM_BOT_TOKEN_SECRET_NAME || 'telegram-bot-token'
  return getSecret(secretName)
}