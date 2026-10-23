import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@/generated/client';
import { EmailProvider } from '../interfaces/email-provider.interface';
import { SMSProvider } from '../interfaces/sms-provider.interface';
import { WhatsAppProvider } from '../interfaces/whatsapp-provider.interface';
import { PushProvider } from '../interfaces/push-provider.interface';
import { SmtpEmailProvider } from './smtp/smtp-email.provider';
import { StubSMSProvider } from './stub/stub-sms.provider';
import { AndroidGatewaySmsProvider } from './android-gateway/android-gateway-sms.provider';
import { StubWhatsAppProvider } from './stub/stub-whatsapp.provider';
import { StubPushProvider } from './stub/stub-push.provider';

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);

  constructor(
    private readonly smtpEmailProvider: SmtpEmailProvider,
    private readonly stubSmsProvider: StubSMSProvider,
    private readonly androidGatewaySmsProvider: AndroidGatewaySmsProvider,
    private readonly stubWhatsappProvider: StubWhatsAppProvider,
    private readonly stubPushProvider: StubPushProvider,
  ) {}

  getEmailProvider(providerType?: ProviderType): EmailProvider {
    switch (providerType) {
      case ProviderType.SMTP:
      default:
        return this.smtpEmailProvider;
    }
  }

  getSmsProvider(providerType?: ProviderType): SMSProvider {
    switch (providerType) {
      case ProviderType.CUSTOM:
        return this.androidGatewaySmsProvider;
      default:
        return this.androidGatewaySmsProvider;
    }
  }

  getWhatsappProvider(_providerType?: ProviderType): WhatsAppProvider {
    return this.stubWhatsappProvider;
  }

  getPushProvider(_providerType?: ProviderType): PushProvider {
    return this.stubPushProvider;
  }
}
