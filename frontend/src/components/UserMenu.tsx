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
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { PendingBadge } from './ui/PendingBadge';
import styles from './UserMenu.module.css';

export function UserMenu() {
  const { currentTheme } = useTheme();
  const { 
    internal_user, 
    account_user, 
    isInternalAuthenticated, 
    isAccountAuthenticated, 
    internalLogout, 
    accountLogout 
  } = useAuth();
  const { pendingChanges } = usePendingChanges();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  
  // Check if we're on an account/public page
  const isAccountPage = pathname === '/' || pathname?.startsWith('/account');
  
  // Don't render for internal pages without internal auth
  if (!isAccountPage && !isInternalAuthenticated) return null;

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
    if (isAccountPage) {
      // For account pages, use account logout
      accountLogout();
      router.push('/account/login');
    } else {
      // For internal pages, use internal logout with confirmation
      if (confirm('Are you sure you want to logout?')) {
        internalLogout();
      }
    }
    setIsOpen(false);
  };

  const handlePendingClick = () => {
    // Navigate to appropriate pending page based on role
    if (internal_user?.role === 'admin') {
      window.location.href = '/internal/admin/pending';
    } else {
      window.location.href = '/internal/pending';
    }
    setIsOpen(false);
  };

  // Get menu options based on page and auth status
  const getMenuOptions = () => {
    if (isAccountPage) {
      // Account/Public page menu options
      if (pathname === '/') {
        // Home page
        if (isAccountAuthenticated) {
          return [
            { label: 'Manage Alerts', onClick: () => { router.push('/account/alerts'); setIsOpen(false); } },
            { label: 'Logout', onClick: handleLogout }
          ];
        } else {
          return [
            { label: 'Login', onClick: () => { router.push('/account/login'); setIsOpen(false); } },
            { label: 'Sign Up', onClick: () => { router.push('/account/signup'); setIsOpen(false); } }
          ];
        }
      } else if (pathname === '/account/login') {
        return [
          { label: 'Home', onClick: () => { router.push('/'); setIsOpen(false); } },
          { label: 'Sign Up', onClick: () => { router.push('/account/signup'); setIsOpen(false); } }
        ];
      } else if (pathname === '/account/signup') {
        return [
          { label: 'Home', onClick: () => { router.push('/'); setIsOpen(false); } },
          { label: 'Login', onClick: () => { router.push('/account/login'); setIsOpen(false); } }
        ];
      } else if (pathname === '/account/alerts') {
        return [
          { label: 'Home', onClick: () => { router.push('/'); setIsOpen(false); } },
          { label: 'Logout', onClick: handleLogout }
        ];
      }
    }
    
    // Internal pages - return null, will use original menu
    return null;
  };

  const accountMenuOptions = getMenuOptions();

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
          {/* Show account menu for account pages */}
          {accountMenuOptions ? (
            <>
              {/* Welcome section for normal account users only (not internal users) */}
              {isAccountAuthenticated && (
                <>
                  <div className={styles.welcomeSection}>
                    <div className={styles.welcomeText} style={{ color: currentTheme.text }}>
                      Welcome! {account_user?.name || 'User'}
                    </div>
                  </div>
                  
                  {/* Menu divider */}
                  <div 
                    className={styles.divider}
                    style={{ backgroundColor: currentTheme.cardBorder }}
                  />
                </>
              )}
              
              {/* Account menu options */}
              {accountMenuOptions.map((option, index) => (
                <button
                  key={index}
                  className={`${styles.menuItem} ${option.label === 'Logout' ? styles.logout : ''}`}
                  onClick={option.onClick}
                  style={{ color: currentTheme.text }}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {/* Internal pages menu - original implementation */}
              {/* Welcome section with user info and badges */}
              <div className={styles.welcomeSection}>
                <div className={styles.welcomeText} style={{ color: currentTheme.text }}>
                  Welcome! {internal_user?.username}
                </div>
                <div className={styles.badges}>
                  <span 
                    className={styles.roleBadge}
                    style={{ 
                      color: internal_user?.role === 'admin' ? currentTheme.warning : currentTheme.info,
                      borderColor: internal_user?.role === 'admin' ? currentTheme.warning : currentTheme.info,
                      backgroundColor: 'transparent'
                    }}
                  >
                    {internal_user?.role}
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
                      backgroundColor: internal_user?.role === 'admin' ? currentTheme.warning : currentTheme.info,
                      color: 'white'
                    }}
                  >
                    {pendingChanges.length}
                  </span>
                )}
              </button>
              
              {/* Logout button */}
              <button 
                className={`${styles.menuItem} ${styles.logout}`}
                onClick={handleLogout}
              >
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}