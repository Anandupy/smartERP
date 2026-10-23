import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderType } from '@/generated/client';
import { EmailProvider } from '../interfaces/email-provider.interface';
import { SMSProvider } from '../interfaces/sms-provider.interface';
import { WhatsAppProvider } from '../interfaces/whatsapp-provider.interface';
import { PushProvider } from '../interfaces/push-provider.interface';
import { SmtpEmailProvider } from './smtp/smtp-email.provider';
import { StubSMSProvider } from './stub/stub-sms.provider';
import { AndroidGatewaySmsProvider } from './android-gateway/android-gateway-sms.provider';
import { Fast2SmsProvider } from './fast2sms/fast2sms.provider';
import { TextBeeSmsProvider } from './textbee/textbee-sms.provider';
import { StubWhatsAppProvider } from './stub/stub-whatsapp.provider';
import { StubPushProvider } from './stub/stub-push.provider';

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smtpEmailProvider: SmtpEmailProvider,
    private readonly stubSmsProvider: StubSMSProvider,
    private readonly androidGatewaySmsProvider: AndroidGatewaySmsProvider,
    private readonly fast2SmsProvider: Fast2SmsProvider,
    private readonly textBeeSmsProvider: TextBeeSmsProvider,
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

  getSmsProvider(_providerType?: ProviderType): SMSProvider {
    const textBeeKey =
      this.configService.get<string>('TEXTBEE_API_KEY') ||
      process.env.TEXTBEE_API_KEY;

    if (textBeeKey && textBeeKey.startsWith('txb_')) {
      this.logger.debug(
        '[ProviderFactory] Using TextBee Free Android SMS Provider',
      );
      return this.textBeeSmsProvider;
    }

    const fast2smsKey =
      this.configService.get<string>('FAST2SMS_API_KEY') ||
      process.env.FAST2SMS_API_KEY;

    if (
      fast2smsKey &&
      fast2smsKey.trim() &&
      fast2smsKey !== 'YOUR_FAST2SMS_API_KEY'
    ) {
      this.logger.debug('[ProviderFactory] Using Fast2SMS provider');
      return this.fast2SmsProvider;
    }

    return this.androidGatewaySmsProvider;
  }

  getWhatsappProvider(_providerType?: ProviderType): WhatsAppProvider {
    return this.stubWhatsappProvider;
  }

  getPushProvider(_providerType?: ProviderType): PushProvider {
    return this.stubPushProvider;
  }
}
