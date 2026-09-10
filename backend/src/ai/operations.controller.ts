import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { OperationDto } from './dto/operation.dto';

@ApiTags('Operations')
@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly aiService: AiService) {}

  @Get(':operationId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get asynchronous operation status and outcome (BE-6-011)' })
  @ApiParam({ name: 'operationId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Operation details retrieved',
    type: OperationDto,
  })
  async getOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('operationId', ParseUUIDPipe) operationId: string,
  ): Promise<OperationDto> {
    return this.aiService.getOperationDetail(user, operationId);
  }
}
