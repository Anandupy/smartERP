import { CommunicationChannel, ProviderType } from '@/generated/client';

export interface ProviderSendResult {
  success: boolean;
  messageId?: string;
  provider: ProviderType;
  channel: CommunicationChannel;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface SendSmsOptions {
  to: string;
  message: string;
  senderId?: string;
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface SendWhatsappOptions {
  to: string;
  templateName?: string;
  templateLanguage?: string;
  components?: any[];
  message?: string;
  mediaUrl?: string;
  metadata?: Record<string, any>;
}

export interface SendPushOptions {
  targetToken: string | string[];
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  priority?: 'normal' | 'high';
  metadata?: Record<string, any>;
}
