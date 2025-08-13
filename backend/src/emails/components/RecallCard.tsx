/**
 * Recall Card Component for Email Templates
 * 
 * Displays individual recall information matching the exact design from the website.
 * Uses light theme colors from theme.ts for optimal email client compatibility.
 * Simplified design without badges to match current website implementation.
 * 
 * @author SafeCart Team
 */

import * as React from 'react';
import {
  Section,
  Text,
  Link,
  Img,
} from '@react-email/components';

interface RecallCardProps {
  recall: {
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
  };
}

export function RecallCard({ recall }: RecallCardProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Section style={cardContainer}>
      {/* Primary Image or Placeholder - matching website design */}
      {recall.primaryImage ? (
        <Section style={imageContainer}>
          <Img
            src={recall.primaryImage}
            alt={`${recall.title} - Recall Image`}
            style={recallImage}
          />
        </Section>
      ) : (
        <Section style={imagePlaceholder}>
          {/* Simple placeholder for emails without SVG */}
          <Text style={placeholderText}>No Image Available</Text>
        </Section>
      )}

      {/* Recall Content - matching website structure */}
      <Section style={cardContent}>
        {/* Title - main focus */}
        <Text style={recallTitle}>
          {recall.title}
        </Text>
        
        {/* Date only - no company name to match website */}
        <Text style={recallMeta}>
          {formatDate(recall.recallDate)}
        </Text>


      </Section>
    </Section>
  );
}

// Styles - Matching exact light theme colors from theme.ts
const cardContainer = {
  backgroundColor: '#faf6ed', // cardBackground from light theme
  border: '1px solid #e5e7eb', // cardBorder from light theme
  borderRadius: '16px', // 1rem matching website
  marginBottom: '24px',
  overflow: 'hidden',
};

const imageContainer = {
  backgroundColor: '#faf6ed', // backgroundSecondary from light theme
  textAlign: 'center' as const,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const recallImage = {
  width: '100%',
  height: 'auto',
  maxHeight: '300px', // Reasonable max height for email
  objectFit: 'contain' as const, // Match website's object-fit
  borderRadius: '16px', // 1rem matching website
  display: 'block',
};

const imagePlaceholder = {
  backgroundColor: '#eceae4', // backgroundSecondary from light theme  
  padding: '48px',
  textAlign: 'center' as const,
  borderRadius: '16px 16px 0 0',
};

const placeholderText = {
  color: '#374151', // textSecondary from light theme
  fontSize: '14px',
  margin: '0',
  opacity: 0.6,
};

const cardContent = {
  padding: '16px 20px 20px',
};

const recallTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#111827', // text from light theme
  margin: '0 0 8px',
  lineHeight: '24px',
};

const recallMeta = {
  fontSize: '14px',
  color: '#374151', // textSecondary from light theme
  margin: '0 0 16px',
};


