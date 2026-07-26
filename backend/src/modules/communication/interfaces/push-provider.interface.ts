import { ProviderType } from '@/generated/client';
import { ProviderSendResult, SendPushOptions } from './provider-result.interface';

export abstract class PushProvider {
  abstract readonly providerType: ProviderType;
  abstract sendPush(options: SendPushOptions): Promise<ProviderSendResult>;
}
