import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationChannel, ProviderType } from '@/generated/client';
import { SMSProvider } from '../../interfaces/sms-provider.interface';
import {
  ProviderSendResult,
  SendSmsOptions,
} from '../../interfaces/provider-result.interface';

/**
 * TextBee Free Android SMS Gateway Provider
 *
 * Routes SMS messages through user's Android phone using TextBee's
 * cloud API (https://api.textbee.dev/api/v1/gateway/send-sms).
 *
 * Benefits:
 * - 100% Free: Uses SIM's daily SMS quota (Jio/Airtel 100 SMS/day).
 * - Real physical SMS delivered to any Indian number (+91).
 * - Works anywhere (cloud-managed, no local WiFi LAN restriction).
 */
@Injectable()
export class TextBeeSmsProvider implements SMSProvider {
  readonly providerType = ProviderType.CUSTOM;
  private readonly logger = new Logger(TextBeeSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendSms(options: SendSmsOptions): Promise<ProviderSendResult> {
    const startTime = Date.now();
    const apiKey =
      this.configService.get<string>('TEXTBEE_API_KEY') ||
      process.env.TEXTBEE_API_KEY;
    const deviceId =
      this.configService.get<string>('TEXTBEE_DEVICE_ID') ||
      process.env.TEXTBEE_DEVICE_ID;

    // Ensure E.164 formatted number (+91XXXXXXXXXX)
    const rawDigits = options.to.replace(/\D/g, '').slice(-10);
    const formattedRecipient = `+91${rawDigits}`;

    this.logger.log(
      `[TextBee SMS] Preparing physical dispatch to ${formattedRecipient}: "${options.message}" (device: ${deviceId || 'default'})`,
    );

    if (apiKey && apiKey.trim() && apiKey.startsWith('txb_')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const payload: Record<string, any> = {
          recipients: [formattedRecipient],
          message: options.message,
        };
        if (deviceId && deviceId.trim()) {
          payload.deviceId = deviceId.trim();
        }

        const response = await fetch(
          'https://api.textbee.dev/api/v1/gateway/send-sms',
          {
            method: 'POST',
            headers: {
              'x-api-key': apiKey.trim(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const data = (await response.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
          data?: any;
          messageId?: string;
        } | null;

        if (response.ok && data && data.success !== false) {
          const messageId =
            data.messageId ||
            (data.data && data.data._id) ||
            `txb-${Date.now()}`;

          this.logger.log(
            `[TextBee SMS] Successfully sent via Android phone to ${formattedRecipient}! (${latencyMs}ms)`,
          );

          return {
            success: true,
            messageId: String(messageId),
            provider: this.providerType,
            channel: CommunicationChannel.SMS,
            latencyMs,
            rawResponse: data,
          };
        } else {
          const errorMsg = data?.error || 'TextBee dispatch failed';
          this.logger.warn(
            `[TextBee SMS] Delivery error: ${errorMsg} (HTTP ${response.status})`,
          );

          return {
            success: false,
            provider: this.providerType,
            channel: CommunicationChannel.SMS,
            latencyMs,
            errorCode: 'TEXTBEE_DISPATCH_FAILED',
            errorMessage: errorMsg,
            rawResponse: data,
          };
        }
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[TextBee SMS] Network connection error: ${errMsg}`);

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

    // Fallback simulated mode
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      messageId: `sim-txb-${Date.now()}`,
      provider: this.providerType,
      channel: CommunicationChannel.SMS,
      latencyMs,
      rawResponse: {
        status: 'SIMULATED_MISSING_TEXTBEE_KEY',
        recipient: formattedRecipient,
      },
    };
  }
}
