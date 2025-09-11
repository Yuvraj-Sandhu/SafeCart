'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { PendingBadge } from './ui/PendingBadge';
import { ProcessedImage } from '@/services/api';
import { UnifiedRecall } from '@/types/recall.types';
import { ImageModal } from './ui/ImageModal';
import { getUnifiedRecallImages } from '@/utils/imageUtils';
import { formatRecallDate } from '@/utils/dateUtils';
import { getRelativeTime } from '@/utils/relativeTime';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import styles from './RecallList.module.css';
import tempStyles from './TempRecallList.module.css';

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
  const { hasPendingChanges, getPendingChangesForRecall } = usePendingChanges();
  const [selectedImageModal, setSelectedImageModal] = useState<{
    images: ProcessedImage[];
    currentIndex: number;
    recallTitle: string;
  } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [displayedRecalls, setDisplayedRecalls] = useState<UnifiedRecall[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Calculate column count based on screen size
  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumnCount(4);
      else if (width >= 1024) setColumnCount(3);
      else if (width >= 640) setColumnCount(2);
      else setColumnCount(1);
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  // Initialize displayed recalls
  useEffect(() => {
    setDisplayedRecalls(recalls);
  }, [recalls]);

  // Create masonry columns
  const createMasonryColumns = (recalls: UnifiedRecall[]) => {
    const columns: UnifiedRecall[][] = Array(columnCount).fill(null).map(() => []);
    recalls.forEach((recall, index) => {
      columns[index % columnCount].push(recall);
    });
    return columns;
  };

  const columns = createMasonryColumns(displayedRecalls);

  const toggleCardExpansion = (recallId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recallId)) {
        newSet.delete(recallId);
      } else {
        newSet.add(recallId);
      }
      return newSet;
    });
  };

  const renderRecallCard = (recall: UnifiedRecall) => {
    const images = getUnifiedRecallImages(recall);
    const displayImage = images?.[0];
    const hasImages = images && images.length > 0;
    const isExpanded = expandedCards.has(recall.id);
    const relativeTime = getRelativeTime(recall.recallInitiationDate);
    const pendingChanges = isEditMode ? getPendingChangesForRecall(recall.id, recall.source) : null;
    const isPending = isEditMode && hasPendingChanges(recall.id, recall.source);

    return (
      <div 
        key={recall.id}
        className={`${styles.recallCard} ${tempStyles.tempRecallCard}`}
        style={{
          borderColor: currentTheme.cardBorder,
          backgroundColor: currentTheme.cardBackground,
        }}
      >
        {/* Recent Alert Badge */}
        <div className={tempStyles.recentBadge}>
          🚨 RECENT ALERT
        </div>

        {/* Pending Changes Badge */}
        {isEditMode && isPending && pendingChanges && (
          <div className={styles.pendingBadgeContainer}>
            <PendingBadge 
              count={pendingChanges.length}
            />
          </div>
        )}

        {/* Image Section */}
        {hasImages && displayImage && (
          <div className={styles.imageContainer}>
            {relativeTime && (
              <div className={`${styles.timeBadge} ${tempStyles.tempTimeBadge}`}>
                {relativeTime}
              </div>
            )}
            
            <img
              src={displayImage.storageUrl || displayImage.sourceUrl}
              alt={recall.productTitle}
              className={styles.productImage}
              onClick={() => setSelectedImageModal({
                images: images,
                currentIndex: 0,
                recallTitle: recall.productTitle
              })}
            />
            
            {images.length > 1 && (
              <div className={styles.imageCount}>
                +{images.length - 1} more
              </div>
            )}
          </div>
        )}

        {/* Content Section */}
        <div className={styles.cardContent}>
          {/* Time badge for cards without images */}
          {!hasImages && relativeTime && (
            <div className={`${styles.timeBadgeNoImage} ${tempStyles.tempTimeBadge}`}>
              {relativeTime}
            </div>
          )}

          <h3 className={`${styles.productTitle} ${tempStyles.tempProductTitle}`}>
            {recall.productTitle}
          </h3>
          
          <p className={styles.companyName}>
            {recall.recallingFirm}
          </p>

          <div className={styles.recallDetails}>
            <span className={styles.recallDate}>
              {formatRecallDate(recall.recallDate)}
            </span>
            <span className={`${styles.classification} ${tempStyles.tempClassification}`}>
              {recall.classification}
            </span>
          </div>

          {/* Description Preview/Full */}
          <div className={styles.descriptionContainer}>
            <p className={`${styles.description} ${isExpanded ? styles.expanded : ''}`}>
              <strong>Reason: </strong>{recall.reasonForRecall}
            </p>
            
            {recall.reasonForRecall.length > 150 && (
              <button
                onClick={() => toggleCardExpansion(recall.id)}
                className={styles.expandButton}
                style={{ color: currentTheme.primary }}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Affected States */}
          {recall.affectedStates && recall.affectedStates.length > 0 && (
            <div className={styles.statesContainer}>
              <strong>Affected States: </strong>
              <span className={styles.statesList}>
                {recall.affectedStates.slice(0, 5).join(', ')}
                {recall.affectedStates.length > 5 && ` +${recall.affectedStates.length - 5} more`}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            {recall.recallUrl && (
              <a 
                href={recall.recallUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.viewDetailsLink}
                style={{ color: currentTheme.primary }}
              >
                View Alert →
              </a>
            )}
            
            {isEditMode && onEdit && (
              <Button 
                variant="secondary" 
                size="small"
                onClick={() => onEdit(recall)}
              >
                Edit
              </Button>
            )}
            
            {isEditMode && onReview && isPending && (
              <Button 
                variant="secondary" 
                size="small"
                onClick={() => onReview(recall)}
              >
                Review Changes
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={tempStyles.tempRecallsSection}>
        {showTitle && (
          <div className={tempStyles.sectionHeader}>
            <h2 className={tempStyles.sectionTitle}>🚨 Recent Alerts</h2>
            <p className={tempStyles.sectionSubtitle}>Latest food safety notifications from FDA alerts</p>
          </div>
        )}
        <div className={styles.loading}>Loading recent alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={tempStyles.tempRecallsSection}>
        {showTitle && (
          <div className={tempStyles.sectionHeader}>
            <h2 className={tempStyles.sectionTitle}>🚨 Recent Alerts</h2>
          </div>
        )}
        <div className={styles.error}>Error loading recent alerts: {error}</div>
      </div>
    );
  }

  if (!recalls || recalls.length === 0) {
    return (
      <div className={tempStyles.tempRecallsSection}>
        {showTitle && (
          <div className={tempStyles.sectionHeader}>
            <h2 className={tempStyles.sectionTitle}>🚨 Recent Alerts</h2>
          </div>
        )}
        <div className={styles.noResults}>No recent alerts available</div>
      </div>
    );
  }

  return (
    <div className={tempStyles.tempRecallsSection}>
      {showTitle && (
        <div className={tempStyles.sectionHeader}>
          <h2 className={tempStyles.sectionTitle}>🚨 Recent Alerts</h2>
          <p className={tempStyles.sectionSubtitle}>
            {recalls.length} new {recalls.length === 1 ? 'alert' : 'alerts'} from FDA
          </p>
        </div>
      )}

      <div 
        ref={containerRef} 
        className={styles.recallListContainer}
        style={{
          '--theme-primary': currentTheme.primary,
          '--theme-card-bg': currentTheme.cardBackground,
          '--theme-card-border': currentTheme.cardBorder,
        } as React.CSSProperties}
      >
        <div className={styles.masonryGrid}>
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={styles.masonryColumn}>
              {column.map(recall => renderRecallCard(recall))}
            </div>
          ))}
        </div>
      </div>

      {selectedImageModal && (
        <ImageModal
          isOpen={true}
          images={selectedImageModal.images}
          currentIndex={selectedImageModal.currentIndex}
          recallTitle={selectedImageModal.recallTitle}
          onClose={() => setSelectedImageModal(null)}
        />
      )}
    </div>
  );
}