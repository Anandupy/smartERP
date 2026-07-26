import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventsModule } from '@/infrastructure/events/events.module';

// Controllers
import { TemplateController } from './templates/template.controller';
import { OtpController } from './otp/otp.controller';
import { InAppNotificationController } from './notification/in-app-notification.controller';
import { NotificationPreferenceController } from './preferences/notification-preference.controller';
import { DeliveryLogController } from './delivery-log/delivery-log.controller';
import { CommunicationConfigController } from './config/communication-config.controller';

// Services & Renderers
import { TemplateService } from './templates/template.service';
import { HandlebarsTemplateRenderer } from './renderer/handlebars-template.renderer';
import { OtpService } from './otp/otp.service';
import { InAppNotificationService } from './notification/in-app-notification.service';
import { NotificationPreferenceService } from './preferences/notification-preference.service';
import { DeliveryLogService } from './delivery-log/delivery-log.service';
import { CommunicationConfigService } from './config/communication-config.service';

// Providers & Strategies
import { SmtpEmailProvider } from './providers/smtp/smtp-email.provider';
import { StubSMSProvider } from './providers/stub/stub-sms.provider';
import { StubWhatsAppProvider } from './providers/stub/stub-whatsapp.provider';
import { StubPushProvider } from './providers/stub/stub-push.provider';
import { ProviderFactory } from './providers/provider.factory';
import { ExponentialBackoffRetryStrategy } from './retry/exponential-backoff.strategy';

// Events & Subscribers
import { CommunicationSubscriber } from './events/communication.subscriber';

@Module({
  imports: [ConfigModule, PrismaModule, EventsModule],
  controllers: [
    TemplateController,
    OtpController,
    InAppNotificationController,
    NotificationPreferenceController,
    DeliveryLogController,
    CommunicationConfigController,
  ],
  providers: [
    HandlebarsTemplateRenderer,
    TemplateService,
    OtpService,
    InAppNotificationService,
    NotificationPreferenceService,
    DeliveryLogService,
    CommunicationConfigService,
    SmtpEmailProvider,
    StubSMSProvider,
    StubWhatsAppProvider,
    StubPushProvider,
    ProviderFactory,
    ExponentialBackoffRetryStrategy,
    CommunicationSubscriber,
  ],
  exports: [
    TemplateService,
    OtpService,
    InAppNotificationService,
    NotificationPreferenceService,
    DeliveryLogService,
    CommunicationConfigService,
    ProviderFactory,
  ],
})
export class CommunicationModule {}
