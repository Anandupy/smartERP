import { Injectable, Logger } from '@nestjs/common';
import { CommunicationChannel, ProviderType } from '@/generated/client';
import { SMSProvider } from '../../interfaces/sms-provider.interface';
import { ProviderSendResult, SendSmsOptions } from '../../interfaces/provider-result.interface';

@Injectable()
export class StubSMSProvider implements SMSProvider {
  readonly providerType = ProviderType.CUSTOM;
  private readonly logger = new Logger(StubSMSProvider.name);

  async sendSms(options: SendSmsOptions): Promise<ProviderSendResult> {
    const startTime = Date.now();
    this.logger.log(`[SMS Provider Stub] Dispatching SMS to [${options.to}]: "${options.message}"`);

    const messageId = `sms-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      messageId,
      provider: this.providerType,
      channel: CommunicationChannel.SMS,
      latencyMs,
      rawResponse: { status: 'DELIVERED', destination: options.to },
    };
  }
}
