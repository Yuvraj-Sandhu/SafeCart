/**
 * Base Email Layout Component
 * 
 * Provides consistent branding and structure for all SafeCart email templates.
 * Includes header, footer, and responsive design patterns.
 * 
 * @author Yuvraj
 */

import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Hr,
} from '@react-email/components';

interface BaseLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

export function BaseLayout({ children, previewText }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        {previewText && (
          <Text style={preview}>{previewText}</Text>
        )}
        
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>
              SafeCart
            </Text>
            <Text style={tagline}>Protecting You from Food Recalls</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              © 2025 SafeCart. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://safecart.vercel.app" style={footerLink}>
                Visit SafeCart
              </Link>
              {' • '}
              <Link href="https://safecart.vercel.app/about" style={footerLink}>
                About
              </Link>
              {' • '}
              <Link href="https://safecart.vercel.app/contact" style={footerLink}>
                Contact
              </Link>
            </Text>
            <Text style={footerSmall}>
              This email was sent because you subscribed to SafeCart recall alerts.
              <br />
              <Link 
                href="{{unsubscribeUrl}}" 
                style={unsubscribeLink}
              >
                Unsubscribe instantly
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const preview = {
  display: 'none',
  overflow: 'hidden',
  lineHeight: '1px',
  opacity: 0,
  maxHeight: 0,
  maxWidth: 0,
};

const container = {
  backgroundColor: '#fcf9f6',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
};

const header = {
  padding: '24px 40px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #e6e6e6',
};

const logoText = {
  fontSize: '36px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  color: '#15803d', // primary color from theme.ts
  margin: '0 auto 8px',
  textAlign: 'center' as const,
};

const tagline = {
  fontSize: '14px',
  color: '#666666',
  margin: '0',
};

const content = {
  padding: '32px 40px',
};

const divider = {
  borderColor: '#e6e6e6',
  margin: '32px 0',
};

const footer = {
  padding: '0 40px 24px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '14px',
  color: '#666666',
  margin: '8px 0',
};

const footerSmall = {
  fontSize: '12px',
  color: '#999999',
  margin: '16px 0 0',
  lineHeight: '16px',
};

const footerLink = {
  color: '#2563eb',
  textDecoration: 'none',
};

const unsubscribeLink = {
  color: '#dc2626',
  textDecoration: 'underline',
};