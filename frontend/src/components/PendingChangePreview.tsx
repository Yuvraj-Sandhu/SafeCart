/**
 * PendingChangePreview Component
 * 
 * A detailed preview component for admin users to review pending changes before
 * approval or rejection. Displays a side-by-side comparison of current vs proposed
 * display customizations with visual highlighting of changed fields.
 * 
 * **Features:**
 * - **Side-by-side comparison**: Current vs Proposed values with visual arrows
 * - **Change highlighting**: Modified fields are visually emphasized
 * - **Comprehensive metadata**: Shows who proposed changes and when
 * - **Source identification**: Clear USDA/FDA tagging with color coding
 * - **Action buttons**: Approve (green) and Reject (red) with loading states
 * 
 * **Field Coverage:**
 * - Preview Title overrides
 * - Preview URL overrides  
 * - Primary Image Index selection
 * - Card Splits configuration
 * - Uploaded Images count
 * 
 * **Visual Design:**
 * - Clean comparison layout with arrows (→) between current and proposed
 * - Color-coded source tags (blue for USDA, red for FDA)
 * - Highlighted changed fields with different background color
 * - Responsive button layout with proper spacing
 * 
 * @component
 * @example
 * ```tsx
 * <PendingChangePreview
 *   change={pendingChangeObject}
 *   onApprove={() => handleApprove(change.id)}
 *   onReject={() => handleReject(change.id)}
 *   loading={isProcessing}
 * />
 * ```
 */

import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { PendingChange } from '@/types/pending-changes.types';
import styles from './PendingChangePreview.module.css';

interface PendingChangePreviewProps {
  /** The pending change object to preview */
  change: PendingChange;
  /** Whether to show action buttons (approve/reject) */
  showActions?: boolean;
  /** Callback function when admin approves the change */
  onApprove?: () => void;
  /** Callback function when admin rejects the change */
  onReject?: () => void;
  /** Loading state during approval/rejection operations */
  loading?: boolean;
}

export function PendingChangePreview({
  change,
  showActions = true,
  onApprove,
  onReject,
  loading = false
}: PendingChangePreviewProps) {
  const { currentTheme } = useTheme();

  /**
   * Formats ISO date strings into user-friendly display format.
   * Uses Eastern Time format with full date and time information.
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Renders a comparison field showing current vs proposed values.
   * Highlights changed fields with visual emphasis.
   * 
   * @param label - Display label for the field
   * @param current - Current value (from existing display data)
   * @param proposed - Proposed new value (from pending change)
   * @param isChanged - Whether the values are different (triggers highlighting)
   */
  const renderField = (label: string, current: any, proposed: any, isChanged: boolean) => (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldComparison}>
        {/* Current value display */}
        <div className={styles.fieldValue}>
          <div className={styles.valueLabel}>Current:</div>
          <div className={styles.valueContent}>
            {current ? String(current) : <em>Not set</em>}
          </div>
        </div>
        
        {/* Visual arrow separator */}
        <div className={styles.arrow}>→</div>
        
        {/* Proposed value display with conditional highlighting */}
        <div className={`${styles.fieldValue} ${isChanged ? styles.changed : ''}`}>
          <div className={styles.valueLabel}>Proposed:</div>
          <div className={styles.valueContent}>
            {proposed ? String(proposed) : <em>Not set</em>}
          </div>
        </div>
      </div>
    </div>
  );

  // Extract current and proposed display data from full recall data
  const current = change.originalRecall?.display || {};
  const proposed = change.proposedDisplay;
  const recall = change.originalRecall;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 style={{ color: currentTheme.text }}>
            Change Preview
          </h3>
          <div 
            className={styles.sourceTag}
            style={{
              backgroundColor: change.recallSource === 'USDA' 
                ? 'var(--usda-color, #2563eb)' 
                : 'var(--fda-color, #dc2626)',
              color: 'white'
            }}
          >
            {change.recallSource}
          </div>
        </div>
        
        <div className={styles.metaInfo}>
          <div style={{ color: currentTheme.textSecondary }}>
            <strong>Proposed by:</strong> {change.proposedBy.username} ({change.proposedBy.email})
          </div>
          <div style={{ color: currentTheme.textSecondary }}>
            <strong>Proposed at:</strong> {formatDate(change.proposedAt)}
          </div>
          <div style={{ color: currentTheme.textSecondary }}>
            <strong>Recall ID:</strong> {change.recallId}
          </div>
        </div>
      </div>

      {/* Recall Information Section */}
      {recall && (
        <div className={styles.recallInfo}>
          <h4 style={{ color: currentTheme.text }}>Recall Information</h4>
          <div className={styles.recallDetails}>
            <div style={{ color: currentTheme.textSecondary }}>
              <strong>Title:</strong> {recall.productTitle || recall.field_title || 'N/A'}
            </div>
            <div style={{ color: currentTheme.textSecondary }}>
              <strong>Company:</strong> {recall.recallingFirm || recall.recalling_firm || 'N/A'}
            </div>
            <div style={{ color: currentTheme.textSecondary }}>
              <strong>Date:</strong> {recall.recallDate || recall.report_date || 'N/A'}
            </div>
            <div style={{ color: currentTheme.textSecondary }}>
              <strong>Classification:</strong> {recall.classification || recall.field_risk_level || 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.changes}>
          <h4 style={{ color: currentTheme.text }}>Proposed Changes</h4>
          
          {renderField(
            'Preview Title',
            current.previewTitle,
            proposed.previewTitle,
            current.previewTitle !== proposed.previewTitle
          )}
          
          {renderField(
            'Preview URL',
            current.previewUrl,
            proposed.previewUrl,
            current.previewUrl !== proposed.previewUrl
          )}
          
          {renderField(
            'Primary Image Index',
            current.primaryImageIndex,
            proposed.primaryImageIndex,
            current.primaryImageIndex !== proposed.primaryImageIndex
          )}
          
          {/* Card Splits */}
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Card Splits</div>
            <div className={styles.fieldComparison}>
              <div className={styles.fieldValue}>
                <div className={styles.valueLabel}>Current:</div>
                <div className={styles.valueContent}>
                  {current.cardSplits?.length && current.cardSplits.length > 0 
                    ? `${current.cardSplits.length} split${current.cardSplits.length > 1 ? 's' : ''}`
                    : <em>None</em>
                  }
                </div>
              </div>
              <div className={styles.arrow}>→</div>
              <div className={`${styles.fieldValue} ${
                (current.cardSplits?.length || 0) !== (proposed.cardSplits?.length || 0) 
                  ? styles.changed : ''
              }`}>
                <div className={styles.valueLabel}>Proposed:</div>
                <div className={styles.valueContent}>
                  {proposed.cardSplits?.length && proposed.cardSplits.length > 0 
                    ? `${proposed.cardSplits.length} split${proposed.cardSplits.length > 1 ? 's' : ''}`
                    : <em>None</em>
                  }
                </div>
              </div>
            </div>
          </div>
          
          {/* Uploaded Images */}
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Uploaded Images</div>
            <div className={styles.fieldComparison}>
              <div className={styles.fieldValue}>
                <div className={styles.valueLabel}>Current:</div>
                <div className={styles.valueContent}>
                  {current.uploadedImages?.length && current.uploadedImages.length > 0 
                    ? `${current.uploadedImages.length} image${current.uploadedImages.length > 1 ? 's' : ''}`
                    : <em>None</em>
                  }
                </div>
              </div>
              <div className={styles.arrow}>→</div>
              <div className={`${styles.fieldValue} ${
                (current.uploadedImages?.length || 0) !== (proposed.uploadedImages?.length || 0) 
                  ? styles.changed : ''
              }`}>
                <div className={styles.valueLabel}>Proposed:</div>
                <div className={styles.valueContent}>
                  {proposed.uploadedImages?.length && proposed.uploadedImages.length > 0 
                    ? `${proposed.uploadedImages.length} image${proposed.uploadedImages.length > 1 ? 's' : ''}`
                    : <em>None</em>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showActions && onApprove && onReject && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={loading}
            style={{ fontSize: '1rem' }}
          >
            {loading ? 'Approving...' : 'Approve Changes'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={onReject}
            disabled={loading}
            style={{ 
              fontSize: '1rem',
              backgroundColor: currentTheme.danger,
              color: 'white',
              border: 'none'
            }}
          >
            Reject Changes
          </Button>
        </div>
      )}
    </div>
  );
}