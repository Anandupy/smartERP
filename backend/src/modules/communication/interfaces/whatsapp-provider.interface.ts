import { ProviderType } from '@/generated/client';
import { ProviderSendResult, SendWhatsappOptions } from './provider-result.interface';

export abstract class WhatsAppProvider {
  abstract readonly providerType: ProviderType;
  abstract sendWhatsapp(options: SendWhatsappOptions): Promise<ProviderSendResult>;
}
