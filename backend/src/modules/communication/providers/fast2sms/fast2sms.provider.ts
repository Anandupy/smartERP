import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationChannel, ProviderType } from '@/generated/client';
import { SMSProvider } from '../../interfaces/sms-provider.interface';
import {
  ProviderSendResult,
  SendSmsOptions,
} from '../../interfaces/provider-result.interface';

/**
 * Fast2SMS Provider for Indian Mobile Numbers (+91)
 *
 * Fast2SMS provides instant direct SMS dispatch to Indian phones
 * via Quick SMS route (route 'q') without mandatory upfront DLT registration
 * for testing and dev accounts.
 *
 * Requirements:
 * - FAST2SMS_API_KEY in backend/.env
 * (Get free API key by signing up at https://www.fast2sms.com)
 */
@Injectable()
export class Fast2SmsProvider implements SMSProvider {
  readonly providerType = ProviderType.CUSTOM;
  private readonly logger = new Logger(Fast2SmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendSms(options: SendSmsOptions): Promise<ProviderSendResult> {
    const startTime = Date.now();
    const apiKey =
      this.configService.get<string>('FAST2SMS_API_KEY') ||
      process.env.FAST2SMS_API_KEY;

    // Fast2SMS expects 10-digit Indian numbers (without +91 prefix)
    const cleanNumber = options.to.replace(/\D/g, '').slice(-10);

    this.logger.log(
      `[Fast2SMS] Preparing SMS delivery to Indian number: ${cleanNumber}`,
    );

    if (apiKey && apiKey.trim() && apiKey !== 'YOUR_FAST2SMS_API_KEY') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: apiKey.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q', // Quick SMS route (immediate text delivery)
            message: options.message,
            language: 'english',
            flash: 0,
            numbers: cleanNumber,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const data = (await response.json().catch(() => null)) as {
          return?: boolean;
          request_id?: string;
          message?: string | string[];
        } | null;

        if (response.ok && data && data.return === true) {
          const requestId = data.request_id || `f2s-${Date.now()}`;
          this.logger.log(
            `[Fast2SMS] Physical SMS successfully sent to ${cleanNumber}! Request ID: ${requestId} (${latencyMs}ms)`,
          );

          return {
            success: true,
            messageId: String(requestId),
            provider: this.providerType,
            channel: CommunicationChannel.SMS,
            latencyMs,
            rawResponse: data,
          };
        } else {
          const errorMsg =
            (Array.isArray(data?.message)
              ? data.message.join(', ')
              : data?.message) || 'Unknown Fast2SMS error';
          this.logger.error(
            `[Fast2SMS] Delivery failed for ${cleanNumber}: ${errorMsg}`,
          );

          return {
            success: false,
            provider: this.providerType,
            channel: CommunicationChannel.SMS,
            latencyMs,
            errorCode: 'FAST2SMS_DELIVERY_FAILED',
            errorMessage: errorMsg,
            rawResponse: data,
          };
        }
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[Fast2SMS] Network connection error: ${errMsg}`);

        return {
          success: false,
          provider: this.providerType,
          channel: CommunicationChannel.SMS,
          latencyMs,
          errorCode: 'NETWORK_ERROR',
          errorMessage: errMsg,
        };
      }
    }

    // Fallback if API key is not yet set in .env
    const latencyMs = Date.now() - startTime;
    const messageId = `sim-f2s-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.logger.warn(
      `[Fast2SMS] FAST2SMS_API_KEY is not configured in backend/.env. Simulated SMS to ${cleanNumber}: "${options.message}"`,
    );

    return {
      success: true,
      messageId,
      provider: this.providerType,
      channel: CommunicationChannel.SMS,
      latencyMs,
      rawResponse: {
        status: 'SIMULATED_PENDING_API_KEY',
        destination: cleanNumber,
        instructions:
          'Sign up at https://www.fast2sms.com (free 1-min signup), copy your Dev API key into backend/.env as FAST2SMS_API_KEY, and real physical SMS will reach your phone!',
      },
    };
  }
}
