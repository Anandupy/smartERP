import { ProviderType } from '@/generated/client';
import {
  ProviderSendResult,
  SendEmailOptions,
} from './provider-result.interface';

export abstract class EmailProvider {
  abstract readonly providerType: ProviderType;
  abstract sendEmail(options: SendEmailOptions): Promise<ProviderSendResult>;
  abstract verifyConnection?(): Promise<boolean>;
}
