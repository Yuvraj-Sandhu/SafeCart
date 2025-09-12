'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { UnifiedRecall } from '@/types/recall.types';
import { RecallList } from './RecallList';
import { EditableRecallList } from './EditableRecallList';

interface TempRecallListProps {
  recalls: UnifiedRecall[];
  loading: boolean;
  error: string | null;
  isEditMode?: boolean;
  onRecallUpdate?: (recall: UnifiedRecall) => void;
  onEdit?: (recall: UnifiedRecall) => void;
  onReview?: (recall: UnifiedRecall) => void;
  showTitle?: boolean;
}

export function TempRecallList({ 
  recalls, 
  loading, 
  error, 
  isEditMode = false,
  onRecallUpdate,
  onEdit,
  onReview,
  showTitle = true
}: TempRecallListProps) {
  const { currentTheme } = useTheme();

  // Don't render anything if no data and not loading
  if (!loading && !error && (!recalls || recalls.length === 0)) {
    return null;
  }

  return (
    <div 
      style={{
        backgroundColor: `${currentTheme.backgroundTertiary}`,
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: `1px solid ${currentTheme.cardBorder}`,
      }}
    >
      {/* Title Section */}
      {showTitle && (
        <div style={{ 
          marginBottom: '1.5rem', 
          textAlign: 'left',
          paddingBottom: '1rem',
          borderBottom: `1px solid ${currentTheme.cardBorder}`
        }}>
          <h2 style={{ 
            fontSize: '2rem', 
            fontWeight: 600,
            marginBottom: '0.5rem', 
            color: currentTheme.text,
            margin: 0
          }}>
            Recent Alerts
          </h2>
          {!loading && !error && recalls && recalls.length > 0 && (
            <p style={{ 
              color: currentTheme.textSecondary,
              fontSize: '0.9rem',
              margin: '0.5rem 0 0 0'
            }}>
              {recalls.length} new {recalls.length === 1 ? 'alert' : 'alerts'} from FDA
            </p>
          )}
        </div>
      )}

      {/* Use existing components based on edit mode */}
      {isEditMode ? (
        <EditableRecallList
          recalls={recalls}
          loading={loading}
          error={error}
          onEdit={onEdit || (() => {})}
          onReview={onReview}
          hidePendingBadges={false}
          hideSearch={true}
        />
      ) : (
        <RecallList
          recalls={recalls}
          loading={loading}
          error={error}
          hideSearch={true}
          hideScrollTop={true}
          hideEndIndicator={true}
          hideBottomSpacer={true}
        />
      )}
    </div>
  );
}