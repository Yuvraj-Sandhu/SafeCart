'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { api } from '@/services/api';
import { RecallList } from '@/components/RecallList';
import { UnifiedRecall } from '@/types/recall.types';

interface ProcessedImage {
  filename: string;
  storageUrl: string;
  type: 'pdf-page' | 'image' | 'error';
  pageNumber?: number;
}

interface RecallDetail {
  id: string;
  recallNumber: string;
  source: 'USDA' | 'FDA';
  title: string;
  company: string;
  summary: string;
  recallDate: string;
  riskLevel: string;
  affectedStates: string[];
  isActive: boolean;
  images: ProcessedImage[];
  primaryImage?: string;
  recallUrl?: string;
}

interface RecallDetailClientProps {
  initialRecall: RecallDetail | null;
  recallId: string;
}

export default function RecallDetailClient({ initialRecall, recallId }: RecallDetailClientProps) {
  const router = useRouter();
  const [recall, setRecall] = useState<RecallDetail | null>(initialRecall);
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

  // Convert RecallDetail to UnifiedRecall format for RecallList
  const convertToUnifiedRecall = (detail: RecallDetail): UnifiedRecall => {
    return {
      id: detail.id,
      recallNumber: detail.recallNumber,
      source: detail.source,
      isActive: detail.isActive,
      classification: detail.riskLevel,
      recallingFirm: detail.company,
      productTitle: detail.title,
      productDescription: detail.summary,
      reasonForRecall: detail.summary,
      recallDate: detail.recallDate,
      recallInitiationDate: detail.recallDate,
      recallUrl: detail.recallUrl,
      affectedStates: detail.affectedStates,
      images: detail.images,
      originalData: detail
    };
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
    const text = encodeURIComponent(`Check out this food recall: ${recall?.title || ''}`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const unifiedRecall = recall ? [convertToUnifiedRecall(recall)] : [];

  if (error && !loading) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Recall Not Found</h2>
          <p>{error || 'The requested recall could not be found.'}</p>
          <button onClick={() => router.push('/')} className={styles.primaryButton}>
            View All Recalls
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <h1>SafeCart</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Use RecallList to display the single recall */}
        <RecallList 
          recalls={unifiedRecall}
          loading={loading}
          error={error}
          hideSearch={true}
          hideScrollTop={true}
          hideEndIndicator={true}
          hideBottomSpacer={true}
        />

        {/* Share Section */}
        {recall && (
          <div className={styles.shareSection}>
            <h3>Share This Recall</h3>
            <div className={styles.shareButtons}>
              <button onClick={copyLink} className={styles.shareButton}>
                {showCopiedMessage ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={shareOnFacebook} className={styles.shareButton}>
                Facebook
              </button>
              <button onClick={shareOnTwitter} className={styles.shareButton}>
                Twitter
              </button>
              <button onClick={shareOnLinkedIn} className={styles.shareButton}>
                LinkedIn
              </button>
            </div>
          </div>
        )}

        {/* View More CTA */}
        <div className={styles.viewMoreSection}>
          <button onClick={() => router.push('/')} className={styles.viewMoreButton}>
            View More Recalls
          </button>
          <p className={styles.viewMoreText}>
            Stay informed about the latest food recalls in your area
          </p>
        </div>
      </main>
    </div>
  );
}