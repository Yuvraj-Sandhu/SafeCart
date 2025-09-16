'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { US_STATES } from '@/data/states';
import { api } from '@/services/api';
import { useUserLocation } from '@/hooks/useUserLocation';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { UnifiedRecall } from '@/types/recall.types';
import { EditModalState } from '@/types/display';
import styles from '../../page.module.css';

export default function InternalEditPage() {
  const { currentTheme } = useTheme();
  const { internal_user } = useAuth();
  const { location, isLoading: isLocationLoading } = useUserLocation();
  const { totalPendingCount, refetch: refetchPendingChanges, hasPendingChanges } = usePendingChanges();
  const hasInitialSearched = useRef(false);
  const hasUserInteracted = useRef(false);
  const hasCheckedHealth = useRef(false);
  
  // Filter states
  const [selectedState, setSelectedState] = useState('');
  const [detectedState, setDetectedState] = useState(''); // Track the auto-detected state
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Advanced options states
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [filterNoImages, setFilterNoImages] = useState(false);
  const [showUSDARecalls, setShowUSDARecalls] = useState(true);
  const [showFDARecalls, setShowFDARecalls] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  
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
    // Prevent double API call in React StrictMode
    if (hasCheckedHealth.current) return;
    hasCheckedHealth.current = true;
    
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
        setDetectedState(stateName); // Save the detected state
        return;
      }
    }
    
    // Default to California if no location or location processing failed
    if (!isLocationLoading) {
      setSelectedState('California');
      setDetectedState('California'); // Save California as detected default
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
      
      // Fetch regular recalls and temp recalls in parallel
      const promises = [];
      
      if (selectedState === 'ALL') {
        // Get all recalls from all states - exclude pending changes
        promises.push(api.getAllUnifiedRecalls('BOTH', startDateStr, endDateStr, true));
        promises.push(api.getAllTempRecalls(500, startDateStr, endDateStr, true));
      } else {
        // Get recalls for specific state - exclude pending changes
        promises.push(api.getUnifiedRecallsByState(selectedState, 'BOTH', startDateStr, endDateStr, true));
        promises.push(api.getTempRecallsByState(selectedState, 500, startDateStr, endDateStr, true));
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
        const dateA = a.recallDate || '';
        const dateB = b.recallDate || '';
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
    hasInitialSearched.current = false;
    
    // Reset advanced options
    setShowAdvancedOptions(false);
    setFilterNoImages(false);
    setShowUSDARecalls(true);
    setShowFDARecalls(true);
    setShowApproved(true);
  };

  const handleEdit = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall
    });
  };

  const handleSearchEmptyStates = async () => {
    // Set filters to show only FDA recalls
    setShowUSDARecalls(false);
    setShowFDARecalls(true);
    setSelectedState('ALL');
    
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Format dates for API
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // Fetch ALL FDA recalls (not just nationwide)
      const fdaResponse = await api.getAllFDARecalls(5000, startDateStr, endDateStr);
      
      // Filter for recalls with empty or missing affected states
      const emptyStateRecalls = fdaResponse.data.filter(recall => 
        !recall.affectedStates || recall.affectedStates.length === 0
      );
      
      setRecalls(emptyStateRecalls);
      
      // Show a message about the results
      if (emptyStateRecalls.length === 0) {
        setError('No FDA recalls found with empty states');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch FDA recalls');
      setRecalls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // The EditModal has already saved the data to the backend,
    // so we only need to update the local state here

    if (internal_user?.role === 'admin') {
      // Admin changes are applied immediately - update local state with new data
      setRecalls(prev => prev.map(r => 
        r.id === updatedRecall.id ? updatedRecall : r
      ));
    } else if (internal_user?.role === 'member') {
      // Member changes go to pending queue - remove recall from current list
      // The recall can now be seen in /internal/pending page
      setRecalls(prev => prev.filter(r => r.id !== updatedRecall.id));
    }
    
    // Refresh pending changes count (important for both admin and member actions)
    refetchPendingChanges();
    
    // Close modal
    setEditModal({ isOpen: false, recall: null });
    
    console.log('Display data updated successfully - no page refresh needed');
  };

  // Filter recalls based on advanced options
  const getFilteredRecalls = () => {
    let filtered = recalls;

    // Special case: if both USDA and FDA are off but showApproved is on, show only approved recalls
    if (!showUSDARecalls && !showFDARecalls && showApproved) {
      filtered = filtered.filter(recall => {
        return recall.display && (recall.display.approvedBy || recall.display.lastEditedBy);
      });
    } else {
      // Normal filtering logic
      
      // Filter by source (USDA/FDA)
      if (!showUSDARecalls || !showFDARecalls) {
        filtered = filtered.filter(recall => {
          if (recall.source === 'USDA' && !showUSDARecalls) return false;
          if (recall.source === 'FDA' && !showFDARecalls) return false;
          return true;
        });
      }

      // Filter by approved status (instant client-side filtering)
      if (!showApproved) {
        // Hide approved recalls - show only recalls that have NOT been approved/edited
        filtered = filtered.filter(recall => {
          return !recall.display || (!recall.display.approvedBy && !recall.display.lastEditedBy);
        });
      }
    }

    // Filter by image presence (always apply this filter)
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
    <ProtectedRoute>
      <main className={styles.main}>
        <Header subtitle={`${internal_user?.role === 'admin' ? 'Admin -' : internal_user?.role === 'member' ? 'VA -' : ''} Internal Editor`} />
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
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem'
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
                    id="showApprovedInput"
                    checked={showApproved}
                    onChange={(e) => setShowApproved(e.target.checked)}
                    className={styles.checkboxInput}
                  />
                  <label htmlFor="showApprovedInput" className={styles.toggleSwitch}></label>
                  <span>Show Approved</span>
                </div>
                
                <div 
                  style={{ 
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: `1px solid ${currentTheme.cardBorder}`
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearchEmptyStates();
                    }}
                    style={{
                      color: currentTheme.textTertiary,
                      textDecoration: 'underline',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    Show FDA recalls with empty states
                  </a>
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
              {/* Show all recalls (temp + regular) */}
              <EditableRecallList
                recalls={getFilteredRecalls()}
                loading={loading}
                error={error}
                onEdit={handleEdit}
              />
            </div>
          )}
        </div>

        {editModal.isOpen && editModal.recall && (
          <EditModal
            recall={editModal.recall}
            onClose={() => setEditModal({ isOpen: false, recall: null })}
            onSave={handleSaveEdit}
          />
        )}
      </main>
    </ProtectedRoute>
  );
}