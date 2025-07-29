'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { getEasternDate, createEasternDate } from '@/utils/easternTime';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: DateRangePickerProps) {
  const { currentTheme, mode } = useTheme();
  const [showPresets, setShowPresets] = useState(false);


  const handlePreset = (preset: string) => {
    const today = getEasternDate();
    const todayEnd = createEasternDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    switch (preset) {
      case 'thisMonth': {
        const start = createEasternDate(today.getFullYear(), today.getMonth(), 1);
        onStartDateChange(start);
        onEndDateChange(todayEnd);
        break;
      }
      case 'lastMonth': {
        const start = createEasternDate(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        const end = createEasternDate(today.getFullYear(), today.getMonth() - 1, lastDayOfLastMonth, 23, 59, 59);
        onStartDateChange(start);
        onEndDateChange(end);
        break;
      }
      case 'yearToDate': {
        const start = createEasternDate(today.getFullYear(), 0, 1);
        onStartDateChange(start);
        onEndDateChange(todayEnd);
        break;
      }
      case 'last30Days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const start = createEasternDate(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate());
        onStartDateChange(start);
        onEndDateChange(todayEnd);
        break;
      }
      case 'clear': {
        onStartDateChange(null);
        onEndDateChange(null);
        break;
      }
    }
    setShowPresets(false);
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    // Format date in Eastern Time for the input
    const easternDate = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const year = easternDate.getFullYear();
    const month = String(easternDate.getMonth() + 1).padStart(2, '0');
    const day = String(easternDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateInputChange = (value: string, isStartDate: boolean) => {
    if (!value) {
      if (isStartDate) {
        onStartDateChange(null);
      } else {
        onEndDateChange(null);
      }
      return;
    }

    // Parse the date input as Eastern Time
    const [year, month, day] = value.split('-').map(Number);
    const easternDate = createEasternDate(year, month - 1, day);
    
    if (isStartDate) {
      onStartDateChange(easternDate);
    } else {
      // Set end date to end of day in Eastern Time
      const endOfDay = createEasternDate(year, month - 1, day, 23, 59, 59);
      onEndDateChange(endOfDay);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.dateInputs}>
        <div className={styles.inputGroup}>
          <label 
            className={styles.label}
            style={{ color: currentTheme.textSecondary }}
          >
            Start Date
          </label>
          <input
            type="date"
            className={styles.dateInput}
            value={formatDateForInput(startDate)}
            onChange={(e) => handleDateInputChange(e.target.value, true)}
            style={{
              backgroundColor: currentTheme.inputBackground,
              color: currentTheme.text,
              borderColor: currentTheme.inputBorder,
              colorScheme: mode === 'dark' ? 'dark' : 'light',
            }}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label 
            className={styles.label}
            style={{ color: currentTheme.textSecondary }}
          >
            End Date
          </label>
          <input
            type="date"
            className={styles.dateInput}
            value={formatDateForInput(endDate)}
            onChange={(e) => handleDateInputChange(e.target.value, false)}
            style={{
              backgroundColor: currentTheme.inputBackground,
              color: currentTheme.text,
              borderColor: currentTheme.inputBorder,
              colorScheme: mode === 'dark' ? 'dark' : 'light',
            }}
          />
        </div>
        
        <div className={styles.presetsContainer}>
          <Button 
            variant="secondary" 
            size="small"
            onClick={() => setShowPresets(!showPresets)}
          >
            Presets
          </Button>
          
          {showPresets && (
            <div 
              className={styles.presetsDropdown}
              style={{
                backgroundColor: currentTheme.cardBackground,
                borderColor: currentTheme.cardBorder,
                boxShadow: `0 4px 12px ${currentTheme.shadow}`,
              }}
            >
              <button 
                className={styles.presetItem}
                onClick={() => handlePreset('thisMonth')}
                style={{ color: currentTheme.text }}
              >
                This Month
              </button>
              <button 
                className={styles.presetItem}
                onClick={() => handlePreset('lastMonth')}
                style={{ color: currentTheme.text }}
              >
                Last Month
              </button>
              <button 
                className={styles.presetItem}
                onClick={() => handlePreset('yearToDate')}
                style={{ color: currentTheme.text }}
              >
                Year to Date
              </button>
              <button 
                className={styles.presetItem}
                onClick={() => handlePreset('last30Days')}
                style={{ color: currentTheme.text }}
              >
                Last 30 Days
              </button>
              <div 
                className={styles.divider}
                style={{ backgroundColor: currentTheme.border }}
              />
              <button 
                className={styles.presetItem}
                onClick={() => handlePreset('clear')}
                style={{ color: currentTheme.danger }}
              >
                Clear Dates
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}