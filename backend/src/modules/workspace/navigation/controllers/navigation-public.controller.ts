import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RoleType } from '@/generated/client';
import { NavigationService } from '../services/navigation.service';
import {
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { NavigationTreeDto } from '../dto/navigation-response.dto';

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
  @ApiOkEnvelope(NavigationTreeDto, {
    message: 'User navigation tree resolved successfully',
  })
  @ApiStandardErrors()
  async getUserNavigation(): Promise<{
    data: NavigationTreeDto;
    message: string;
  }> {
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
