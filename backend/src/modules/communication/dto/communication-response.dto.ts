import { ApiProperty } from '@nestjs/swagger';
import {
  CommunicationChannel,
  DeliveryStatus,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  ProviderType,
  TemplateStatus,
} from '@/generated/client';
import { PaginationMetaDto } from '@/common/http/response-envelope';

/**
 * A message template.
 *
 * Scoped like the admissions masters: both ids null is a system default, an
 * organization with no branch is tenant-wide, both set is branch-specific.
 * A `code` is versioned per channel and language, so publishing a new version
 * leaves the old one addressable.
 */
export class CommunicationTemplateDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b10' })
  id!: string;

  @ApiProperty({ nullable: true, example: null })
  organizationId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  branchId!: string | null;

  @ApiProperty({ example: 'ADMISSION_APPROVED' })
  code!: string;

  @ApiProperty({ example: 'Admission approved' })
  name!: string;

  @ApiProperty({
    nullable: true,
    example: 'Sent when an applicant is approved.',
  })
  description!: string | null;

  @ApiProperty({
    enum: CommunicationChannel,
    example: CommunicationChannel.EMAIL,
  })
  channel!: CommunicationChannel;

  @ApiProperty({
    enum: NotificationCategory,
    example: NotificationCategory.ADMISSIONS,
  })
  category!: NotificationCategory;

  @ApiProperty({ nullable: true, example: 'Your admission is confirmed' })
  subject!: string | null;

  @ApiProperty({ nullable: true, example: '<p>Dear {{name}}…</p>' })
  bodyHtml!: string | null;

  @ApiProperty({ nullable: true, example: 'Dear {{name}}…' })
  bodyText!: string | null;

  @ApiProperty({
    description: 'Names of the variables the body expects.',
    nullable: true,
    example: ['name', 'applicationNo'],
  })
  variables!: unknown;

  @ApiProperty({ example: 'en' })
  language!: string;

  @ApiProperty({
    description: 'Incremented when a published template is superseded.',
    example: 1,
  })
  version!: number;

  @ApiProperty({ enum: TemplateStatus, example: TemplateStatus.PUBLISHED })
  status!: TemplateStatus;

  @ApiProperty({
    description: 'The template used when no more specific one resolves.',
    example: false,
  })
  isDefault!: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  createdBy!: string | null;

  @ApiProperty({ nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * A template rendered against a set of variables.
 *
 * Only the fields the template defines come back — an SMS template has no
 * `subject` or `bodyHtml`. `missingVariables` names the placeholders that had
 * no value, so a preview shows what the caller still has to supply.
 */
export class TemplatePreviewDto {
  @ApiProperty({ required: false, example: 'Your admission is confirmed' })
  subject?: string;

  @ApiProperty({ required: false, example: '<p>Dear Rohan…</p>' })
  bodyHtml?: string;

  @ApiProperty({ required: false, example: 'Dear Rohan…' })
  bodyText?: string;

  @ApiProperty({
    description: 'Placeholders left unresolved. Empty when all were supplied.',
    type: [String],
    example: [],
  })
  missingVariables!: string[];
}

/** One attempt to deliver a message through a provider. */
export class DeliveryLogDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b20' })
  id!: string;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty({
    enum: CommunicationChannel,
    example: CommunicationChannel.EMAIL,
  })
  channel!: CommunicationChannel;

  @ApiProperty({ enum: ProviderType, example: ProviderType.SMTP })
  provider!: ProviderType;

  @ApiProperty({ example: 'rohan@example.com' })
  recipient!: string;

  @ApiProperty({ nullable: true, example: 'no-reply@northfield.edu' })
  sender!: string | null;

  @ApiProperty({ nullable: true, example: 'Your admission is confirmed' })
  subject!: string | null;

  @ApiProperty({ nullable: true })
  templateId!: string | null;

  @ApiProperty({ nullable: true, example: 1 })
  templateVersion!: number | null;

  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.DELIVERED })
  status!: DeliveryStatus;

  @ApiProperty({
    description: 'Provider round-trip time.',
    nullable: true,
    example: 412,
  })
  latencyMs!: number | null;

  @ApiProperty({ example: 0 })
  retryCount!: number;

  @ApiProperty({ nullable: true, example: null })
  errorCode!: string | null;

  @ApiProperty({ nullable: true, example: null })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  openedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  clickedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt!: Date | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** Rates derived from the delivery counts, as percentages. */
export class DeliveryRatesDto {
  @ApiProperty({
    description: 'Sent plus delivered, over everything processed.',
    example: 98.41,
  })
  deliveryRate!: number;

  @ApiProperty({ example: 1.19 })
  failureRate!: number;

  @ApiProperty({ example: 0.4 })
  bounceRate!: number;
}

/**
 * Delivery counts and the rates derived from them.
 *
 * `total` counts every log row; the four status counts cover only terminal
 * states, so they do not have to add up to it while messages are in flight.
 */
export class DeliveryAnalyticsDto {
  @ApiProperty({ example: 1204 })
  total!: number;

  @ApiProperty({ example: 900 })
  sent!: number;

  @ApiProperty({ example: 290 })
  delivered!: number;

  @ApiProperty({ example: 9 })
  failed!: number;

  @ApiProperty({ example: 5 })
  bounced!: number;

  @ApiProperty({ type: DeliveryRatesDto })
  metrics!: DeliveryRatesDto;
}

/** A notification in a user's in-app inbox. */
export class InAppNotificationDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b30' })
  id!: string;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a' })
  userId!: string;

  @ApiProperty({ example: 'Admission approved' })
  title!: string;

  @ApiProperty({ example: 'Rohan Sharma’s admission has been approved.' })
  content!: string;

  @ApiProperty({
    enum: NotificationCategory,
    example: NotificationCategory.ADMISSIONS,
  })
  category!: NotificationCategory;

  @ApiProperty({
    enum: NotificationPriority,
    example: NotificationPriority.NORMAL,
  })
  priority!: NotificationPriority;

  @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.UNREAD })
  status!: NotificationStatus;

  @ApiProperty({
    description: 'Where the client should navigate when the row is opened.',
    nullable: true,
    example: '/admissions/applicants/018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0',
  })
  actionUrl!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ example: false })
  isPinned!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * Pagination for the notification inbox, plus the unread badge count.
 *
 * `unreadCount` is the user's whole unread total, not the unread rows on this
 * page, so a badge stays correct while the reader pages through.
 */
export class NotificationMetaDto extends PaginationMetaDto {
  @ApiProperty({
    description: 'Unread notifications for the user, across all pages.',
    example: 7,
  })
  unreadCount!: number;
}

/** How many notifications a bulk action affected. */
export class NotificationBulkResultDto {
  @ApiProperty({ example: 7 })
  count!: number;
}

/**
 * One user's opt-ins for one notification category.
 *
 * A category the user has never touched is returned with every channel enabled
 * and a synthetic `default-<userId>-<category>` id — it has no row yet, so
 * that id cannot be used to address it.
 */
export class NotificationPreferenceDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b40' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a' })
  userId!: string;

  @ApiProperty({
    enum: NotificationCategory,
    example: NotificationCategory.ACADEMIC,
  })
  category!: NotificationCategory;

  @ApiProperty({ example: true })
  emailEnabled!: boolean;

  @ApiProperty({ example: true })
  smsEnabled!: boolean;

  @ApiProperty({ example: true })
  whatsappEnabled!: boolean;

  @ApiProperty({ example: true })
  pushEnabled!: boolean;

  @ApiProperty({ example: true })
  inAppEnabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * Channel switches and default providers for a scope.
 *
 * A scope that has never been configured is answered with a defaults object
 * carrying a synthetic `default-<org>-<branch>` id rather than a 404.
 */
export class CommunicationSettingDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b50' })
  id!: string;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty({ example: true })
  emailEnabled!: boolean;

  @ApiProperty({ example: true })
  smsEnabled!: boolean;

  @ApiProperty({ example: true })
  whatsappEnabled!: boolean;

  @ApiProperty({ example: true })
  pushEnabled!: boolean;

  @ApiProperty({ example: true })
  otpEnabled!: boolean;

  @ApiProperty({
    description: 'Whether opens and clicks are recorded.',
    example: true,
  })
  trackingEnabled!: boolean;

  @ApiProperty({ example: true })
  analyticsEnabled!: boolean;

  @ApiProperty({ example: true })
  retryEnabled!: boolean;

  @ApiProperty({ enum: ProviderType, example: ProviderType.SMTP })
  defaultEmailProvider!: ProviderType;

  @ApiProperty({ enum: ProviderType, example: ProviderType.CUSTOM })
  defaultSmsProvider!: ProviderType;

  @ApiProperty({ enum: ProviderType, example: ProviderType.CUSTOM })
  defaultWhatsappProvider!: ProviderType;

  @ApiProperty({ enum: ProviderType, example: ProviderType.CUSTOM })
  defaultPushProvider!: ProviderType;

  @ApiProperty({ nullable: true })
  createdBy!: string | null;

  @ApiProperty({ nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * A generated OTP, minus the code itself.
 *
 * The raw OTP is dispatched to the recipient and never returned — the response
 * carries only what the caller needs to track and re-request it.
 */
export class OtpGeneratedDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b60' })
  otpTokenId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({
    description: 'A resend before this time is rejected.',
    type: String,
    format: 'date-time',
  })
  resendAvailableAt!: Date;
}

/**
 * The payload of `POST /communication/otp/verify`.
 *
 * The service returns `{ success, message }`; the interceptor lifts `message`
 * onto the envelope, leaving `success` as the payload.
 */
export class OtpVerifiedDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
