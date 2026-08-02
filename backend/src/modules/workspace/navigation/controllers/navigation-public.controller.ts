import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RoleType } from '@/generated/client';
import { NavigationService } from '../services/navigation.service';

@ApiTags('Workspace - Navigation')
@ApiBearerAuth()
@Controller('workspace/navigation')
export class NavigationPublicController {
  constructor(
    private readonly navigationService: NavigationService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get user navigation tree',
    description:
      'Resolves active module navigation tree filtered by user role and effective permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'User navigation tree resolved successfully',
  })
  async getUserNavigation(): Promise<{ data: any; message: string }> {
    const context = this.requestContext.getContext();
    const userId = context?.userId || '';
    const role = (context?.role as RoleType) || RoleType.STUDENT;

    const data = await this.navigationService.resolveUserNavigation(
      userId,
      role,
    );

    return {
      data,
      message: 'User navigation tree resolved successfully',
    };
  }
}
