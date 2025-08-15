/**
 * Welcome Email Template
 * 
 * Sent to new users after successful registration and subscription.
 * Introduces SafeCart service and confirms subscription preferences.
 * 
 * @author Yuvraj
 */

import * as React from 'react';
import {
  Section,
  Text,
  Link,
  Button,
  Row,
  Column,
} from '@react-email/components';
import { BaseLayout } from '../components/BaseLayout';

interface WelcomeEmailProps {
  user: {
    name: string;
    email: string;
    unsubscribeToken: string;
  };
  state: string;
}

export function WelcomeEmail({ user, state }: WelcomeEmailProps) {

  const previewText = `Welcome to SafeCart! You're now subscribed to food recall alerts for ${state}.`;
  const unsubscribeUrl = `https://api.safecart.app/api/user/unsubscribe/${user.unsubscribeToken}`;

  return (
    <BaseLayout previewText={previewText}>
      {/* Welcome Header */}
      <Section style={welcomeSection}>
        <Text style={welcomeTitle}>
          Welcome to SafeCart!
        </Text>
        <Text style={welcomeSubtitle}>
          You're now protected from food recalls in {state}
        </Text>
      </Section>

      {/* Subscription Confirmation */}
      <Section style={confirmationSection}>
        <Text style={confirmationTitle}>
          Your Subscription Details
        </Text>
        <Section style={detailsBox}>
          <Text style={detailItem}>
            <strong>State:</strong> {state}
          </Text>
          <Text style={detailItem}>
            <strong>Delivery:</strong> Immediate email alerts as soon as recalls are issued
          </Text>
          <Text style={detailItem}>
            <strong>Email:</strong> {user.email}
          </Text>
        </Section>
      </Section>

      {/* What to Expect */}
      <Section style={expectSection}>
        <Text style={sectionTitle}>
          What to Expect
        </Text>
        <Text style={bulletPoint}>
          <strong>Timely Alerts:</strong> We'll send you a summary of any food recalls affecting {state}
        </Text>
        <Text style={bulletPoint}>
          <strong>Detailed Information:</strong> Each alert includes product details, images, and safety instructions
        </Text>
        <Text style={bulletPoint}>
          <strong>Smart Filtering:</strong> We only send relevant recalls for your selected state
        </Text>
      </Section>

      {/* Call to Action */}
      <Section style={ctaSection}>
        <Text style={ctaText}>
          Test your subscription and search current recalls:
        </Text>
        <Button 
          href={`https://safecart.vercel.app`}
          style={ctaButton}
        >
          Search Current Recalls
        </Button>
      </Section>

      {/* How It Works */}
      <Section style={howItWorksSection}>
        <Text style={sectionTitle}>
          How SafeCart Protects You
        </Text>
        <Row style={stepRow}>
          <Column style={stepNumberColumn}>
            <Text style={stepNumber}>1</Text>
          </Column>
          <Column style={stepTextColumn}>
            <Text style={stepText}>
              <strong>Monitor:</strong> We continuously track FDA and USDA recall databases
            </Text>
          </Column>
        </Row>
        <Row style={stepRow}>
          <Column style={stepNumberColumn}>
            <Text style={stepNumber}>2</Text>
          </Column>
          <Column style={stepTextColumn}>
            <Text style={stepText}>
              <strong>Filter:</strong> Our system identifies recalls affecting your state
            </Text>
          </Column>
        </Row>
        <Row style={stepRow}>
          <Column style={stepNumberColumn}>
            <Text style={stepNumber}>3</Text>
          </Column>
          <Column style={stepTextColumn}>
            <Text style={stepText}>
              <strong>Notify:</strong> You receive clear, actionable alerts with product details
            </Text>
          </Column>
        </Row>
        <Row style={stepRow}>
          <Column style={stepNumberColumn}>
            <Text style={stepNumber}>4</Text>
          </Column>
          <Column style={stepTextColumn}>
            <Text style={stepText}>
              <strong>Act:</strong> Check your pantry and return or dispose of recalled items
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Safety Tips */}
      <Section style={tipsSection}>
        <Text style={sectionTitle}>
          Food Safety Tips
        </Text>
        <Text style={tipText}>
          • Always check expiration dates before consuming food
        </Text>
        <Text style={tipText}>
          • Store perishables at proper temperatures
        </Text>
        <Text style={tipText}>
          • Wash hands and surfaces when preparing food
        </Text>
        <Text style={tipText}>
          • When in doubt about food safety, throw it out
        </Text>
        <Text style={tipText}>
          • Report foodborne illness to your local health department
        </Text>
      </Section>

      {/* Preference Management */}
      <Section style={preferencesSection}>
        <Text style={preferencesTitle}>
          Manage Your Preferences
        </Text>
        <Text style={preferencesText}>
          You can change your state or notification preferences anytime:
        </Text>
        <Link href="https://safecart.app/preferences" style={preferencesButton}>
          Update Preferences
        </Link>
      </Section>

      {/* Support */}
      <Section style={supportSection}>
        <Text style={supportTitle}>
          Need Help?
        </Text>
        <Text style={supportText}>
          If you have questions about SafeCart or need assistance with your account:
        </Text>
        <Text style={supportText}>
          Email us at{' '}
          <Link href="mailto:support@safecart.app" style={supportLink}>
            support@safecart.app
          </Link>
        </Text>
        <Text style={supportText}>
          Visit our{' '}
          <Link href="https://safecart.app/help" style={supportLink}>
            Help Center
          </Link>
        </Text>
      </Section>

      {/* Unsubscribe Info */}
      <Section style={unsubscribeSection}>
        <Text style={unsubscribeText}>
          You can{' '}
          <Link href={unsubscribeUrl} style={unsubscribeLink}>
            unsubscribe
          </Link>{' '}
          from these emails at any time, but we hope you'll stay to keep your family safe!
        </Text>
      </Section>
    </BaseLayout>
  );
}

// Styles
const welcomeSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
  padding: '24px 12px',
  backgroundColor: '#e0ffe4',
  borderRadius: '12px',
};

const welcomeTitle = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#166534',
  margin: '0 0 12px',
};

const welcomeSubtitle = {
  fontSize: '16px',
  color: '#166534',
  margin: '0',
};

const confirmationSection = {
  marginBottom: '32px',
};

const confirmationTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 16px',
};

const detailsBox = {
  backgroundColor: '#faf6ed',
  border: '1px solid #d5d7db',
  borderRadius: '10px',
  padding: '16px',
};

const detailItem = {
  fontSize: '16px',
  color: '#374151',
  margin: '0 0 8px',
  lineHeight: '24px',
};

const expectSection = {
  marginBottom: '32px',
};

const sectionTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 16px',
};

const bulletPoint = {
  fontSize: '16px',
  color: '#374151',
  margin: '0 0 12px',
  lineHeight: '24px',
};

const ctaSection = {
  textAlign: 'center' as const,
  padding: '24px 12px',
  backgroundColor: '#faf6ed',
  border: '1px solid #d5d7db',
  borderRadius: '10px',
  marginBottom: '32px',
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

const howItWorksSection = {
  marginBottom: '32px',
};

const stepRow = {
  marginBottom: '16px',
};

const stepNumberColumn = {
  width: '48px',
  verticalAlign: 'top',
};

const stepTextColumn = {
  verticalAlign: 'top',
};

const stepNumber = {
  backgroundColor: '#15803d',
  color: '#ffffff',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  textAlign: 'center' as const,
  fontSize: '16px',
  fontWeight: 'bold',
  lineHeight: '32px',
  margin: '0',
};

const stepText = {
  fontSize: '16px',
  color: '#374151',
  margin: '0',
  lineHeight: '24px',
};

const tipsSection = {
  backgroundColor: '#fffbeb',
  border: '1px solid #d5d7db',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '32px',
};

const tipText = {
  fontSize: '14px',
  color: '#92400e',
  margin: '0 0 8px',
  lineHeight: '20px',
};

const preferencesSection = {
  backgroundColor: '#e0ffe4',
  border: '1px solid #90efa4',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const preferencesTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#166534',
  margin: '0 0 8px',
};

const preferencesText = {
  fontSize: '14px',
  color: '#166534',
  margin: '0 0 16px',
};

const preferencesButton = {
  backgroundColor: '#15803d',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 'bold',
  display: 'inline-block',
};

const supportSection = {
  marginBottom: '24px',
};

const supportTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 12px',
};

const supportText = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 8px',
  lineHeight: '20px',
};

const supportLink = {
  color: '#2563eb',
  textDecoration: 'none',
};

const unsubscribeSection = {
  backgroundColor: '#faf6ed',
  border: '1px solid #d5d7db',
  padding: '16px',
  borderRadius: '6px',
  textAlign: 'center' as const,
};

const unsubscribeText = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0',
};

const unsubscribeLink = {
  color: '#dc2626',
  textDecoration: 'none',
};

export default WelcomeEmail;