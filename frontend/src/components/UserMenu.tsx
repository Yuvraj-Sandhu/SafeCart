/**
 * UserMenu Component
 * 
 * A compact burger menu interface that provides user information and navigation.
 * Uses a three-line hamburger icon that opens to reveal user details and actions.
 * 
 * **Features:**
 * - Burger icon (three horizontal lines) as trigger
 * - Welcome message with username and role badge
 * - Pending changes section with count badge
 * - Logout option with confirmation
 * - Click-outside-to-close functionality
 * 
 * **Menu Structure:**
 * 1. Welcome [Username] [Role Badge] [Pending Badge if applicable]
 * 2. Pending (with count if any) - for all users
 * 3. Logout
 * 
 * **Responsive Design:**
 * - Compact burger icon saves space
 * - Dropdown menu positions appropriately on all screen sizes
 * - Theme-aware styling throughout
 * 
 * @component
 * @example
 * ```tsx
 * // In header navigation
 * <header>
 *   <div>App Title</div>
 *   <UserMenu />
 * </header>
 * ```
 */

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { PendingBadge } from './ui/PendingBadge';
import styles from './UserMenu.module.css';

export function UserMenu() {
  const { currentTheme } = useTheme();
  const { user, logout } = useAuth();
  const { pendingChanges } = usePendingChanges();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Only render for authenticated users
  if (!user) return null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handles logout with user confirmation.
   * Uses native browser confirm dialog for security.
   */
  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
    setIsOpen(false);
  };

  const handlePendingClick = () => {
    // Navigate to appropriate pending page based on role
    if (user.role === 'admin') {
      window.location.href = '/internal/admin/pending';
    } else {
      window.location.href = '/internal/pending';
    }
    setIsOpen(false);
  };

  return (
    <div className={styles.userMenu} ref={menuRef}>
      {/* Burger menu trigger */}
      <button 
        className={styles.burgerButton}
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          backgroundColor: 'transparent',
          color: currentTheme.text 
        }}
        aria-label="User menu"
      >
        {/* Burger icon - three horizontal lines */}
        <div className={`${styles.hamburgerIcon} ${isOpen ? styles.open : ''}`}>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className={styles.dropdown}
          style={{ 
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
            boxShadow: `0 4px 12px ${currentTheme.shadowLight}`
          }}
        >
          {/* Welcome section with user info and badges */}
          <div className={styles.welcomeSection}>
            <div className={styles.welcomeText} style={{ color: currentTheme.text }}>
              Welcome! {user.username}
            </div>
            <div className={styles.badges}>
              <span 
                className={styles.roleBadge}
                style={{ 
                  color: user.role === 'admin' ? currentTheme.warning : currentTheme.info,
                  borderColor: user.role === 'admin' ? currentTheme.warning : currentTheme.info,
                  backgroundColor: 'transparent'
                }}
              >
                {user.role}
              </span>
            </div>
          </div>
          
          {/* Menu divider */}
          <div 
            className={styles.divider}
            style={{ backgroundColor: currentTheme.cardBorder }}
          />
          
          {/* Pending section - for all users */}
          <button 
            className={styles.menuItem}
            onClick={handlePendingClick}
          >
            <span>Pending</span>
            {pendingChanges.length > 0 && (
              <span 
                className={styles.menuCount}
                style={{ 
                  backgroundColor: user.role === 'admin' ? currentTheme.warning : currentTheme.info,
                  color: 'white'
                }}
              >
                {pendingChanges.length}
              </span>
            )}
          </button>
          
          {/* Logout button */}
          <button 
            className={styles.menuItem}
            onClick={handleLogout}
          >
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}