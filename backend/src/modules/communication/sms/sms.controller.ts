import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { ProviderFactory } from '../providers/provider.factory';
import { SendTestSmsDto } from './dto/send-test-sms.dto';
import { DeliveryLogService } from '../delivery-log/delivery-log.service';
import { CommunicationChannel, DeliveryStatus } from '@/generated/client';

@ApiTags('SMS Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('communication/sms')
export class SmsController {
  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly deliveryLogService: DeliveryLogService,
  ) {}

  @Post('test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Send a test SMS via the Free Android SIM Gateway' })
  async sendTestSms(@Body() dto: SendTestSmsDto) {
    const smsProvider = this.providerFactory.getSmsProvider();
    const result = await smsProvider.sendSms({
      to: dto.to,
      message: dto.message,
    });

    await this.deliveryLogService.logDelivery({
      channel: CommunicationChannel.SMS,
      provider: result.provider,
      recipient: dto.to,
      subject: 'Test SMS Dispatch',
      status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
      latencyMs: result.latencyMs,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      metadata: { test: true, raw: result.rawResponse },
    });

    return {
      success: result.success,
      messageId: result.messageId,
      recipient: dto.to,
      latencyMs: result.latencyMs,
      provider: result.provider,
      details: result.rawResponse,
    };
  }
}
