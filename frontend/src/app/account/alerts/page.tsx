'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { US_STATES } from '@/data/states';
import styles from './alerts.module.css';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { STATE_NAME_TO_CODE, STATE_CODE_TO_NAME } from '@/utils/stateMapping';
import { useAuth } from '@/contexts/AuthContext';

function AlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams?.get('welcome') === 'true';
  const { account_user, isAccountAuthenticated, isLoading: isAuthLoading, accountLogout } = useAuth();

  // Email preferences state
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showTestEmailButton, setShowTestEmailButton] = useState(false);

  // Load user preferences on mount
  useEffect(() => {
    // Don't redirect while still loading authentication status
    if (isAuthLoading) return;
    
    if (!isAccountAuthenticated) {
      router.push('/account/login');
      return;
    }
    loadUserPreferences();
  }, [isAccountAuthenticated, isAuthLoading]);

  // Show loading while authentication is being verified
  if (isAuthLoading) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.loading}>
            <p>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  const loadUserPreferences = async () => {
    if (!account_user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/email-preferences`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.emailPreferences) {
          const stateCodes = data.emailPreferences.states || [];
          const stateNames = stateCodes.map((code: string) => STATE_CODE_TO_NAME[code] || code);
          setSelectedStates(stateNames);
          setIsActive(data.emailPreferences.subscribed ?? false);
        }
      } else if (response.status === 401) {
        // Not authenticated, redirect to login
        router.push('/account/login');
      }
    } catch (err) {
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const addState = (state: string) => {
    if (state && !selectedStates.includes(state)) {
      setSelectedStates(prev => [...prev, state]);
    }
  };

  const removeState = (stateToRemove: string) => {
    setSelectedStates(prev => prev.filter(state => state !== stateToRemove));
  };

  const getAvailableStates = () => {
    return US_STATES.filter(state => 
      !selectedStates.includes(state.value) && 
      state.value !== 'Nationwide' // Remove Nationwide to avoid confusion with All States
    );
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/email-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailPreferences: {
            states: selectedStates.map(stateName => STATE_NAME_TO_CODE[stateName] || stateName),
            subscribed: isActive,
          }
        }),
        credentials: 'include',
      });

      if (response.ok) {
        setMessage('Preferences saved successfully!');
        setShowTestEmailButton(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save preferences');
      }
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setError('');
    setMessage('');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/send-test-email`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setMessage('Test email sent! Check your inbox.');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send test email');
      }
    } catch (err) {
      setError('Failed to send test email');
    }
  };

  const handleLogout = () => {
    accountLogout();
    router.push('/account/login');
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Header subtitle="Alert Settings" />
        <div className={styles.loading}>Loading your preferences...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header subtitle="Alert Settings" />
      
      <div className={styles.contentWrapper}>
        {isWelcome && (
          <div className={styles.welcomeBanner}>
            <h2>Welcome to SafeCart!</h2>
            <p>Your account has been created. Configure your recall alert preferences below.</p>
          </div>
        )}

        <div className={styles.mainContent}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Select States</h2>
            <p className={styles.sectionDescription}>
              Add states one at a time to receive recall alerts
            </p>
            
            {/* Selected states list */}
            {selectedStates.length > 0 && (
              <div className={styles.selectedStatesContainer}>
                <div className={styles.selectedStatesHeader}>
                  <span className={styles.selectedStatesCount}>
                    {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className={styles.selectedStatesList}>
                  {selectedStates.map(stateCode => {
                    const state = US_STATES.find(s => s.value === stateCode);
                    return (
                      <div key={stateCode} className={styles.selectedStateTag}>
                        <span>{state?.label || stateCode}</span>
                        <button
                          onClick={() => removeState(stateCode)}
                          className={styles.removeStateButton}
                          aria-label={`Remove ${state?.label || stateCode}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Add state input */}
            {getAvailableStates().length > 0 && (
              <div className={styles.addStateContainer}>
                <label className={styles.inputLabel}>
                  {selectedStates.length === 0 ? 'Choose your first state' : 'Add another state'}
                </label>
                <AutocompleteInput
                  options={getAvailableStates()}
                  value=""
                  onChange={addState}
                  placeholder={selectedStates.length === 0 ? "Select a state..." : "Add another state..."}
                />
              </div>
            )}
            
          </div>

          <div className={styles.section}>
            <div className={styles.statusCard}>
              <div className={styles.statusHeader}>
                <div className={styles.statusIcon}>
                  {isActive ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#22c55e"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 6L12 10.5 8.5 8 7 9.5 10.5 12 7 14.5 8.5 16 12 13.5 15.5 16 17 14.5 13.5 12 17 9.5 15.5 8z" fill="#ef4444"/>
                    </svg>
                  )}
                </div>
                <div className={styles.statusContent}>
                  <h3 className={styles.statusTitle}>
                    {isActive ? 'Alerts Active' : 'Alerts Paused'}
                  </h3>
                  <p className={styles.statusDescription}>
                    {isActive 
                      ? 'You\'ll receive recall notifications based on your preferences' 
                      : 'All recall notifications are currently disabled'}
                  </p>
                </div>
                <div className={styles.statusToggle}>
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <label htmlFor="isActiveToggle" className={styles.toggleSwitch}></label>
                </div>
              </div>
              
              {isActive && selectedStates.length === 0 && (
                <div className={styles.statusWarning}>
                  Select at least one state to receive alerts
                </div>
              )}
              
              {isActive && selectedStates.length > 0 && (
                <div className={styles.statusSummary}>
                  You'll receive immediate email alerts as soon as recalls are issued 
                  for {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {message && (
            <div className={styles.success}>
              {message}
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <Button
              variant="primary"
              size="medium"
              onClick={handleSavePreferences}
              disabled={isSaving || selectedStates.length === 0}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </Button>

            {showTestEmailButton && (
              <Button
                variant="secondary"
                size="medium"
                onClick={handleSendTestEmail}
              >
                Send Test Email
              </Button>
            )}

            <Button
              variant="secondary"
              size="medium"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <Header subtitle="Alert Settings" />
        <div className={styles.loading}>Loading your preferences...</div>
      </div>
    }>
      <AlertsContent />
    </Suspense>
  );
}