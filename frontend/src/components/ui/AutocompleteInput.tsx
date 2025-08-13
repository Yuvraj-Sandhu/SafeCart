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
  detectedValue?: string; // The auto-detected state value
}

export function AutocompleteInput({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Type to search...', 
  className = '',
  detectedValue
}: AutocompleteInputProps) {
  const { currentTheme } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [autocompleteText, setAutocompleteText] = useState('');
  const [allowFocus, setAllowFocus] = useState(true); // Control whether input can be focused
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const clickPositionRef = useRef<number | null>(null);

  // Filter and order options based on input
  const getFilteredOptions = () => {
    if (inputValue.length === 0) {
      // No input - show all with detected state at top if available
      if (detectedValue) {
        const detectedOption = options.find(opt => opt.value === detectedValue);
        if (detectedOption) {
          const otherOptions = options.filter(opt => opt.value !== detectedValue);
          return [detectedOption, ...otherOptions];
        }
      }
      return options;
    }
    
    // With input - prioritize states that start with the input
    const lowerInput = inputValue.toLowerCase();
    const startsWithInput = options.filter(option =>
      option.label.toLowerCase().startsWith(lowerInput)
    );
    const others = options.filter(option =>
      !option.label.toLowerCase().startsWith(lowerInput)
    );
    
    return [...startsWithInput, ...others];
  };
  
  const filteredOptions = getFilteredOptions();

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
    // Find the option that matches the value and use its label
    const matchingOption = options.find(opt => opt.value === value);
    const displayValue = matchingOption ? matchingOption.label : value;
    
    if (displayValue !== inputValue) {
      setInputValue(displayValue);
      setAutocompleteText('');
    }
  }, [value, options]);

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
    // Remove focus call to prevent dropdown from reopening and keyboard from staying up
    inputRef.current?.blur();
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
    // Only allow focus if we're clicking on text area
    if (!allowFocus) {
      inputRef.current?.blur();
      return;
    }
    if (inputValue.length > 0) {
      setShowDropdown(true);
    }
  };
  
  const measureTextWidth = (text: string, input: HTMLInputElement): number => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    
    const computedStyle = window.getComputedStyle(input);
    context.font = computedStyle.font;
    return context.measureText(text).width;
  };
  
  const handleInputPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const rect = input.getBoundingClientRect();
    const clickX = e.clientX - rect.left - parseFloat(getComputedStyle(input).paddingLeft);
    
    // Store click position for later use
    clickPositionRef.current = clickX;
    
    // Determine text width - either actual text or placeholder
    const textToMeasure = inputValue.length === 0 ? (placeholder || '') : inputValue;
    const textWidth = measureTextWidth(textToMeasure, input);
    const textEndPosition = textWidth + 15; // 15px buffer
    
    // Determine if click is on empty space
    if (clickX > textEndPosition) {
      // Clicking on empty space - prevent focus, toggle dropdown
      e.preventDefault();
      setAllowFocus(false);
      setShowDropdown(prev => !prev); // Toggle dropdown like arrow does
      setHighlightedIndex(-1);
      
      // Immediately blur if somehow focused
      setTimeout(() => {
        inputRef.current?.blur();
      }, 0);
    } else {
      // Clicking on text or placeholder - allow normal focus and typing
      setAllowFocus(true);
    }
  };
  
  const handleInputMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const mouseX = e.nativeEvent.offsetX;
    
    // Determine text width - either actual text or placeholder
    const textToMeasure = inputValue.length === 0 ? (placeholder || '') : inputValue;
    const textWidth = measureTextWidth(textToMeasure, input);
    const textEndPosition = textWidth + 30;
    
    // Set cursor based on position
    input.style.cursor = mouseX > textEndPosition ? 'pointer' : 'text';
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      // Show all options when dropdown is opened via arrow click
      setHighlightedIndex(-1);
    }
  };

  // Reset allowFocus when dropdown closes
  useEffect(() => {
    if (!showDropdown) {
      setAllowFocus(true);
    }
  }, [showDropdown]);

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
          onPointerDown={handleInputPointerDown}
          onMouseMove={handleInputMouseMove}
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