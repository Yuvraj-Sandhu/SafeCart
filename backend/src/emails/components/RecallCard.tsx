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
    recallInitiationDate?: string; // For relative time display
    classification: string;
    description: string;
    reason: string;
    primaryImage?: string;
    recallUrl?: string;
    source: 'USDA' | 'FDA';
    affectedStates?: string[];
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

  const formatStates = (states?: string[]) => {
    if (!states || states.length === 0) {
      return 'Location information unavailable';
    }
    
    // Check if it's nationwide
    if (states.includes('Nationwide') || states.includes('ALL')) {
      return 'Nationwide';
    }
    
    // Format multiple states nicely
    if (states.length > 5) {
      const displayStates = states.slice(0, 5);
      const remaining = states.length - 5;
      return `${displayStates.join(', ')} and ${remaining} more`;
    }
    
    return states.join(', ');
  };

  /**
   * Converts a date string to a relative time format
   * Examples: "2 days ago", "3 weeks ago", "1 month ago"
   * Exactly matching the frontend implementation
   */
  const getRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        return 'Today';
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return `${diffInDays} days ago`;
      } else if (diffInDays < 14) {
        return '1 week ago';
      } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return `${weeks} weeks ago`;
      } else if (diffInDays < 60) {
        return '1 month ago';
      } else if (diffInDays < 365) {
        const months = Math.floor(diffInDays / 30);
        return `${months} months ago`;
      } else if (diffInDays < 730) {
        return '1 year ago';
      } else {
        const years = Math.floor(diffInDays / 365);
        return `${years} years ago`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      return '';
    }
  };

  return (
    <Section style={cardContainer}>
      {/* Primary Image or Placeholder - matching website design */}
      {recall.primaryImage ? (
        <Link
          href={`${process.env.FRONTEND_URL}/recalls/${recall.id}`}
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <Section style={imageContainerWrapper}>
            <Img
              src={recall.primaryImage}
              alt={`${recall.title} - Recall Image`}
              style={recallImage}
            />
            {/* Relative time badge - exactly matching frontend */}
            {recall.recallInitiationDate && (
              <Text style={timeBadge}>
                {getRelativeTime(recall.recallInitiationDate)}
              </Text>
            )}
          </Section>
        </Link>
      ) : (
        <Section style={imagePlaceholderWrapper}>
          <Section style={imagePlaceholder}>
            {/* Simple placeholder for emails without SVG */}
            <Text style={placeholderText}>No Image Available</Text>
          </Section>
          {/* Relative time badge for recalls without images */}
          {recall.recallInitiationDate && (
            <Text style={timeBadge}>
              {getRelativeTime(recall.recallInitiationDate)}
            </Text>
          )}
        </Section>
      )}

      {/* Recall Content - matching website structure */}
      <Section style={cardContent}>
        {/* Title - main focus */}
        <Text style={recallTitle}>
          {recall.title}
        </Text>
        
        {/* Affected states instead of date */}
        <Text style={recallMeta}>
          {formatStates(recall.affectedStates)}
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
  marginBottom: '16px', // Reduced for grid layout
  overflow: 'hidden',
  width: '100%', // Take full width of column
};

const imageContainerWrapper = {
  position: 'relative' as const,
  backgroundColor: '#faf6ed', // backgroundSecondary from light theme
  textAlign: 'center' as const,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px', // Ensure consistent height for centering
};

const recallImage = {
  maxWidth: '100%',
  height: 'auto',
  maxHeight: '200px', // Reduced for narrower cards in grid
  objectFit: 'contain' as const, // Match website's object-fit
  borderRadius: '16px', // 1rem matching website
  display: 'block',
  margin: '0 auto', // Center the image horizontally
};

const imagePlaceholderWrapper = {
  position: 'relative' as const,
  width: '100%',
  minHeight: '200px', // Match the image container height
};

const imagePlaceholder = {
  backgroundColor: '#eceae4', // backgroundSecondary from light theme  
  padding: '32px 24px', // Reduced padding for narrower cards
  textAlign: 'center' as const,
  borderRadius: '16px 16px 0 0',
  height: '100%', // Take full height of wrapper
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const placeholderText = {
  color: '#374151', // textSecondary from light theme
  fontSize: '14px',
  margin: '0',
  opacity: 0.6,
};

// Timestamp badge - exactly matching frontend RecallList.module.css
const timeBadge = {
  position: 'absolute' as const,
  top: '8px', // 0.5rem
  left: '8px', // 0.5rem
  fontSize: '14px', // 0.875rem
  fontWeight: '600',
  padding: '4px 8px', // 0.25rem 0.5rem
  backgroundColor: '#faf6ed', // cardBackground from light theme
  color: '#374151', // textSecondary from light theme
  border: '1px solid #e5e7eb', // cardBorder from light theme
  borderRadius: '8px', // 0.5rem
  backdropFilter: 'blur(8px)',
  zIndex: 1,
  whiteSpace: 'nowrap' as const,
  margin: '0'
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


