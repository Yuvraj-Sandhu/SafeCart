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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            <h2 style={{ 
              fontSize: '2rem', 
              fontWeight: 600, 
              color: currentTheme.text,
              margin: 0
            }}>
              Recent Alerts
            </h2>
            <div 
              style={{ 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px'
              }}
              className="info-tooltip-container"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ 
                  opacity: 0.8,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as SVGElement).style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  (e.target as SVGElement).style.opacity = '0.8';
                }}
              >
                <circle cx="12" cy="12" r="10" stroke={currentTheme.textSecondary} strokeWidth="1.5" />
                <path d="M12 17V11" stroke={currentTheme.textSecondary} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 11 9)" fill={currentTheme.textSecondary} />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  marginLeft: '8px',
                  backgroundColor: currentTheme.cardBackground,
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  color: currentTheme.text,
                  whiteSpace: 'nowrap',
                  boxShadow: `0 2px 6px ${currentTheme.shadowLight}`,
                  opacity: 0,
                  visibility: 'hidden',
                  transition: 'opacity 0.2s ease, visibility 0.2s ease',
                  zIndex: 1000,
                  pointerEvents: 'none'
                }}
                className="info-tooltip"
              >
                Recent FDA alerts awaiting official recall classification
              </div>
              <style dangerouslySetInnerHTML={{
                __html: `
                  .info-tooltip-container:hover .info-tooltip {
                    opacity: 1 !important;
                    visibility: visible !important;
                  }
                  
                  @media (max-width: 768px) {
                    .info-tooltip {
                      left: 50% !important;
                      top: calc(100% + 8px) !important;
                      transform: translateX(-50%) !important;
                      margin-left: calc(50vw - 261px) !important;
                      white-space: nowrap !important;
                      text-align: center !important;
                    }
                  }
                `
              }} />
            </div>
          </div>
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