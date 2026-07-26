import { ProviderType } from '@/generated/client';
import {
  ProviderSendResult,
  SendSmsOptions,
} from './provider-result.interface';

export abstract class SMSProvider {
  abstract readonly providerType: ProviderType;
  abstract sendSms(options: SendSmsOptions): Promise<ProviderSendResult>;
}
