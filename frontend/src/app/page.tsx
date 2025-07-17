'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { RecallList } from '@/components/RecallList';
import { US_STATES } from '@/data/states';
import { api, filterRecallsByDateRange, Recall } from '@/services/api';
import styles from './page.module.css';

export default function Home() {
  const { currentTheme, mode, toggleTheme } = useTheme();
  
  // Filter states
  const [selectedState, setSelectedState] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Data states
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Check server health on mount
  useEffect(() => {
    api.getHealth().catch(() => {
      setError('Backend server is not running. Please start the server on port 3001.');
    });
  }, []);

  const handleSearch = async () => {
    if (!selectedState) {
      setError('Please select a state');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.getRecallsByState(selectedState);
      let filteredRecalls = response.data;
      
      // Apply date filtering if dates are selected
      if (startDate || endDate) {
        filteredRecalls = filterRecallsByDateRange(filteredRecalls, startDate, endDate);
      }
      
      setRecalls(filteredRecalls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recalls');
      setRecalls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedState('');
    setStartDate(null);
    setEndDate(null);
    setRecalls([]);
    setError(null);
    setHasSearched(false);
  };

  return (
    <main className={styles.main}>
      <div className="container">
        <header className={styles.header}>
          <div>
            <h1 style={{ color: currentTheme.primary }}>SafeCart</h1>
            <p style={{ color: currentTheme.textSecondary }}>
              Search and filter USDA food recall data
            </p>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={toggleTheme}
          >
            {mode === 'light' ? '🌙' : '☀️'} {mode === 'light' ? 'Dark' : 'Light'} Mode
          </Button>
        </header>

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
              <Select
                options={US_STATES}
                value={selectedState}
                onChange={setSelectedState}
                placeholder="Choose a state..."
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
