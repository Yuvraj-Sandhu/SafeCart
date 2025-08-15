/**
 * PendingBadge Component
 * 
 * A role-aware badge component that displays pending change counts with different
 * styles and messaging based on user role and context.
 * 
 * **Role-based Display:**
 * - **Admin Users**: Shows "Pending Review" or "X Pending" for changes awaiting approval
 * - **Member Users**: Shows "Submitted" or "X Submitted" for their submitted changes
 * 
 * **Color Coding:**
 * - Admin badges use warning colors (amber/orange)
 * - Member badges use info colors (blue)
 * 
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <PendingBadge count={5} />
 * 
 * // Single item badge
 * <PendingBadge count={1} />
 * ```
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './PendingBadge.module.css';

interface PendingBadgeProps {
  /** Number of pending changes to display (defaults to 1) */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export function PendingBadge({ count = 1, className = '' }: PendingBadgeProps) {
  const { currentTheme } = useTheme();
  const { internal_user } = useAuth();

  // Only render for authenticated internal users
  if (!internal_user) return null;

  /**
   * Generates role-appropriate badge text.
   * Admins see "Pending Review" language, members see "Submitted" language.
   */
  const badgeText = internal_user.role === 'admin' 
    ? (count > 1 ? `${count} Pending` : 'Pending Review')
    : (count > 1 ? `${count} Submitted` : 'Submitted');

  return (
    <span
      className={`${styles.badge} ${className}`}
      style={{
        // Role-based color scheme: warning (amber) for admins, info (blue) for members
        // Using border styling to match other tags (USDA, Active, Class I, etc.)
        color: internal_user.role === 'admin' 
          ? currentTheme.warning
          : currentTheme.info,
        borderColor: internal_user.role === 'admin' 
          ? currentTheme.warning
          : currentTheme.info,
        backgroundColor: 'transparent',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        fontSize: '0.875rem',
        padding: '0.25rem 0.5rem',
        fontWeight: 700,
        border: '2px solid',
        borderRadius: '0.5rem'
      }}
    >
      {badgeText}
    </span>
  );
}