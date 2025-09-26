'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './ShareMenu.module.css';

interface ShareMenuProps {
  recallTitle?: string;
  className?: string;
}

export function ShareMenu({ recallTitle = '', className = '' }: ShareMenuProps) {
  const { currentTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedMessage(true);
      setTimeout(() => {
        setShowCopiedMessage(false);
        setIsOpen(false);
      }, 1500);
    });
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    setIsOpen(false);
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Important food recall alert: ${recallTitle}`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
    setIsOpen(false);
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    setIsOpen(false);
  };

  const shareViaEmail = () => {
    const url = window.location.href;
    const subject = encodeURIComponent(`Important Food Recall: ${recallTitle}`);
    const body = encodeURIComponent(`I wanted to share this important food recall with you:\n\n${recallTitle}\n\nView details: ${url}\n\nStay safe!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setIsOpen(false);
  };

  return (
    <div className={`${styles.shareMenu} ${className}`} ref={menuRef}>
      <button
        className={styles.shareButton}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: currentTheme.cardBackground,
          color: currentTheme.text,
          borderColor: currentTheme.cardBorder,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.shareIcon}
        >
          <path
            d="M12.5 5.5C13.8807 5.5 15 4.38071 15 3C15 1.61929 13.8807 0.5 12.5 0.5C11.1193 0.5 10 1.61929 10 3C10 3.20823 10.0275 3.40989 10.0787 3.60156L5.94718 5.98478C5.48304 5.52839 4.85242 5.25 4.15625 5.25C2.82883 5.25 1.75 6.32883 1.75 7.65625C1.75 8.98367 2.82883 10.0625 4.15625 10.0625C4.85242 10.0625 5.48304 9.78411 5.94718 9.32772L10.0787 11.7109C10.0275 11.9026 10 12.1043 10 12.3125C10 13.6399 11.0788 14.7188 12.4062 14.7188C13.7337 14.7188 14.8125 13.6399 14.8125 12.3125C14.8125 10.9851 13.7337 9.90625 12.4062 9.90625C11.7101 9.90625 11.0795 10.1846 10.6153 10.641L6.48382 8.25778C6.53502 8.06611 6.5625 7.86445 6.5625 7.65625C6.5625 7.44805 6.53502 7.24639 6.48382 7.05472L10.6153 4.67151C11.0795 5.12789 11.7101 5.40625 12.4062 5.40625C12.4375 5.40625 12.4688 5.40417 12.5 5.40625V5.5Z"
            fill="currentColor"
          />
        </svg>
        <span className={styles.shareText}>Share</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={styles.dropdown}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
            boxShadow: `0 4px 12px ${currentTheme.shadowLight}`,
          }}
        >
          <button
            className={styles.menuItem}
            onClick={copyLink}
            style={{ color: currentTheme.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10.5 10.5V13.5C10.5 14.0523 10.0523 14.5 9.5 14.5H2.5C1.94772 14.5 1.5 14.0523 1.5 13.5V6.5C1.5 5.94772 1.94772 5.5 2.5 5.5H5.5M6.5 10.5H13.5C14.0523 10.5 14.5 10.0523 14.5 9.5V2.5C14.5 1.94772 14.0523 1.5 13.5 1.5H6.5C5.94772 1.5 5.5 1.94772 5.5 2.5V9.5C5.5 10.0523 5.94772 10.5 6.5 10.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{showCopiedMessage ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={shareViaEmail}
            style={{ color: currentTheme.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14.5 3.5L8 8.5L1.5 3.5M1.5 12.5C1.5 13.0523 1.94772 13.5 2.5 13.5H13.5C14.0523 13.5 14.5 13.0523 14.5 12.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V12.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Email</span>
          </button>

          <div className={styles.divider} style={{ borderColor: currentTheme.cardBorder }} />

          <button
            className={styles.menuItem}
            onClick={shareOnFacebook}
            style={{ color: currentTheme.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 11.993 2.92547 15.3027 6.75 15.9028V10.3125H4.71875V8H6.75V6.2375C6.75 4.2325 7.94438 3.125 9.77172 3.125C10.6467 3.125 11.5625 3.28125 11.5625 3.28125V5.25H10.5538C9.56 5.25 9.25 5.86672 9.25 6.5V8H11.4688L11.1141 10.3125H9.25V15.9028C13.0745 15.3027 16 11.993 16 8Z"
                fill="#1877F2"
              />
            </svg>
            <span>Facebook</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={shareOnTwitter}
            style={{ color: currentTheme.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12.6 0.75H15L9.65 6.9L16 15.25H11.05L7.2 10.05L2.75 15.25H0.35L6.05 8.7L0 0.75H5.05L8.55 5.55L12.6 0.75ZM11.65 13.75H12.85L4.4 2.15H3.1L11.65 13.75Z"
                fill="currentColor"
              />
            </svg>
            <span>Twitter</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={shareOnLinkedIn}
            style={{ color: currentTheme.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14.8156 0H1.18125C0.528125 0 0 0.515625 0 1.15313V14.8438C0 15.4813 0.528125 16 1.18125 16H14.8156C15.4688 16 16 15.4813 16 14.8469V1.15313C16 0.515625 15.4688 0 14.8156 0ZM4.74687 13.6344H2.37188V5.99687H4.74687V13.6344ZM3.55938 4.95625C2.79688 4.95625 2.18125 4.34063 2.18125 3.58125C2.18125 2.82188 2.79688 2.20625 3.55938 2.20625C4.31875 2.20625 4.93437 2.82188 4.93437 3.58125C4.93437 4.3375 4.31875 4.95625 3.55938 4.95625ZM13.6344 13.6344H11.2625V9.92188C11.2625 9.03438 11.2469 7.89062 10.0281 7.89062C8.79375 7.89062 8.60625 8.8625 8.60625 9.85938V13.6344H6.2375V5.99687H8.5125V7.04063H8.54375C8.85938 6.44063 9.63438 5.80625 10.7875 5.80625C13.1906 5.80625 13.6344 7.3875 13.6344 9.44375V13.6344Z"
                fill="#0077B5"
              />
            </svg>
            <span>LinkedIn</span>
          </button>
        </div>
      )}
    </div>
  );
}