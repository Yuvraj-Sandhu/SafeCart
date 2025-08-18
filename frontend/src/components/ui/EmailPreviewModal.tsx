'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import styles from './EmailPreviewModal.module.css';

interface EmailDigest {
  id: string;
  type: 'manual' | 'usda_daily' | 'fda_weekly' | 'test';
  sentAt: Date;
  sentBy: string;
  recallCount: number;
  totalRecipients: number;
  recalls: Array<{
    id: string;
    title: string;
    source: 'USDA' | 'FDA';
  }>;
  emailHtml?: string;
}

interface EmailPreviewModalProps {
  digest: EmailDigest;
  onClose: () => void;
}

export function EmailPreviewModal({ digest, onClose }: EmailPreviewModalProps) {
  const { currentTheme } = useTheme();

  const getTypeLabel = (type: EmailDigest['type']) => {
    switch (type) {
      case 'manual': return 'Manual Digest';
      case 'usda_daily': return 'USDA Daily Digest';
      case 'fda_weekly': return 'FDA Weekly Digest';
      case 'test': return 'Test Email';
      default: return 'Unknown';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return (
    <div className={styles.modalOverlay}>
      <div 
        className={styles.modalContent}
        style={{
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.cardBorder
        }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerInfo}>
            <h2 style={{ color: currentTheme.text, margin: 0 }}>
              {getTypeLabel(digest.type)}
            </h2>
            <div className={styles.headerMeta}>
              <span style={{ color: currentTheme.textSecondary }}>
                Sent by {digest.sentBy} • {formatDate(digest.sentAt)}
              </span>
            </div>
          </div>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            style={{ color: currentTheme.textSecondary }}
          >
            ×
          </button>
        </div>


        {/* Email Preview */}
        <div className={styles.emailPreview}>
          <div 
            className={styles.emailFrame}
            style={{
              backgroundColor: 'white',
              borderColor: currentTheme.cardBorder
            }}
          >
            {digest.emailHtml ? (
              <iframe 
                srcDoc={digest.emailHtml}
                className={styles.emailIframe}
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div 
                className={styles.noPreview}
                style={{ 
                  color: currentTheme.textSecondary,
                  backgroundColor: `${currentTheme.textSecondary}10`
                }}
              >
                <p>Email preview not available</p>
                <p>This digest was sent before HTML storage was implemented.</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.modalActions}>
          <Button onClick={onClose} variant="primary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}