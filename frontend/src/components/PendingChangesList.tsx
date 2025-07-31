/**
 * PendingChangesList Component
 * 
 * A scrollable list component that displays all pending changes awaiting admin
 * review. Provides quick actions for approval/rejection and detailed information
 * about each change for efficient workflow management.
 * 
 * **Features:**
 * - **Selectable items**: Click to select change for detailed preview
 * - **Quick actions**: Approve/Reject buttons directly in the list
 * - **Smart descriptions**: Auto-generates change descriptions from proposed data
 * - **Source identification**: Clear USDA/FDA visual tags with color coding
 * - **User attribution**: Shows who proposed each change and when
 * - **Loading states**: Handles both list loading and individual action loading
 * 
 * **List Item Information:**
 * - Recall ID (truncated for space)
 * - Source tag (USDA blue / FDA red)
 * - Proposer username and timestamp
 * - Intelligent change description (e.g., "Title override, 3 uploaded images")
 * - Direct action buttons (Approve/Reject)
 * 
 * **Interactive States:**
 * - Selected item highlighting with accent color
 * - Loading states during approve/reject operations
 * - Empty state when no pending changes exist
 * - Global loading state during initial fetch
 * 
 * @component
 * @example
 * ```tsx
 * <PendingChangesList
 *   changes={pendingChanges}
 *   selectedChange={currentlySelected}
 *   onSelectChange={setSelectedChange}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 *   actionLoading={processingChangeId}
 *   loading={isLoadingList}
 * />
 * ```
 */

import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { PendingChange } from '@/types/pending-changes.types';
import styles from './PendingChangesList.module.css';

interface PendingChangesListProps {
  /** Array of pending changes to display */
  changes: PendingChange[];
  /** Currently selected change for preview */
  selectedChange: PendingChange | null;
  /** Callback when user selects a change from the list */
  onSelectChange: (change: PendingChange) => void;
  /** Whether to show action buttons (approve/reject) */
  showActions?: boolean;
  /** Callback for approving a specific change */
  onApprove?: (changeId: string) => void;
  /** Callback for rejecting a specific change */
  onReject?: (changeId: string) => void;
  /** ID of change currently being processed (for loading states) */
  actionLoading?: string | null;
  /** Global loading state for the entire list */
  loading?: boolean;
}

export function PendingChangesList({
  changes,
  selectedChange,
  onSelectChange,
  showActions = true,
  onApprove,
  onReject,
  actionLoading,
  loading = false
}: PendingChangesListProps) {
  const { currentTheme } = useTheme();

  /**
   * Formats ISO date strings into compact display format.
   * Optimized for list display with abbreviated month names.
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Generates intelligent change descriptions by analyzing proposed display data.
   * Creates user-friendly summaries like "Title override, 3 uploaded images, Card splits".
   * 
   * @param change - The pending change object to analyze
   * @returns Human-readable description of the proposed changes
   */
  const getChangeDescription = (change: PendingChange) => {
    const changes = [];
    
    // Check each type of change and add descriptive text
    if (change.proposedDisplay.previewTitle) {
      changes.push('Title override');
    }
    
    if (change.proposedDisplay.previewUrl) {
      changes.push('URL override');
    }
    
    if (change.proposedDisplay.primaryImageIndex !== undefined) {
      changes.push('Primary image');
    }
    
    if (change.proposedDisplay.cardSplits && change.proposedDisplay.cardSplits.length > 0) {
      changes.push('Card splits');
    }
    
    if (change.proposedDisplay.uploadedImages && change.proposedDisplay.uploadedImages.length > 0) {
      changes.push(`${change.proposedDisplay.uploadedImages.length} uploaded image${change.proposedDisplay.uploadedImages.length > 1 ? 's' : ''}`);
    }
    
    // Return comma-separated list or fallback description
    return changes.length > 0 ? changes.join(', ') : 'Display changes';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 style={{ color: currentTheme.text }}>Pending Changes</h3>
        </div>
        <div className={styles.loading}>
          <p style={{ color: currentTheme.textSecondary }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 style={{ color: currentTheme.text }}>Pending Changes</h3>
        </div>
        <div className={styles.empty}>
          <p style={{ color: currentTheme.textSecondary }}>
            No pending changes to review
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 style={{ color: currentTheme.text }}>
          Pending Changes ({changes.length})
        </h3>
      </div>
      
      <div className={styles.list}>
        {changes.map((change) => (
          <div
            key={change.id}
            className={`${styles.changeItem} ${
              selectedChange?.id === change.id ? styles.selected : ''
            }`}
            onClick={() => onSelectChange(change)}
            style={{
              backgroundColor: selectedChange?.id === change.id 
                ? currentTheme.primary
                : currentTheme.cardBackground,
              borderColor: selectedChange?.id === change.id 
                ? currentTheme.primary 
                : currentTheme.cardBorder,
              color: currentTheme.text
            }}
          >
            <div className={styles.changeHeader}>
              <div className={styles.changeInfo}>
                <div className={styles.recallNumber}>
                  {change.recallId.substring(0, 8)}...
                </div>
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
              
              <div className={styles.proposedBy}>
                <div className={styles.userName}>{change.proposedBy.username}</div>
                <div 
                  className={styles.date}
                  style={{ color: currentTheme.textSecondary }}
                >
                  {formatDate(change.proposedAt)}
                </div>
              </div>
            </div>
            
            <div className={styles.changeDescription}>
              <p style={{ color: currentTheme.textSecondary }}>
                {getChangeDescription(change)}
              </p>
            </div>
            
            {showActions && onApprove && onReject && (
              <div className={styles.changeActions}>
                <Button
                  variant="primary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(change.id);
                  }}
                  disabled={actionLoading === change.id}
                  style={{ fontSize: '0.75rem' }}
                >
                  {actionLoading === change.id ? 'Approving...' : 'Approve'}
                </Button>
                
                <Button
                  variant="secondary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject(change.id);
                  }}
                  disabled={actionLoading === change.id}
                  style={{ 
                    fontSize: '0.75rem',
                    backgroundColor: currentTheme.danger,
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}