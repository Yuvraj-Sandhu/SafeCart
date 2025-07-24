'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './AutocompleteInput.module.css';

interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteInputProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Type to search...', 
  className = '' 
}: AutocompleteInputProps) {
  const { currentTheme } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [autocompleteText, setAutocompleteText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on input - show all options if no input and dropdown opened via arrow
  const filteredOptions = inputValue.length > 0 
    ? options.filter(option =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : options; // Show all options when no input (dropdown opened via arrow)

  // Find the best match for autocomplete
  const bestMatch = inputValue.length > 0 ? 
    options.find(option => 
      option.label.toLowerCase().startsWith(inputValue.toLowerCase())
    ) : null;

  // Update autocomplete text when input changes
  useEffect(() => {
    if (bestMatch && inputValue.length > 0) {
      setAutocompleteText(bestMatch.label);
    } else {
      setAutocompleteText('');
    }
  }, [inputValue, bestMatch]);

  // Sync with external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
      setAutocompleteText('');
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowDropdown(true);
    setHighlightedIndex(-1);
    
    // If input is cleared, clear the selection
    if (newValue === '') {
      onChange('');
    }
  };

  const handleOptionClick = (option: AutocompleteOption) => {
    setInputValue(option.label);
    onChange(option.value);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setAutocompleteText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown') {
        setShowDropdown(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleOptionClick(filteredOptions[highlightedIndex]);
        } else if (bestMatch) {
          // Accept autocomplete suggestion
          handleOptionClick(bestMatch);
        }
        break;
      
      case 'Tab':
        // Accept autocomplete suggestion on Tab
        if (bestMatch && inputValue.length > 0) {
          e.preventDefault();
          handleOptionClick(bestMatch);
        }
        break;
      
      case 'Escape':
        setShowDropdown(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputFocus = () => {
    if (inputValue.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      // Show all options when dropdown is opened via arrow click
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`}>
      <div className={styles.inputContainer}>
        {/* Autocomplete background text */}
        {autocompleteText && inputValue.length > 0 && (
          <div 
            className={styles.autocompleteText}
            style={{ 
              backgroundColor: currentTheme.inputBackground,
              borderColor: currentTheme.inputBorder,
            }}
          >
            <span style={{ color: 'transparent' }}>{inputValue}</span>
            <span style={{ color: currentTheme.textTertiary }}>
              {autocompleteText.slice(inputValue.length)}
            </span>
          </div>
        )}
        
        {/* Actual input */}
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          style={{
            backgroundColor: autocompleteText ? 'transparent' : currentTheme.inputBackground,
            color: currentTheme.text,
            borderColor: currentTheme.inputBorder,
          }}
        />
        
        {/* Dropdown arrow */}
        <div
          className={styles.dropdownArrow}
          onClick={handleDropdownToggle}
          style={{
            color: currentTheme.textSecondary,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
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
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div 
          className={styles.dropdown}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
            boxShadow: `0 4px 12px ${currentTheme.shadowLight}`,
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={`${styles.option} ${
                index === highlightedIndex ? styles.highlighted : ''
              }`}
              onClick={() => handleOptionClick(option)}
              style={{
                backgroundColor: index === highlightedIndex ? currentTheme.primaryLight : 'transparent'
              } as React.CSSProperties}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}