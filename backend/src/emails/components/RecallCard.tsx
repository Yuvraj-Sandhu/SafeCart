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
      {/* Primary Image or Placeholder - using table layout for Gmail compatibility */}
      {recall.primaryImage ? (
        <table cellPadding="0" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', position: 'relative' }}>
          <tr>
            <td style={imageContainerWrapper}>
                {/* Image fills the container */}
                {/* Gmail-compatible clickable image with overlay badge */}
                <table cellPadding="0" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tr>
                    <td style={{ position: 'relative', padding: '0', textAlign: 'center' }}>
                      {/* Clickable image */}
                      <Link
                        href={`${process.env.FRONTEND_URL}/recalls/${recall.id}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <Img
                          src={recall.primaryImage}
                          alt={`${recall.title} - Recall Image`}
                          style={recallImageFullHeight}
                        />
                      </Link>
                      
                      {/* Time badge positioned over image using negative margin */}
                      {recall.recallInitiationDate && (
                        <table cellPadding="0" cellSpacing="0" style={{ 
                          width: '100%', 
                          marginTop: '-200px', // Pull badge up to overlay on image
                          borderCollapse: 'collapse'
                        }}>
                          <tr>
                            <td style={{ 
                              padding: '8px',
                              textAlign: 'left',
                              verticalAlign: 'top'
                            }}>
                              <span style={timeBadgeOverlay}>
                                {getRelativeTime(recall.recallInitiationDate)}
                              </span>
                            </td>
                          </tr>
                        </table>
                      )}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
      ) : (
        <table cellPadding="0" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tr>
            <td style={imagePlaceholderWrapper}>
              {/* Placeholder fills the container */}
              <table cellPadding="0" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tr>
                  <td style={{ 
                    ...imagePlaceholderFullHeight,
                    padding: '8px',
                    verticalAlign: 'top',
                    textAlign: 'left'
                  }}>
                    {/* Time badge positioned in top-left */}
                    {recall.recallInitiationDate && (
                      <span style={timeBadgeOverlay}>
                        {getRelativeTime(recall.recallInitiationDate)}
                      </span>
                    )}
                    
                    {/* Placeholder content */}
                    <Link
                      href={`${process.env.FRONTEND_URL}/recalls/${recall.id}`}
                      style={{ 
                        textDecoration: 'none', 
                        display: 'block', 
                        width: '100%', 
                        height: '100%',
                        textAlign: 'center',
                        paddingTop: '60px'
                      }}
                    >
                      <Text style={placeholderText}>No Image Available</Text>
                    </Link>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      )}

      {/* Recall Content - matching website structure */}
      <Section style={cardContent}>
        {/* Title - main focus with link */}
        <Text style={recallTitle}>
          <Link
            href={`${process.env.FRONTEND_URL}/recalls/${recall.id}`}
            style={{ color: '#111827', textDecoration: 'none' }}
          >
            {recall.title}
          </Link>
        </Text>
        
        {/* Affected states instead of date */}
        <Text style={recallMeta}>
          {formatStates(recall.affectedStates)}
        </Text>

        {/* View Details Link */}
        <Text style={{ margin: '0' }}>
          <Link
            href={`${process.env.FRONTEND_URL}/recalls/${recall.id}`}
            style={{ color: '#374151', textDecoration: 'underline', fontSize: '14px' }}
          >
            View Details
          </Link>
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
  backgroundColor: '#faf6ed', // backgroundSecondary from light theme
  textAlign: 'center' as const,
  width: '100%',
  minHeight: '200px', // Ensure consistent height
  verticalAlign: 'top' as const,
};

const recallImage = {
  maxWidth: '100%',
  height: 'auto',
  maxHeight: '200px', // Reduced for narrower cards in grid
  borderRadius: '16px', // 1rem matching website
  display: 'block',
  margin: '0 auto', // Center the image horizontally
};

// Full height image that fills the container from top
const recallImageFullHeight = {
  width: '100%',
  height: '200px', // Fixed height to fill container
  maxHeight: '200px',
  objectFit: 'cover' as const, // Cover to fill the space nicely
  borderRadius: '16px 16px 0 0', // Only round top corners
  display: 'block',
};

const imagePlaceholderWrapper = {
  width: '100%',
  minHeight: '200px', // Match the image container height
  backgroundColor: '#faf6ed', // backgroundSecondary from light theme
  verticalAlign: 'top' as const,
};

const imagePlaceholder = {
  backgroundColor: '#eceae4', // backgroundSecondary from light theme  
  padding: '24px 24px 48px 24px', // Reduced top padding, more bottom padding
  textAlign: 'center' as const,
  borderRadius: '16px',
  minHeight: '120px', // Ensure minimum height
  verticalAlign: 'middle' as const,
  margin: '0 8px 8px 8px', // Remove top margin, keep other margins
};

// Full height placeholder that fills the container from top
const imagePlaceholderFullHeight = {
  backgroundColor: '#eceae4', // backgroundSecondary from light theme  
  borderRadius: '16px 16px 0 0', // Only round top corners
  height: '200px', // Fixed height to match image container
  width: '100%'
};

const placeholderText = {
  color: '#374151', // textSecondary from light theme
  fontSize: '14px',
  margin: '0',
  opacity: 0.6,
};

// Timestamp badge - Gmail-compatible inline version
const timeBadgeInline = {
  display: 'inline-block',
  fontSize: '14px', // 0.875rem
  fontWeight: '600',
  padding: '4px 8px', // 0.25rem 0.5rem
  backgroundColor: '#faf6ed', // cardBackground from light theme
  color: '#374151', // textSecondary from light theme
  border: '1px solid #e5e7eb', // cardBorder from light theme
  borderRadius: '8px', // 0.5rem
  whiteSpace: 'nowrap' as const,
  margin: '0',
  textAlign: 'left' as const,
};

// Timestamp badge that appears overlaid on image
const timeBadgeOverlay = {
  display: 'inline-block',
  fontSize: '14px', // 0.875rem
  fontWeight: '600',
  padding: '4px 8px', // 0.25rem 0.5rem
  backgroundColor: 'rgba(250, 246, 237, 0.95)', // Semi-transparent cardBackground
  color: '#374151', // textSecondary from light theme
  border: '1px solid #e5e7eb', // cardBorder from light theme
  borderRadius: '8px', // 0.5rem
  whiteSpace: 'nowrap' as const,
  margin: '0',
  textAlign: 'left' as const,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Slight shadow for visibility on image
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
  margin: '0 0 4px',
};



