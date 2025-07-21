'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'medium', 
  fullWidth = false,
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const { currentTheme } = useTheme();

  const style = variant === 'primary' ? {
    '--button-bg': currentTheme.buttonPrimary,
    '--button-bg-hover': currentTheme.primaryHover,
    color: currentTheme.buttonPrimaryText,
  } as React.CSSProperties : {
    '--button-bg': currentTheme.buttonSecondary,
    '--button-bg-hover': currentTheme.buttonSecondary,
    color: currentTheme.buttonSecondaryText,
  } as React.CSSProperties;

  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
}