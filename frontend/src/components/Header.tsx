/**
 * Header Component
 * 
 * A reusable header component that provides consistent branding and navigation
 * across all pages in the SafeCart application. Uses a 3-column flex layout
 * for consistent positioning and height.
 * 
 * **Layout:**
 * - **Left Column**: Theme toggle (always present if enabled)
 * - **Center Column**: SafeCart title and subtitle (always centered)
 * - **Right Column**: User menu (if authenticated) or empty space
 * 
 * **Features:**
 * - **Consistent Height**: Same height regardless of subtitle or user menu presence
 * - **Centered Content**: Title and subtitle always perfectly centered
 * - **Responsive**: Adapts to mobile layouts while maintaining structure
 * 
 * @component
 * @example
 * ```tsx
 * // Login page
 * <Header subtitle="Login" showUserMenu={false} />
 * 
 * // Internal editor
 * <Header subtitle="Internal Editor">
 *   <Button>Back to Edit</Button>
 * </Header>
 * 
 * // Admin dashboard  
 * <Header subtitle="Admin Dashboard" />
 * ```
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/UserMenu';
import styles from './Header.module.css';

interface HeaderProps {
  /** Subtitle text to display below SafeCart title */
  subtitle?: string;
  /** Whether to show the theme toggle button (default: true) */
  showThemeToggle?: boolean;
  /** Whether to show the user menu (default: true) */
  showUserMenu?: boolean;
  /** Additional content to display below the header */
  children?: React.ReactNode;
}

export function Header({
  subtitle,
  showThemeToggle = true,
  showUserMenu = true,
  children
}: HeaderProps) {
  const { currentTheme, mode, toggleTheme } = useTheme();

  return (
    <>
      {/* Full-width Header */}
      <header className={styles.header}>
        {/* Left Column: Theme Toggle */}
        <div className={styles.leftColumn}>
          {showThemeToggle && (
            <button
              type="button"
              onClick={toggleTheme}
              className={styles.themeToggle}
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {mode === 'light' ? (
                // Moon icon for light mode (switch to dark)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="#000000"
                  viewBox="0 0 49.739 49.739"
                  height="45"
                  width="45"
                  style={{ display: 'block' }}
                >
                  <path d="M25.068,48.889c-9.173,0-18.017-5.06-22.396-13.804C-3.373,23.008,1.164,8.467,13.003,1.979l2.061-1.129l-0.615,2.268 
                    c-1.479,5.459-0.899,11.25,1.633,16.306c2.75,5.493,7.476,9.587,13.305,11.526c5.831,1.939,12.065,1.492,17.559-1.258v0 
                    c0.25-0.125,0.492-0.258,0.734-0.391l2.061-1.13l-0.585,2.252c-1.863,6.873-6.577,12.639-12.933,15.822 
                    C32.639,48.039,28.825,48.888,25.068,48.889z 
                    M12.002,4.936c-9.413,6.428-12.756,18.837-7.54,29.253 
                    c5.678,11.34,19.522,15.945,30.864,10.268c5.154-2.582,9.136-7.012,11.181-12.357c-5.632,2.427-11.882,2.702-17.752,0.748 
                    c-6.337-2.108-11.473-6.557-14.463-12.528C11.899,15.541,11.11,10.16,12.002,4.936z" />
                </svg>
              ) : (
                // Sun icon for dark mode (switch to light)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  height="45"
                  width="45"
                  style={{ display: 'block' }}
                >
                  <path d="M12 3V4M12 20V21M4 12H3M6.31412 6.31412L5.5 5.5M17.6859 6.31412L18.5 5.5M6.31412 17.69L5.5 18.5001M17.6859 17.69L18.5 18.5001M21 12H20M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Center Column: Title and Subtitle */}
        <div className={styles.centerColumn}>
          <h1 style={{ color: currentTheme.primary }}>SafeCart</h1>
          {subtitle && (
            <p style={{ color: currentTheme.textSecondary }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Column: User Menu */}
        <div className={styles.rightColumn}>
          {showUserMenu && <UserMenu />}
        </div>
      </header>

      {/* Additional content below header */}
      {children && (
        <div className="container">
          <div className={styles.headerContent}>
            {children}
          </div>
        </div>
      )}
    </>
  );
}