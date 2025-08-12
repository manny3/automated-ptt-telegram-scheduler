import { NextRequest, NextResponse } from 'next/server'

// GET /api/executions/[configId] - Get execution history for a configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    // TODO: Implement Firestore query to get execution history
    return NextResponse.json({ executions: [] })
  } catch (error) {
    console.error('Error fetching execution history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch execution history' },
      { status: 500 }
    )
  }
}