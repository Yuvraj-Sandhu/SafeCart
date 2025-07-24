'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
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
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    switch (preset) {
      case 'thisMonth': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        onStartDateChange(start);
        onEndDateChange(today);
        break;
      }
      case 'lastMonth': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        onStartDateChange(start);
        onEndDateChange(end);
        break;
      }
      case 'yearToDate': {
        const start = new Date(today.getFullYear(), 0, 1);
        onStartDateChange(start);
        onEndDateChange(today);
        break;
      }
      case 'last30Days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        onStartDateChange(start);
        onEndDateChange(today);
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
    return date.toISOString().split('T')[0];
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
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null;
              onStartDateChange(date);
            }}
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
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null;
              onEndDateChange(date);
            }}
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