import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { CommunicationChannel, TemplateStatus } from '@/generated/client';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { RenderTemplatePreviewDto } from './dto/render-template-preview.dto';

@ApiTags('Communication Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/communication/templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new communication template' })
  async create(@Body() dto: CreateTemplateDto, @Req() req: any) {
    return this.templateService.create(dto, req.user?.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'List communication templates' })
  async findAll(
    @Query('channel') channel?: CommunicationChannel,
    @Query('status') status?: TemplateStatus,
    @Query('search') search?: string,
  ) {
    return this.templateService.findAll({ channel, status, search });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get template by ID' })
  async findOne(@Param('id') id: string) {
    return this.templateService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update a communication template' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: any,
  ) {
    return this.templateService.update(id, dto, req.user?.id);
  }

  @Post('preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Render a template preview with variables' })
  async preview(
    @Body() dto: RenderTemplatePreviewDto,
    @Query('channel') channel?: CommunicationChannel,
  ) {
    return this.templateService.renderPreview(
      dto.templateId,
      dto.code,
      channel,
      dto.variables,
    );
  }
}
