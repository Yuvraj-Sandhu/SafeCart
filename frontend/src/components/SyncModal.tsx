/**
 * SyncModal Component
 * 
 * Modal for selecting recall sync options - USDA, FDA API, or FDA IRES scraping
 * Allows admins to choose sync method and parameters
 */

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { api } from '@/services/api';
import styles from './SyncModal.module.css';

interface SyncModalProps {
  onClose: () => void;
  onSyncStarted?: () => void;
}

export function SyncModal({ onClose, onSyncStarted }: SyncModalProps) {
  const { currentTheme } = useTheme();
  
  // State for sync method selection
  const [syncMethod, setSyncMethod] = useState<'usda' | 'fda-api' | 'fda-ires'>('usda');
  
  // State for API sync options
  const [apiDays, setApiDays] = useState(60);
  const [apiDaysInput, setApiDaysInput] = useState('60');
  
  // State for IRES sync options
  const [iresWeeks, setIresWeeks] = useState(4);
  const [showWeeksDropdown, setShowWeeksDropdown] = useState(false);
  
  // Loading state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  // Refs for dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Weeks options
  const weeksOptions = [
    { value: 0, label: 'New recalls only (since last weekly)' },
    { value: 1, label: 'Last 1 week' },
    { value: 2, label: 'Last 2 weeks' },
    { value: 3, label: 'Last 3 weeks' },
    { value: 4, label: 'Last 4 weeks (recommended)' },
    { value: 5, label: 'Last 5 weeks' },
    { value: 6, label: 'Last 6 weeks' },
  ];
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWeeksDropdown(false);
      }
    };
    
    if (showWeeksDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWeeksDropdown]);
  
  const handleApiDaysChange = (value: string) => {
    setApiDaysInput(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 365) {
      setApiDays(num);
    }
  };
  
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    
    try {
      if (syncMethod === 'usda') {
        // Trigger USDA sync
        setSyncMessage('Starting USDA sync...');
        await api.triggerUsdaSync();
        setSyncMessage(`USDA sync started successfully!`);
      } else if (syncMethod === 'fda-api') {
        // Use the validated apiDays value
        const daysToSync = apiDays;
        // Trigger OpenFDA API sync
        setSyncMessage('Starting OpenFDA API sync...');
        await api.triggerFdaSync(daysToSync);
        setSyncMessage(`OpenFDA API sync started successfully for last ${daysToSync} days!`);
      } else {
        // Trigger IRES sync
        setSyncMessage('Starting FDA IRES scraper sync...');
        await api.triggerFdaIresSync(iresWeeks);
        const weeksText = iresWeeks === 0 
          ? 'new recalls only' 
          : `last ${iresWeeks} week${iresWeeks !== 1 ? 's' : ''}`;
        setSyncMessage(`FDA IRES sync started successfully for ${weeksText}!`);
      }
      
      // Notify parent component
      if (onSyncStarted) {
        onSyncStarted();
      }
      
      // Auto close after 3 seconds on success
      setTimeout(() => {
        onClose();
      }, 3000);
      
    } catch (error) {
      setSyncMessage(`Error: ${error instanceof Error ? error.message : 'Failed to start sync'}`);
    } finally {
      setIsSyncing(false);
    }
  };
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={styles.backdrop}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={styles.modal}
        style={{ 
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.cardBorder,
          color: currentTheme.text,
          boxShadow: `0 20px 60px ${currentTheme.shadow}`
        }}
      >
        {/* Header */}
        <div 
          className={styles.header}
          style={{ borderColor: currentTheme.cardBorder }}
        >
          <h2 style={{ color: currentTheme.text }}>Sync Recalls</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
            style={{ color: currentTheme.textSecondary }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path 
                d="M15 5L5 15M5 5l10 10" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className={styles.content}>
          {/* Sync method selection */}
          <div className={styles.section}>
            <label className={styles.label} style={{ color: currentTheme.text }}>Select Sync Method:</label>
            
            <div className={styles.radioGroup}>
              <label 
                className={`${styles.radioOption} ${syncMethod === 'usda' ? styles.selected : ''}`}
                style={{ 
                  borderColor: syncMethod === 'usda' ? currentTheme.primary : currentTheme.cardBorder,
                  backgroundColor: syncMethod === 'usda' ? `${currentTheme.primaryLight}10` : 'transparent'
                }}
              >
                <div className={styles.radioWrapper}>
                  <input
                    type="radio"
                    name="syncMethod"
                    value="usda"
                    checked={syncMethod === 'usda'}
                    onChange={() => setSyncMethod('usda')}
                    disabled={isSyncing}
                    className={styles.radioInput}
                  />
                  <div 
                    className={styles.radioIcon}
                    style={{ 
                      borderColor: syncMethod === 'usda' ? currentTheme.primary : currentTheme.inputBorder,
                      backgroundColor: syncMethod === 'usda' ? currentTheme.primary : 'transparent'
                    }}
                  >
                    {syncMethod === 'usda' && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path 
                          d="M10 3L4.5 8.5L2 6" 
                          stroke="white" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div className={styles.radioLabel}>
                  <span className={styles.radioTitle} style={{ color: currentTheme.text }}>USDA FSIS API</span>
                  <span className={styles.radioDescription} style={{ color: currentTheme.textSecondary }}>
                    Official USDA API - Syncs meat and poultry recalls
                  </span>
                </div>
              </label>
              
              <label 
                className={`${styles.radioOption} ${syncMethod === 'fda-api' ? styles.selected : ''}`}
                style={{ 
                  borderColor: syncMethod === 'fda-api' ? currentTheme.primary : currentTheme.cardBorder,
                  backgroundColor: syncMethod === 'fda-api' ? `${currentTheme.primaryLight}10` : 'transparent'
                }}
              >
                <div className={styles.radioWrapper}>
                  <input
                    type="radio"
                    name="syncMethod"
                    value="fda-api"
                    checked={syncMethod === 'fda-api'}
                    onChange={() => setSyncMethod('fda-api')}
                    disabled={isSyncing}
                    className={styles.radioInput}
                  />
                  <div 
                    className={styles.radioIcon}
                    style={{ 
                      borderColor: syncMethod === 'fda-api' ? currentTheme.primary : currentTheme.inputBorder,
                      backgroundColor: syncMethod === 'fda-api' ? currentTheme.primary : 'transparent'
                    }}
                  >
                    {syncMethod === 'fda-api' && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path 
                          d="M10 3L4.5 8.5L2 6" 
                          stroke="white" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div className={styles.radioLabel}>
                  <span className={styles.radioTitle} style={{ color: currentTheme.text }}>OpenFDA API</span>
                  <span className={styles.radioDescription} style={{ color: currentTheme.textSecondary }}>
                    Official FDA API - More complete data but slower updates
                  </span>
                </div>
              </label>
              
              <label 
                className={`${styles.radioOption} ${syncMethod === 'fda-ires' ? styles.selected : ''}`}
                style={{ 
                  borderColor: syncMethod === 'fda-ires' ? currentTheme.primary : currentTheme.cardBorder,
                  backgroundColor: syncMethod === 'fda-ires' ? `${currentTheme.primaryLight}10` : 'transparent'
                }}
              >
                <div className={styles.radioWrapper}>
                  <input
                    type="radio"
                    name="syncMethod"
                    value="fda-ires"
                    checked={syncMethod === 'fda-ires'}
                    onChange={() => setSyncMethod('fda-ires')}
                    disabled={isSyncing}
                    className={styles.radioInput}
                  />
                  <div 
                    className={styles.radioIcon}
                    style={{ 
                      borderColor: syncMethod === 'fda-ires' ? currentTheme.primary : currentTheme.inputBorder,
                      backgroundColor: syncMethod === 'fda-ires' ? currentTheme.primary : 'transparent'
                    }}
                  >
                    {syncMethod === 'fda-ires' && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path 
                          d="M10 3L4.5 8.5L2 6" 
                          stroke="white" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div className={styles.radioLabel}>
                  <span className={styles.radioTitle} style={{ color: currentTheme.text }}>FDA IRES Scraper</span>
                  <span className={styles.radioDescription} style={{ color: currentTheme.textSecondary }}>
                    Web scraping - Faster updates, gets recalls earlier
                  </span>
                </div>
              </label>
            </div>
          </div>
          
          {/* Options based on selected method */}
          {syncMethod !== 'usda' && (
            <div className={styles.section}>
              {syncMethod === 'fda-api' ? (
              <div className={styles.optionGroup}>
                <label className={styles.label} style={{ color: currentTheme.text }}>
                  Days to sync:
                </label>
                <div className={styles.numberInputWrapper}>
                  <input
                    type="text"
                    value={apiDaysInput}
                    onChange={(e) => handleApiDaysChange(e.target.value)}
                    disabled={isSyncing}
                    className={styles.numberInput}
                    placeholder="Enter days"
                    style={{ 
                      backgroundColor: currentTheme.inputBackground,
                      borderColor: currentTheme.inputBorder,
                      color: currentTheme.text
                    }}
                  />
                  <div className={styles.numberInputButtons}>
                    <button
                      type="button"
                      className={styles.numberInputButton}
                      onClick={() => {
                        const newValue = Math.min(365, (parseInt(apiDaysInput) || 0) + 1);
                        handleApiDaysChange(newValue.toString());
                      }}
                      disabled={isSyncing || parseInt(apiDaysInput) >= 365}
                      aria-label="Increase days"
                    >
                      <svg viewBox="0 0 12 8" fill="none">
                        <path d="M6 2L10 6L2 6L6 2Z" fill="currentColor"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={styles.numberInputButton}
                      onClick={() => {
                        const newValue = Math.max(1, (parseInt(apiDaysInput) || 2) - 1);
                        handleApiDaysChange(newValue.toString());
                      }}
                      disabled={isSyncing || parseInt(apiDaysInput) <= 1}
                      aria-label="Decrease days"
                    >
                      <svg viewBox="0 0 12 8" fill="none">
                        <path d="M6 6L2 2L10 2L6 6Z" fill="currentColor"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <span className={styles.hint} style={{ color: currentTheme.textSecondary }}>
                  {apiDaysInput && !isNaN(parseInt(apiDaysInput)) && parseInt(apiDaysInput) >= 1 && parseInt(apiDaysInput) <= 365
                    ? `Fetches recalls from the last ${apiDays} days`
                    : apiDaysInput === ''
                    ? 'Enter number of days (1-365)'
                    : 'Please enter a valid number between 1 and 365'
                  }
                </span>
              </div>
            ) : (
              <div className={styles.optionGroup}>
                <label className={styles.label} style={{ color: currentTheme.text }}>
                  Weeks to sync:
                </label>
                <div className={styles.selectWrapper} ref={dropdownRef}>
                  {/* Custom dropdown input */}
                  <div
                    className={styles.selectInput}
                    onClick={() => !isSyncing && setShowWeeksDropdown(!showWeeksDropdown)}
                    style={{
                      backgroundColor: currentTheme.inputBackground,
                      borderColor: currentTheme.inputBorder,
                      color: currentTheme.text,
                      cursor: isSyncing ? 'not-allowed' : 'pointer',
                      opacity: isSyncing ? 0.6 : 1
                    }}
                  >
                    <span>
                      {weeksOptions.find(opt => opt.value === iresWeeks)?.label || 'Select weeks'}
                    </span>
                  </div>
                  
                  {/* Dropdown arrow */}
                  <div 
                    className={styles.selectArrow}
                    onClick={() => !isSyncing && setShowWeeksDropdown(!showWeeksDropdown)}
                    style={{ 
                      color: currentTheme.textSecondary,
                      cursor: isSyncing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{
                        transform: showWeeksDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  
                  {/* Dropdown menu */}
                  {showWeeksDropdown && (
                    <div 
                      className={styles.dropdown}
                      style={{
                        backgroundColor: currentTheme.cardBackground,
                        borderColor: currentTheme.cardBorder,
                        boxShadow: `0 4px 12px ${currentTheme.shadowLight}`,
                      }}
                    >
                      {weeksOptions.map((option) => (
                        <div
                          key={option.value}
                          className={styles.dropdownOption}
                          onClick={() => {
                            setIresWeeks(option.value);
                            setShowWeeksDropdown(false);
                          }}
                          style={{
                            backgroundColor: iresWeeks === option.value 
                              ? currentTheme.primaryLight 
                              : 'transparent',
                            color: iresWeeks === option.value 
                              ? currentTheme.textBlack 
                              : currentTheme.text
                          }}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className={styles.hint} style={{ color: currentTheme.textSecondary }}>
                  {iresWeeks === 0 
                    ? 'Fetches only recalls added since the last weekly report'
                    : `Fetches enforcement reports from the last ${iresWeeks} week${iresWeeks !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
            )}
            </div>
          )}
          
          {/* Sync message */}
          {syncMessage && (
            <div 
              className={styles.message}
              style={{ 
                backgroundColor: syncMessage.startsWith('Error') 
                  ? currentTheme.dangerLight 
                  : currentTheme.successLight,
                color: syncMessage.startsWith('Error') 
                  ? currentTheme.danger 
                  : currentTheme.success,
                borderColor: syncMessage.startsWith('Error') 
                  ? currentTheme.danger 
                  : currentTheme.success 
              }}
            >
              <div className={styles.messageIcon}>
                {syncMessage.startsWith('Error') ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path 
                      d="M10 10V6M10 14h.01M18 10a8 8 0 11-16 0 8 8 0 0116 0z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path 
                      d="M7 10l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span>{syncMessage}</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div 
          className={styles.footer}
          style={{ borderColor: currentTheme.cardBorder }}
        >
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSync}
            disabled={
              isSyncing || 
              (syncMethod === 'fda-api' && (!apiDaysInput || parseInt(apiDaysInput) < 1 || parseInt(apiDaysInput) > 365 || isNaN(parseInt(apiDaysInput))))
            }
          >
            {isSyncing ? 'Starting Sync...' : 'Start Sync'}
          </Button>
        </div>
      </div>
    </>
  );
}