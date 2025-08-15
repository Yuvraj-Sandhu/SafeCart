/**
 * Type declarations for @mailchimp/mailchimp_transactional
 * 
 * This file provides TypeScript type definitions for the Mailchimp Transactional API client.
 * Since the official package doesn't include types, we define them here for type safety.
 */

declare module '@mailchimp/mailchimp_transactional' {
  interface MailchimpMessage {
    from_email: string;
    from_name?: string;
    to: Array<{
      email: string;
      name?: string;
      type: 'to' | 'cc' | 'bcc';
    }>;
    subject?: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
    important?: boolean;
    track_opens?: boolean;
    track_clicks?: boolean;
    auto_text?: boolean;
    auto_html?: boolean;
    inline_css?: boolean;
    url_strip_qs?: boolean;
    preserve_recipients?: boolean;
    view_content_link?: boolean;
    merge?: boolean;
    merge_language?: string;
    merge_vars?: Array<{
      rcpt: string;
      vars: Array<{
        name: string;
        content: any;
      }>;
    }>;
    metadata?: Record<string, string>;
    tags?: string[];
  }

  interface SendMessageResponse {
    email: string;
    status: 'sent' | 'queued' | 'rejected' | 'invalid';
    reject_reason?: string;
    _id: string;
  }

  interface MessageInfo {
    _id: string;
    ts: number;
    state: string;
    subject: string;
    email: string;
    opens: number;
    clicks: number;
    tags: string[];
    metadata: Record<string, string>;
  }

  interface MailchimpClient {
    messages: {
      send: (params: {
        message: MailchimpMessage;
        async?: boolean;
        ip_pool?: string;
        send_at?: string;
      }) => Promise<SendMessageResponse[]>;
      
      sendTemplate: (params: {
        template_name: string;
        template_content: Array<{
          name: string;
          content: string;
        }>;
        message: MailchimpMessage;
        async?: boolean;
        ip_pool?: string;
        send_at?: string;
      }) => Promise<SendMessageResponse[]>;
      
      info: (params: {
        id: string;
      }) => Promise<MessageInfo>;
    };
  }

  const Mailchimp: (apiKey: string) => MailchimpClient;
  
  export = Mailchimp;
}