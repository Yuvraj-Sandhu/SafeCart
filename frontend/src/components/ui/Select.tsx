'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './Select.module.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Select({ options, value, onChange, placeholder = 'Select...', className = '' }: SelectProps) {
  const { currentTheme } = useTheme();

  return (
    <select
      className={`${styles.select} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        backgroundColor: currentTheme.inputBackground,
        color: currentTheme.text,
        borderColor: currentTheme.inputBorder,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}