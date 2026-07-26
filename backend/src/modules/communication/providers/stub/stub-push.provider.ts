import { Injectable, Logger } from '@nestjs/common';
import { CommunicationChannel, ProviderType } from '@/generated/client';
import { PushProvider } from '../../interfaces/push-provider.interface';
import {
  ProviderSendResult,
  SendPushOptions,
} from '../../interfaces/provider-result.interface';

@Injectable()
export class StubPushProvider implements PushProvider {
  readonly providerType = ProviderType.CUSTOM;
  private readonly logger = new Logger(StubPushProvider.name);

  async sendPush(options: SendPushOptions): Promise<ProviderSendResult> {
    const startTime = Date.now();
    const targets = Array.isArray(options.targetToken)
      ? options.targetToken.join(',')
      : options.targetToken;
    this.logger.log(
      `[Push Provider Stub] Dispatching Push notification to [${targets}]: "${options.title}"`,
    );

    const messageId = `push-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      messageId,
      provider: this.providerType,
      channel: CommunicationChannel.PUSH,
      latencyMs,
      rawResponse: { multicastId: messageId, successCount: 1 },
    };
  }
}
