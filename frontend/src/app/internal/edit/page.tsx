'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { US_STATES } from '@/data/states';
import { api } from '@/services/api';
import { useUserLocation } from '@/hooks/useUserLocation';
import { UnifiedRecall } from '@/types/recall.types';
import { EditModalState } from '@/types/display';
import styles from '../../page.module.css';

export default function InternalEditPage() {
  const { currentTheme, mode, toggleTheme } = useTheme();
  const { location, isLoading: isLocationLoading } = useUserLocation();
  const hasInitialSearched = useRef(false);
  const hasUserInteracted = useRef(false);
  
  // Filter states
  const [selectedState, setSelectedState] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Advanced options states
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [filterNoImages, setFilterNoImages] = useState(false);
  const [showUSDARecalls, setShowUSDARecalls] = useState(true);
  const [showFDARecalls, setShowFDARecalls] = useState(true);
  
  // Data states
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savingRecallId, setSavingRecallId] = useState<string | null>(null);
  
  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    recall: UnifiedRecall | null;
  }>({
    isOpen: false,
    recall: null
  });

  // Check server health on mount
  useEffect(() => {
    api.getHealth().catch(() => {
      setError('Backend server is not running. Please start the server on port 3001.');
    });
  }, []);

  // Auto-select state based on location
  useEffect(() => {
    if (hasUserInteracted.current || isLocationLoading) return;

    if (location && location.stateCode) {
      // Convert state code to full state name using the location from hook
      const stateName = Object.entries(require('@/utils/stateMapping').STATE_NAME_TO_CODE).find(
        ([name, code]) => code === location.stateCode
      )?.[0];
      
      if (stateName) {
        setSelectedState(stateName);
        return;
      }
    }
    
    // Default to California if no location or location processing failed
    if (!isLocationLoading) {
      setSelectedState('California');
    }
  }, [isLocationLoading, location]);

  // Auto-select Last 30 Days preset on page load
  useEffect(() => {
    const { startDate, endDate } = require('@/utils/easternTime').getLast30DaysEastern();
    setStartDate(startDate);
    setEndDate(endDate);
  }, []);

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
      
      let response;
      
      if (selectedState === 'ALL') {
        // Get all recalls from all states
        response = await api.getAllUnifiedRecalls('BOTH', startDateStr, endDateStr);
      } else {
        // Get recalls for specific state
        response = await api.getUnifiedRecallsByState(selectedState, 'BOTH', startDateStr, endDateStr);
      }
      
      setRecalls(response.data);
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
    hasInitialSearched.current = false;
    
    // Reset advanced options
    setShowAdvancedOptions(false);
    setFilterNoImages(false);
    setShowUSDARecalls(true);
    setShowFDARecalls(true);
  };

  const handleEdit = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall
    });
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // The EditModal has already saved the data to the backend,
    // so we only need to update the local state here
    
    // Update local state with the new data
    setRecalls(prev => prev.map(r => 
      r.id === updatedRecall.id ? updatedRecall : r
    ));
    
    // Close modal
    setEditModal({ isOpen: false, recall: null });
    
    console.log('Display data updated successfully');
  };

  // Filter recalls based on advanced options
  const getFilteredRecalls = () => {
    let filtered = recalls;

    // Filter by source (USDA/FDA)
    if (!showUSDARecalls || !showFDARecalls) {
      filtered = filtered.filter(recall => {
        if (recall.source === 'USDA' && !showUSDARecalls) return false;
        if (recall.source === 'FDA' && !showFDARecalls) return false;
        return true;
      });
    }

    // Filter by image presence
    if (filterNoImages) {
      filtered = filtered.filter(recall => {
        // Check both processed images and uploaded images
        const hasProcessedImages = recall.images && recall.images.length > 0;
        const hasUploadedImages = recall.display?.uploadedImages && recall.display.uploadedImages.length > 0;
        
        // Return recalls that have NO images (neither processed nor uploaded)
        return !hasProcessedImages && !hasUploadedImages;
      });
    }

    return filtered;
  };

  return (
    <main className={styles.main}>
      <a
        role='button'
        tabIndex={0}
        onClick={toggleTheme}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggleTheme();
        }}
        className={styles.themeToggle}
      >
            {mode === 'light' ? (
              // Moon icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="#000000"
                viewBox="0 0 49.739 49.739"
                height="36"
                width="36"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
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
              // Sun icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="40"
                width="40"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              >
                <path d="M12 3V4M12 20V21M4 12H3M6.31412 6.31412L5.5 5.5M17.6859 6.31412L18.5 5.5M6.31412 17.69L5.5 18.5001M17.6859 17.69L18.5 18.5001M21 12H20M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z" />
              </svg>
            )}
      </a>
      
      <div className="container">
        <header className={styles.header}>
          <div>
            <h1 style={{ color: currentTheme.primary }}>SafeCart</h1>
            <p style={{ color: currentTheme.textSecondary }}>
              Internal Editor
            </p>
          </div>
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
              <AutocompleteInput
                options={US_STATES}
                value={selectedState}
                onChange={handleStateChange}
                placeholder="Enter your state..."
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

          {/* Advanced Options */}
          <div className={styles.advancedOptions}>
            <div 
              className={styles.advancedToggle}
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              style={{ 
                color: currentTheme.textTertiary,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.875rem',
                marginBottom: showAdvancedOptions ? '1rem' : '0'
              }}
            >
              Advanced options {showAdvancedOptions ? '▲' : '▼'}
            </div>
            
            {showAdvancedOptions && (
              <div className={styles.advancedFilters}>
                <div 
                  className={styles.filterOption}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: currentTheme.text,
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
                  }}
                >
                  <input 
                    type="checkbox" 
                    id="filterNoImagesInput"
                    checked={filterNoImages}
                    onChange={(e) => setFilterNoImages(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <label htmlFor="filterNoImagesInput" className={styles.toggleSwitch}></label>
                  <span>Show only recalls without images</span>
                </div>
                
                <div 
                  className={styles.filterOption}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: currentTheme.text,
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
                  }}
                >
                  <input 
                    type="checkbox" 
                    id="showUSDARecallsInput"
                    checked={showUSDARecalls}
                    onChange={(e) => setShowUSDARecalls(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <label htmlFor="showUSDARecallsInput" className={styles.toggleSwitch}></label>
                  <span>USDA recalls</span>
                </div>
                
                <div 
                  className={styles.filterOption}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: currentTheme.text,
                    fontSize: '0.875rem'
                  }}
                >
                  <input 
                    type="checkbox" 
                    id="showFDARecallsInput"
                    checked={showFDARecalls}
                    onChange={(e) => setShowFDARecalls(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <label htmlFor="showFDARecallsInput" className={styles.toggleSwitch}></label>
                  <span>FDA recalls</span>
                </div>
              </div>
            )}
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
            <EditableRecallList
              recalls={getFilteredRecalls()}
              loading={loading}
              error={error}
              onEdit={handleEdit}
            />
          </div>
        )}

        {editModal.isOpen && editModal.recall && (
          <EditModal
            recall={editModal.recall}
            onClose={() => setEditModal({ isOpen: false, recall: null })}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </main>
  );
}