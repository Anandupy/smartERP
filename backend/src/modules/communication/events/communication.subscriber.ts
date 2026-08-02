import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  CommunicationChannel,
  DeliveryStatus,
  NotificationCategory,
} from '@/generated/client';
import { TemplateService } from '../templates/template.service';
import { NotificationPreferenceService } from '../preferences/notification-preference.service';
import { CommunicationConfigService } from '../config/communication-config.service';
import { ProviderFactory } from '../providers/provider.factory';
import { InAppNotificationService } from '../notification/in-app-notification.service';
import { DeliveryLogService } from '../delivery-log/delivery-log.service';
import {
  PasswordResetRequestedEvent,
  PasswordChangedEvent,
  EmailVerificationRequestedEvent,
  OtpResendRequestedEvent,
  OtpSentEvent,
} from '@/common/events';

@Injectable()
export class CommunicationSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CommunicationSubscriber.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly templateService: TemplateService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly configService: CommunicationConfigService,
    private readonly providerFactory: ProviderFactory,
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly deliveryLogService: DeliveryLogService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe<PasswordResetRequestedEvent>(
      PasswordResetRequestedEvent.EVENT_NAME,
      this.handlePasswordResetRequested.bind(this),
    );

    this.eventBus.subscribe<PasswordChangedEvent>(
      PasswordChangedEvent.EVENT_NAME,
      this.handlePasswordChanged.bind(this),
    );

    this.eventBus.subscribe<EmailVerificationRequestedEvent>(
      EmailVerificationRequestedEvent.EVENT_NAME,
      this.handleEmailVerificationRequested.bind(this),
    );

    this.eventBus.subscribe<OtpSentEvent>(
      OtpSentEvent.EVENT_NAME,
      this.handleOtpSent.bind(this),
    );

    this.eventBus.subscribe<OtpResendRequestedEvent>(
      OtpResendRequestedEvent.EVENT_NAME,
      this.handleOtpSent.bind(this),
    );

    // Generic system domain event integrations
    this.eventBus.subscribe(
      'user.logged_in',
      this.handleUserLoggedIn.bind(this),
    );
    this.eventBus.subscribe(
      'applicant.created',
      this.handleApplicantCreated.bind(this),
    );
    this.eventBus.subscribe(
      'admission.transitioned',
      this.handleAdmissionTransitioned.bind(this),
    );

    this.logger.log(
      'CommunicationSubscriber successfully subscribed to system domain events.',
    );
  }

  private async handlePasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ) {
    try {
      const { email, rawOtp, resetToken, userName, expiresInMinutes, userId } =
        event.payload;

      // 1. Verify User Preferences & Settings
      const isAllowed = userId
        ? await this.preferenceService.isChannelAllowed(
            userId,
            NotificationCategory.AUTHENTICATION,
            CommunicationChannel.EMAIL,
          )
        : true;

      if (!isAllowed) return;

      const config = await this.configService.getConfig();
      if (!config.emailEnabled) return;

      // 2. Resolve Template & Render Variables
      const variables = {
        userName: userName || 'User',
        otp: rawOtp || '',
        resetLink: resetToken
          ? `https://app.campusflow.edu/reset-password?token=${resetToken}`
          : '',
        minutes: expiresInMinutes || 10,
        organizationName: 'CampusFlow ERP',
      };

      const template = await this.templateService.resolveTemplate(
        'PASSWORD_RESET',
        CommunicationChannel.EMAIL,
      );

      const rendered = this.templateService.renderTemplate(template, variables);

      // 3. Dispatch Email Provider
      const emailProvider = this.providerFactory.getEmailProvider(
        config.defaultEmailProvider,
      );

      const result = await emailProvider.sendEmail({
        to: email,
        subject: rendered.subject || 'Password Reset Request',
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
      });

      // 4. Record Operational Delivery Log
      await this.deliveryLogService.logDelivery({
        channel: CommunicationChannel.EMAIL,
        provider: result.provider,
        recipient: email,
        subject: rendered.subject,
        templateId: template.id,
        templateVersion: template.version,
        status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        metadata: { eventId: event.eventId },
      });

      // 5. Create In-App Notification if user is known
      if (userId) {
        await this.inAppNotificationService.create({
          userId,
          title: 'Password Reset Requested',
          content: 'A password reset request was initiated for your account.',
          category: NotificationCategory.AUTHENTICATION,
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling PasswordResetRequestedEvent (${event.eventId}): ${error.message}`,
        error.stack,
      );
    }
  }

  private async handlePasswordChanged(event: PasswordChangedEvent) {
    try {
      const { email, userName, userId } = event.payload;

      const config = await this.configService.getConfig();
      if (!config.emailEnabled) return;

      const variables = {
        userName: userName || 'User',
        organizationName: 'CampusFlow ERP',
      };

      const template = await this.templateService.resolveTemplate(
        'PASSWORD_CHANGED',
        CommunicationChannel.EMAIL,
      );

      const rendered = this.templateService.renderTemplate(template, variables);
      const emailProvider = this.providerFactory.getEmailProvider(
        config.defaultEmailProvider,
      );

      const result = await emailProvider.sendEmail({
        to: email,
        subject: rendered.subject || 'Security Alert: Password Changed',
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
      });

      await this.deliveryLogService.logDelivery({
        channel: CommunicationChannel.EMAIL,
        provider: result.provider,
        recipient: email,
        subject: rendered.subject,
        templateId: template.id,
        templateVersion: template.version,
        status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        latencyMs: result.latencyMs,
        metadata: { eventId: event.eventId },
      });

      if (userId) {
        await this.inAppNotificationService.create({
          userId,
          title: 'Password Changed',
          content: 'Your password was successfully updated.',
          category: NotificationCategory.AUTHENTICATION,
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling PasswordChangedEvent: ${error.message}`,
      );
    }
  }

  private async handleEmailVerificationRequested(
    event: EmailVerificationRequestedEvent,
  ) {
    try {
      const { email, rawOtp } = event.payload;

      const config = await this.configService.getConfig();
      if (!config.emailEnabled) return;

      const variables = {
        otp: rawOtp || '',
        organizationName: 'CampusFlow ERP',
      };

      const template = await this.templateService.resolveTemplate(
        'EMAIL_VERIFICATION',
        CommunicationChannel.EMAIL,
      );

      const rendered = this.templateService.renderTemplate(template, variables);
      const emailProvider = this.providerFactory.getEmailProvider(
        config.defaultEmailProvider,
      );

      const result = await emailProvider.sendEmail({
        to: email,
        subject: rendered.subject || 'Verify Your Email Address',
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
      });

      await this.deliveryLogService.logDelivery({
        channel: CommunicationChannel.EMAIL,
        provider: result.provider,
        recipient: email,
        subject: rendered.subject,
        templateId: template.id,
        templateVersion: template.version,
        status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        latencyMs: result.latencyMs,
        metadata: { eventId: event.eventId },
      });
    } catch (error: any) {
      this.logger.error(
        `Error handling EmailVerificationRequestedEvent: ${error.message}`,
      );
    }
  }

  private async handleOtpSent(event: OtpSentEvent | OtpResendRequestedEvent) {
    try {
      const { identifier, rawOtp, purpose, email } = event.payload;
      const targetEmail =
        email || (identifier.includes('@') ? identifier : null);

      if (!targetEmail) {
        this.logger.warn(
          `No target email address resolved for OTP delivery (Identifier: ${identifier}, Purpose: ${purpose})`,
        );
        return;
      }

      const config = await this.configService.getConfig();
      if (!config.emailEnabled) return;

      const variables = {
        otp: rawOtp || '',
        purpose: purpose || 'Verification',
        organizationName: 'CampusFlow ERP',
      };

      const template = await this.templateService.resolveTemplate(
        'OTP_VERIFICATION',
        CommunicationChannel.EMAIL,
      );

      const rendered = this.templateService.renderTemplate(template, variables);
      const emailProvider = this.providerFactory.getEmailProvider(
        config.defaultEmailProvider,
      );

      const result = await emailProvider.sendEmail({
        to: targetEmail,
        subject: rendered.subject || 'One-Time Password (OTP) Verification',
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
      });

      await this.deliveryLogService.logDelivery({
        channel: CommunicationChannel.EMAIL,
        provider: result.provider,
        recipient: targetEmail,
        subject: rendered.subject,
        templateId: template.id,
        templateVersion: template.version,
        status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        metadata: { eventId: event.eventId },
      });
    } catch (error: any) {
      this.logger.error(
        `Error handling OTP event (${event.eventName}): ${error.message}`,
      );
    }
  }

  private async handleUserLoggedIn(event: any) {
    this.logger.debug(
      `[Communication Subscriber] Processing user.logged_in event for ${event?.payload?.userId}`,
    );
  }

  private async handleApplicantCreated(event: any) {
    this.logger.debug(
      `[Communication Subscriber] Processing applicant.created event for ${event?.payload?.applicantId}`,
    );
  }

  private async handleAdmissionTransitioned(event: any) {
    this.logger.debug(
      `[Communication Subscriber] Processing admission.transitioned event for ${event?.payload?.applicantId}`,
    );
  }
}
