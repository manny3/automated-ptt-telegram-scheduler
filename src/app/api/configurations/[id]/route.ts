import { NextRequest, NextResponse } from 'next/server'
import { 
  getConfigurationById, 
  updateConfiguration, 
  deleteConfiguration 
} from '@/lib/firestore'
import { validateUpdateConfiguration, validateConfigurationId } from '@/lib/validation'
import { UpdateConfigurationRequest, ApiResponse } from '@/types'

// GET /api/configurations/[id] - Get single configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = await params
    
    // Validate ID
    const idValidation = validateConfigurationId(id)
    if (!idValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration ID',
          message: 'The provided configuration ID is not valid',
          data: { errors: idValidation.errors }
        },
        { status: 400 }
      )
    }

    const configuration = await getConfigurationById(id)
    
    if (!configuration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration not found',
          message: 'No configuration found with the provided ID'
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: { configuration },
      message: 'Configuration retrieved successfully'
    })
  } catch (error) {
    console.error('Error fetching configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch configuration',
        message: 'An error occurred while retrieving the configuration'
      },
      { status: 500 }
    )
  }
}

// PUT /api/configurations/[id] - Update existing configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json()
    const { id } = await params
    
    // Validate ID
    const idValidation = validateConfigurationId(id)
    if (!idValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration ID',
          message: 'The provided configuration ID is not valid',
          data: { errors: idValidation.errors }
        },
        { status: 400 }
      )
    }

    // Validate input
    const validation = validateUpdateConfiguration(body)
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

    // Check if configuration exists
    const existingConfig = await getConfigurationById(id)
    if (!existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration not found',
          message: 'No configuration found with the provided ID'
        },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: UpdateConfigurationRequest = {}
    
    if (body.name !== undefined) {
      updateData.name = body.name.trim()
    }
    if (body.pttBoard !== undefined) {
      updateData.pttBoard = body.pttBoard.trim()
    }
    if (body.keywords !== undefined) {
      updateData.keywords = body.keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0)
    }
    if (body.postCount !== undefined) {
      updateData.postCount = body.postCount
    }
    if (body.schedule !== undefined) {
      updateData.schedule = body.schedule
    }
    if (body.telegramChatId !== undefined) {
      updateData.telegramChatId = body.telegramChatId.trim()
    }
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
    }

    const updatedConfiguration = await updateConfiguration(id, updateData)
    
    return NextResponse.json({
      success: true,
      data: { configuration: updatedConfiguration },
      message: 'Configuration updated successfully'
    })
  } catch (error) {
    console.error('Error updating configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update configuration',
        message: 'An error occurred while updating the configuration'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/configurations/[id] - Delete configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = await params
    
    // Validate ID
    const idValidation = validateConfigurationId(id)
    if (!idValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration ID',
          message: 'The provided configuration ID is not valid',
          data: { errors: idValidation.errors }
        },
        { status: 400 }
      )
    }

    // Check if configuration exists
    const existingConfig = await getConfigurationById(id)
    if (!existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration not found',
          message: 'No configuration found with the provided ID'
        },
        { status: 404 }
      )
    }

    await deleteConfiguration(id)
    
    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete configuration',
        message: 'An error occurred while deleting the configuration'
      },
      { status: 500 }
    )
  }
}