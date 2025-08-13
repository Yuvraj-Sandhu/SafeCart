/**
 * Daily Recall Digest Email Template
 * 
 * Sends personalized daily digest of food recalls for user's selected state.
 * Primary email template for SafeCart's notification service.
 * 
 * @author Yuvraj
 */

import * as React from 'react';
import {
  Section,
  Text,
  Link,
  Button,
} from '@react-email/components';
import { BaseLayout } from '../components/BaseLayout';
import { RecallCard } from '../components/RecallCard';

interface RecallDigestProps {
  user: {
    name: string;
    email: string;
    unsubscribeToken: string;
  };
  state: string;
  recalls: Array<{
    id: string;
    title: string;
    company: string;
    recallDate: string;
    classification: string;
    description: string;
    reason: string;
    primaryImage?: string;
    recallUrl?: string;
    source: 'USDA' | 'FDA';
  }>;
  digestDate: string;
  isTest?: boolean;
}

export function RecallDigest({ 
  user, 
  state, 
  recalls, 
  digestDate,
  isTest = false 
}: RecallDigestProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const previewText = recalls.length === 0 
    ? `Good news! No food recalls reported in ${state} today.`
    : `${recalls.length} food recall${recalls.length > 1 ? 's' : ''} reported in ${state}. Stay informed and stay safe.`;

  const unsubscribeUrl = `https://api.safecart.app/api/user/unsubscribe/${user.unsubscribeToken}`;

  return (
    <BaseLayout previewText={previewText}>
      {/* Test Email Notice */}
      {isTest && (
        <Section style={testNotice}>
          <Text style={testText}>
            This is a test email to verify your SafeCart subscription
          </Text>
        </Section>
      )}

      {/* Header */}
      <Section style={headerSection}>
        <Text style={greeting}>
          Hello {user.name},
        </Text>
        <Text style={digestInfo}>
          Your SafeCart digest for <strong>{state}</strong> {formatDate(digestDate)}
        </Text>
      </Section>

      {/* No Recalls Message */}
      {recalls.length === 0 ? (
        <Section style={noRecallsSection}>
          <Text style={noRecallsTitle}>
            Great news!
          </Text>
          <Text style={noRecallsText}>
            No food recalls were reported in {state} today. We'll continue monitoring 
            and will notify you immediately if any recalls affect your area.
          </Text>
          <Text style={tipText}>
            <strong>Safety Tip:</strong> Always check expiration dates and store food 
            properly to minimize contamination risks.
          </Text>
        </Section>
      ) : (
        <>
          {/* Recalls Summary */}
          <Section style={summarySection}>
            <Text style={summaryTitle}>
              {recalls.length} Food Recall{recalls.length > 1 ? 's' : ''} in {state}
            </Text>
            <Text style={summaryText}>
              We found {recalls.length} food recall{recalls.length > 1 ? 's' : ''} that may affect your area. 
              Review the details below and check your pantry for any affected products.
            </Text>
          </Section>

          {/* Recall Cards */}
          <Section style={recallsSection}>
            {recalls.map((recall) => (
              <RecallCard key={recall.id} recall={recall} />
            ))}
          </Section>

          {/* Call to Action */}
          <Section style={ctaSection}>
            <Text style={ctaText}>
              Stay informed and check for more recalls on our website:
            </Text>
            <Button 
              href={`https://safecart.vercel.app`}
              style={ctaButton}
            >
              Search More Recalls
            </Button>
          </Section>
        </>
      )}

      {/* Preference Management */}
      <Section style={preferencesSection}>
        <Text style={preferencesText}>
          You're receiving this digest for recalls in <strong>{state}</strong>.{' '}
          <Link href="https://safecart.app/preferences" style={preferencesLink}>
            Update your preferences
          </Link>{' '}
          or{' '}
          <Link href={unsubscribeUrl} style={unsubscribeLink}>
            unsubscribe
          </Link>.
        </Text>
      </Section>

      {/* Safety Footer */}
      <Section style={safetySection}>
        <Text style={safetyTitle}>
          Food Safety Reminder
        </Text>
        <Text style={safetyText}>
          If you have any recalled products, do not consume them. Return them to the 
          store for a full refund or dispose of them safely. When in doubt, throw it out.
        </Text>
      </Section>
    </BaseLayout>
  );
}

// Styles
const testNotice = {
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '24px',
  textAlign: 'center' as const,
};

const testText = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0',
};

const headerSection = {
  marginBottom: '24px',
};

const greeting = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 8px',
};

const digestInfo = {
  fontSize: '16px',
  color: '#6b7280',
  margin: '0 0 16px',
};

const noRecallsSection = {
  textAlign: 'center' as const,
  padding: '32px 0',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  marginBottom: '24px',
};

const noRecallsTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#15803d',
  margin: '0 0 16px',
};

const noRecallsText = {
  fontSize: '16px',
  color: '#15803d',
  margin: '0 0 16px',
  lineHeight: '24px',
};

const tipText = {
  fontSize: '14px',
  color: '#15803d',
  margin: '0',
  lineHeight: '20px',
};

const summarySection = {
  marginBottom: '24px',
};

const summaryTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#dc2626',
  margin: '0 0 8px',
};

const summaryText = {
  fontSize: '16px',
  color: '#374151',
  margin: '0',
  lineHeight: '24px',
};

const recallsSection = {
  marginBottom: '32px',
};

const ctaSection = {
  textAlign: 'center' as const,
  padding: '24px 12px',
  backgroundColor: '#faf6ed',
  border: '1px solid #d5d7db',
  borderRadius: '8px',
  marginBottom: '24px',
};

const ctaText = {
  fontSize: '16px',
  color: '#374151',
  margin: '0 0 16px',
};

const ctaButton = {
  backgroundColor: '#15803d',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 'bold',
  display: 'inline-block',
};

const preferencesSection = {
  backgroundColor: '#faf6ed',
  border: '1px solid #d5d7db',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '24px',
};

const preferencesText = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
  textAlign: 'center' as const,
};

const preferencesLink = {
  color: '#2563eb',
  textDecoration: 'none',
};

const unsubscribeLink = {
  color: '#dc2626',
  textDecoration: 'none',
};

const safetySection = {
  backgroundColor: '#fef2f2',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #fecaca',
};

const safetyTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#dc2626',
  margin: '0 0 8px',
};

const safetyText = {
  fontSize: '14px',
  color: '#991b1b',
  margin: '0',
  lineHeight: '20px',
};

export default RecallDigest;