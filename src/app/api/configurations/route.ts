import { NextRequest, NextResponse } from 'next/server'
import { getAllConfigurations, createConfiguration } from '@/lib/firestore'
import { validateCreateConfiguration } from '@/lib/validation'
import { CreateConfigurationRequest, ApiResponse, ConfigurationListResponse } from '@/types'

// GET /api/configurations - List all configurations
export async function GET(): Promise<NextResponse<ConfigurationListResponse>> {
  try {
    const configurations = await getAllConfigurations()
    
    return NextResponse.json({
      success: true,
      data: { configurations },
      message: 'Configurations retrieved successfully'
    })
  } catch (error) {
    console.error('Error fetching configurations:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch configurations',
        message: 'An error occurred while retrieving configurations'
      },
      { status: 500 }
    )
  }
}

// POST /api/configurations - Create new configuration
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json()
    
    // Validate input
    const validation = validateCreateConfiguration(body)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          message: 'Invalid input data',
          data: { errors: validation.errors }
        },
        { status: 400 }
      )
    }

    // Create configuration
    const configData: CreateConfigurationRequest = {
      name: body.name.trim(),
      pttBoard: body.pttBoard.trim(),
      keywords: body.keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0),
      postCount: body.postCount,
      schedule: body.schedule,
      telegramChatId: body.telegramChatId.trim()
    }

    const configuration = await createConfiguration(configData)
    
    return NextResponse.json({
      success: true,
      data: { configuration },
      message: 'Configuration created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create configuration',
        message: 'An error occurred while creating the configuration'
      },
      { status: 500 }
    )
  }
}