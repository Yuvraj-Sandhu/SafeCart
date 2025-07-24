'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { theme, Theme } from '@/styles/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  currentTheme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    if (savedTheme) {
      setMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    const currentTheme = theme[mode];
    
    // Set data-theme attribute for CSS selectors
    root.setAttribute('data-theme', mode);
    
    // Set CSS custom properties
    Object.entries(currentTheme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Update body styles
    document.body.style.backgroundColor = currentTheme.background;
    document.body.style.color = currentTheme.text;
    
    // Save preference
    localStorage.setItem('theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ mode, currentTheme: theme[mode], toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}