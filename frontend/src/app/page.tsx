'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Header } from '@/components/Header';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { RecallList } from '@/components/RecallList';
import { US_STATES } from '@/data/states';
import { api } from '@/services/api';
import { UnifiedRecall } from '@/types/recall.types';
import { useUserLocation } from '@/hooks/useUserLocation';
import styles from './page.module.css';

export default function Home() {
  const { currentTheme } = useTheme();
  const { location, isLoading: isLocationLoading } = useUserLocation();
  const hasInitialSearched = useRef(false);
  const hasUserInteracted = useRef(false);
  const hasCheckedHealth = useRef(false);
  
  // Filter states
  const [selectedState, setSelectedState] = useState('');
  const [detectedState, setDetectedState] = useState(''); // Track the auto-detected state
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Data states
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Check server health on mount
  useEffect(() => {
    // Prevent double API call in React StrictMode
    if (hasCheckedHealth.current) return;
    hasCheckedHealth.current = true;
    
    api.getHealth().catch(() => {
      setError('Backend server is not running. Please start the server on port 3001.');
    });
  }, []);

  // Auto-select state based on location
  useEffect(() => {
    // Skip if user has manually interacted with state selection or still loading location
    if (hasUserInteracted.current || isLocationLoading) return;

    if (location && location.stateCode) {
      // Convert state code to full state name using the location from hook
      const stateName = Object.entries(require('@/utils/stateMapping').STATE_NAME_TO_CODE).find(
        ([name, code]) => code === location.stateCode
      )?.[0];
      
      if (stateName) {
        setSelectedState(stateName);
        setDetectedState(stateName); // Save the detected state
        return;
      }
    }
    
    // Default to California if no location or location processing failed
    if (!isLocationLoading) {
      setSelectedState('California');
      setDetectedState('California'); // Save California as detected default
    }
  }, [isLocationLoading, location]); // Keep dependencies but avoid double API calls

  // Auto-select Last 30 Days preset on page load
  useEffect(() => {
    const { startDate, endDate } = require('@/utils/easternTime').getLast30DaysEastern();
    setStartDate(startDate);
    setEndDate(endDate);
  }, []); // Run once on mount

  // Wrapper function to handle state changes and mark user interaction
  const handleStateChange = (newState: string) => {
    hasUserInteracted.current = true;
    setSelectedState(newState);
  };

  const handleSearch = async () => {
    if (!selectedState) {
      setError('Please select a state');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Format dates for API
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // Fetch regular recalls and temp recalls in parallel
      const promises = [];
      
      if (selectedState === 'ALL') {
        // Get all recalls from all states
        promises.push(api.getAllUnifiedRecalls('BOTH', startDateStr, endDateStr));
        promises.push(api.getAllTempRecalls(500, startDateStr, endDateStr));
      } else {
        // Get recalls for specific state
        promises.push(api.getUnifiedRecallsByState(selectedState, 'BOTH', startDateStr, endDateStr));
        promises.push(api.getTempRecallsByState(selectedState, 500, startDateStr, endDateStr)); // Limit temp recalls to 500
      }
      
      const [recallsResponse, tempRecallsResponse] = await Promise.allSettled(promises);
      
      // Handle regular recalls
      let regularRecalls: UnifiedRecall[] = [];
      if (recallsResponse.status === 'fulfilled') {
        regularRecalls = recallsResponse.value.data;
      } else {
        setError('Failed to fetch recalls');
      }
      
      // Handle temp recalls
      let tempRecallsData: UnifiedRecall[] = [];
      if (tempRecallsResponse.status === 'fulfilled') {
        tempRecallsData = tempRecallsResponse.value.data;
      }
      
      // Merge temp recalls with regular recalls and sort by date (newest first)
      const allRecalls = [...tempRecallsData, ...regularRecalls].sort((a, b) => {
        // Use recallInitiationDate if available, otherwise fall back to recallDate
        const dateA = a.recallInitiationDate || a.recallDate || '';
        const dateB = b.recallInitiationDate || b.recallDate || '';
        // Sort in descending order (newest first)
        return dateB.localeCompare(dateA);
      });
      setRecalls(allRecalls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recalls');
      setRecalls([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger search once when initial data is ready
  useEffect(() => {
    if (selectedState && startDate && endDate && !hasInitialSearched.current && !loading) {
      hasInitialSearched.current = true;
      handleSearch();
    }
  }, [selectedState, startDate, endDate]);

  const handleReset = () => {
    hasUserInteracted.current = false; // Allow auto-location to work again
    setSelectedState('');
    setStartDate(null);
    setEndDate(null);
    setRecalls([]);
    setError(null);
    setHasSearched(false);
  };

  return (
    <main className={styles.main}>
      <Header subtitle="Protecting You from Food Recalls" />
      
      <div className="container">
        <div 
          className={styles.filterCard}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
          }}
        >
          <h2 style={{ color: currentTheme.text }}>Filter Recalls</h2>
          
          <div className={styles.filterGrid}>
            <div className={styles.filterSection}>
              <label 
                className={styles.label}
                style={{ color: currentTheme.textSecondary }}
              >
                Select State
              </label>
              <AutocompleteInput
                options={US_STATES}
                value={selectedState}
                onChange={handleStateChange}
                placeholder="Enter your state..."
                detectedValue={detectedState}
              />
            </div>

            <div className={styles.filterSection}>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </div>
          </div>

          <div className={styles.filterActions}>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search Recalls'}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Reset Filters
            </Button>
          </div>
        </div>

        {hasSearched && (
          <div className={styles.results}>
            {/* Show all recalls (temp + regular) */}
            <RecallList
              recalls={recalls}
              loading={loading}
              error={error}
            />
          </div>
        )}
      </div>
    </main>
  );
}
