'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { RecallList } from '@/components/RecallList';
import { UnifiedRecall } from '@/types/recall.types';
import { Button } from '@/components/ui/Button';
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
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

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


  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    });
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this food recall: ${recall?.productTitle || ''}`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
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

      {/* Share Section */}
      {recall && (
        <div 
          className={styles.shareSection}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder
          }}
        >
          <h3 style={{ color: currentTheme.text }}>Share This Recall</h3>
          <div className={styles.shareButtons}>
            <Button 
              variant="secondary"
              size='medium'
              onClick={copyLink}
            >
              {showCopiedMessage ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button 
              variant="secondary"
              size='medium'
              onClick={shareOnFacebook}
            >
              Facebook
            </Button>
            <Button 
              variant="secondary"
              size='medium'
              onClick={shareOnTwitter}
            >
              Twitter
            </Button>
            <Button 
              variant="secondary"
              size='medium'
              onClick={shareOnLinkedIn}
            >
              LinkedIn
            </Button>
          </div>
        </div>
      )}

      {/* View More CTA */}
      <div className={styles.ctaSection}>
        <Button 
          variant="primary"
          size='large'
          onClick={() => router.push('/')}
        >
          View More Recalls
        </Button>
        <p 
          className={styles.ctaText}
          style={{ color: currentTheme.textSecondary }}
        >
          Stay informed about the latest food recalls in your area
        </p>
      </div>
    </div>
  );
}