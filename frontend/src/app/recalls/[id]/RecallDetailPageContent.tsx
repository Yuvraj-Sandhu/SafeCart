'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { RecallList } from '@/components/RecallList';
import { UnifiedRecall } from '@/types/recall.types';
import { Button } from '@/components/ui/Button';
import { ShareMenu } from '@/components/ui/ShareMenu';
import { formatRecallDate } from '@/utils/dateUtils';
import styles from './RecallDetailPageContent.module.css';

interface ProcessedImage {
  filename: string;
  storageUrl: string;
  type: 'pdf-page' | 'image' | 'error';
  pageNumber?: number;
}

interface RecallDetailPageContentProps {
  initialRecall: UnifiedRecall | null;
  recallId: string;
}

export default function RecallDetailPageContent({ initialRecall, recallId }: RecallDetailPageContentProps) {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const [recall, setRecall] = useState<UnifiedRecall | null>(initialRecall);
  const [loading, setLoading] = useState(!initialRecall);
  const [error, setError] = useState<string | null>(null);
  const [showAllStates, setShowAllStates] = useState(false);

  useEffect(() => {
    if (!initialRecall && recallId) {
      fetchRecallDetails();
    }
  }, [initialRecall, recallId]);

  const fetchRecallDetails = async () => {
    try {
      const data = await api.getRecallById(recallId);
      setRecall(data.recall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recall');
    } finally {
      setLoading(false);
    }
  };



  const unifiedRecall = recall ? [recall] : [];

  if (error && !loading) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <h2 style={{ color: currentTheme.text }}>Recall Not Found</h2>
          <p style={{ color: currentTheme.textSecondary }}>
            {error || 'The requested recall could not be found.'}
          </p>
          <Button 
            variant="primary"
            size='large'
            onClick={() => router.push('/')}
            className={styles.primaryButton}
          >
            View All Recalls
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContent}>
      {/* Context Banner - Helps receivers understand what they're looking at */}
      {recall && (
        <div
          className={styles.contextBanner}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
          }}
        >
          <div className={styles.contextHeader}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z"
                fill={currentTheme.text}
              />
            </svg>
            <h2 style={{ color: currentTheme.text }}>Important Food Recall Alert</h2>
          </div>
          <p className={styles.contextDescription} style={{ color: currentTheme.textSecondary }}>
            This product has been recalled and may pose health risks. Check if you have this item and take appropriate action.
          </p>
        </div>
      )}

      {/* Affected States Section */}
      {recall && recall.affectedStates && recall.affectedStates.length > 0 && (
        <div
          className={styles.affectedStates}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
            marginBottom: '1.5rem',
          }}
        >
          <h3 style={{ color: currentTheme.text }}>Affected States</h3>
          <div className={styles.statesList}>
            {(showAllStates ? recall.affectedStates : recall.affectedStates.slice(0, 10)).map(state => (
              <span
                key={state}
                className={styles.stateBadge}
                style={{
                  backgroundColor: currentTheme.primary + '20',
                  color: currentTheme.primary,
                  borderColor: currentTheme.primary,
                }}
              >
                {state}
              </span>
            ))}
            {recall.affectedStates.length > 10 && !showAllStates && (
              <button
                className={styles.moreStatesButton}
                onClick={() => setShowAllStates(true)}
                style={{
                  backgroundColor: currentTheme.textSecondary + '20',
                  color: currentTheme.textSecondary,
                  borderColor: currentTheme.textSecondary,
                }}
              >
                +{recall.affectedStates.length - 10} more
              </button>
            )}
            {showAllStates && recall.affectedStates.length > 10 && (
              <button
                className={styles.moreStatesButton}
                onClick={() => setShowAllStates(false)}
                style={{
                  backgroundColor: currentTheme.textSecondary + '20',
                  color: currentTheme.textSecondary,
                  borderColor: currentTheme.textSecondary,
                }}
              >
                Show less
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Recall Display */}
      <div className={styles.recallSection}>
        <RecallList
          recalls={unifiedRecall}
          loading={loading}
          error={error}
          hideSearch={true}
          hideScrollTop={true}
          hideEndIndicator={true}
          hideBottomSpacer={true}
        />
      </div>

      {/* What Should I Do Section */}
      {recall && (
        <div
          className={styles.actionSection}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
          }}
        >
          <h3 style={{ color: currentTheme.text }}>What Should I Do?</h3>
          <div className={styles.actionSteps}>
            <div className={styles.actionStep}>
              <div className={styles.stepNumber} style={{ backgroundColor: currentTheme.primary }}>
                1
              </div>
              <div className={styles.stepContent}>
                <h4 style={{ color: currentTheme.text }}>Check Your Products</h4>
                <p style={{ color: currentTheme.textSecondary }}>
                  Look for this product in your refrigerator, freezer, or pantry.
                </p>
              </div>
            </div>
            <div className={styles.actionStep}>
              <div className={styles.stepNumber} style={{ backgroundColor: currentTheme.primary }}>
                2
              </div>
              <div className={styles.stepContent}>
                <h4 style={{ color: currentTheme.text }}>Do Not Consume</h4>
                <p style={{ color: currentTheme.textSecondary }}>
                  If you have this product, do not eat it. Dispose of it immediately or return it to the store.
                </p>
              </div>
            </div>
            <div className={styles.actionStep}>
              <div className={styles.stepNumber} style={{ backgroundColor: currentTheme.primary }}>
                3
              </div>
              <div className={styles.stepContent}>
                <h4 style={{ color: currentTheme.text }}>Monitor Your Health</h4>
                <p style={{ color: currentTheme.textSecondary }}>
                  If you've consumed this product and feel unwell, contact your healthcare provider.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Section with new ShareMenu */}
      {recall && (
        <div className={styles.shareWrapper}>
          <ShareMenu recallTitle={recall.productTitle} />
          <p className={styles.shareText} style={{ color: currentTheme.textSecondary }}>
            Help keep your friends and family safe by sharing this recall
          </p>
        </div>
      )}

      {/* View More CTA */}
      <div className={styles.ctaSection}>
        <Button
          variant="primary"
          size='large'
          onClick={() => router.push('/')}
        >
          View All Active Recalls
        </Button>
        <p
          className={styles.ctaText}
          style={{ color: currentTheme.textSecondary }}
        >
          Stay informed about food safety in your area
        </p>
      </div>
    </div>
  );
}