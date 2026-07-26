import { Injectable, Logger } from '@nestjs/common';
import { CommunicationChannel, ProviderType } from '@/generated/client';
import { WhatsAppProvider } from '../../interfaces/whatsapp-provider.interface';
import { ProviderSendResult, SendWhatsappOptions } from '../../interfaces/provider-result.interface';

@Injectable()
export class StubWhatsAppProvider implements WhatsAppProvider {
  readonly providerType = ProviderType.CUSTOM;
  private readonly logger = new Logger(StubWhatsAppProvider.name);

  async sendWhatsapp(options: SendWhatsappOptions): Promise<ProviderSendResult> {
    const startTime = Date.now();
    this.logger.log(`[WhatsApp Provider Stub] Dispatching WhatsApp message to [${options.to}]`);

    const messageId = `wa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      messageId,
      provider: this.providerType,
      channel: CommunicationChannel.WHATSAPP,
      latencyMs,
      rawResponse: { status: 'SENT', recipient: options.to },
    };
  }
}
