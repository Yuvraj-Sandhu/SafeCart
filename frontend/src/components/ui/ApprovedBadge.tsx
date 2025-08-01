/**
 * ApprovedBadge Component
 * 
 * A badge component that indicates a recall has been approved through the review process.
 * Shows "Approved" text with theme.info color and displays detailed approval information
 * in a tooltip on hover.
 * 
 * **Tooltip Information:**
 * - Approved by: Admin who approved the changes
 * - Proposed by: Member who originally proposed the changes
 * - Approved at: Date and time of approval
 * 
 * @component
 * @example
 * ```tsx
 * <ApprovedBadge 
 *   approvedBy="admin@example.com"
 *   proposedBy="member@example.com" 
 *   approvedAt="2024-01-15T10:30:00Z"
 * />
 * ```
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { UserInfo } from '@/types/display';
import styles from './PendingBadge.module.css'; // Reuse the same CSS

interface ApprovedBadgeProps {
  /** UserInfo of admin who approved the changes */
  approvedBy: UserInfo | string;
  /** UserInfo of member who proposed the changes (optional for direct admin edits) */
  proposedBy?: UserInfo | string;
  /** ISO timestamp of when the changes were approved */
  approvedAt: string;
  /** Additional CSS classes */
  className?: string;
}

export function ApprovedBadge({ 
  approvedBy, 
  proposedBy, 
  approvedAt, 
  className = '' 
}: ApprovedBadgeProps) {
  const { currentTheme } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLSpanElement>(null);

  // Helper function to get username from UserInfo object or string
  const getUsername = (user: UserInfo | string): string => {
    if (typeof user === 'string') {
      return user;
    }
    return user.username;
  };

  // Update tooltip position when showing
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const badgeRect = badgeRef.current.getBoundingClientRect();
      
      // Position tooltip directly above the badge
      const badgeCenterX = badgeRect.left + badgeRect.width / 2;
      const top = badgeRect.top - 10; // Small gap above badge, let tooltip extend upward naturally
      
      setTooltipPosition({ 
        top, 
        left: badgeCenterX
      });
    }
  }, [showTooltip]);

  // Format the approval date for display
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <>
      <span
        ref={badgeRef}
        className={`${styles.badge} ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          // Use theme.info color for approved badges
          color: currentTheme.info,
          borderColor: currentTheme.info,
          backgroundColor: 'transparent',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          fontSize: '0.875rem',
          padding: '0.25rem 0.5rem',
          fontWeight: 700,
          border: '2px solid',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        Approved
      </span>
      
      {/* Tooltip rendered as portal to avoid overflow clipping */}
      {showTooltip && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)', // Center horizontally and position above badge
            fontSize: '0.875rem',
            fontWeight: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            background: currentTheme.cardBackground,
            color: currentTheme.textSecondary,
            padding: '8px 12px',
            borderRadius: '6px',
            boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            border: `1px solid ${currentTheme.cardBorder}`,
            pointerEvents: 'none',
            width: 'fit-content',
          }}
        >
          <div>Approved by: {getUsername(approvedBy)}</div>
          {proposedBy && <div>Proposed by: {getUsername(proposedBy)}</div>}
          <div>Approved at: {formatDate(approvedAt)}</div>
          
          {/* Tooltip Arrow - positioned to point back to badge */}
          <div
            style={{
              position: 'absolute',
              content: '""',
              height: '8px',
              width: '8px',
              background: currentTheme.cardBackground,
              border: `1px solid ${currentTheme.cardBorder}`,
              borderTop: 'none',
              borderLeft: 'none',
              bottom: '-5px',
              left: '50%',
              transform: 'translate(-50%) rotate(45deg)'
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}