export const theme = {
  light: {
    // Primary colors
    primary: '#15803d',
    primaryHover: '#166534',
    primaryLight: '#86efac',
    
    // Background colors
    background: '#f7f6f3',
    backgroundSecondary: '#eceae4',
    backgroundTertiary: '#e2e0d9',
    
    // Text colors
    text: '#111827',
    textSecondary: '#374151',
    textTertiary: '#9ca3af',
    textBlack: '#111827',
    
    // Border colors
    border: '#e5e7eb',
    borderFocus: '#9ca3af',
    
    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    danger: '#b91c1c',
    dangerLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',
    
    // Component specific
    cardBackground: '#fffffc',
    cardBorder: '#e5e7eb',
    inputBackground: '#ffffff',
    inputBorder: '#d1d5db',
    buttonPrimary: '#15803d',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#f3f4f6',
    buttonSecondaryText: '#374151',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowLight: 'rgba(0, 0, 0, 0.05)',
  },
  dark: {
    // Primary colors
    primary: '#22c55e',
    primaryHover: '#16a34a',
    primaryLight: '#86efac',
    
    // Background colors
    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',
    
    // Text colors
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textTertiary: '#9ca3af',
    textBlack: '#111827',
    
    // Border colors
    border: '#374151',
    borderFocus: '#16a34a',
    
    // Status colors
    success: '#10b981',
    successLight: '#064e3b',
    warning: '#f59e0b',
    warningLight: '#78350f',
    danger: '#dc2626',
    dangerLight: '#7f1d1d',
    info: '#3b82f6',
    infoLight: '#1e3a8a',
    
    // Component specific
    cardBackground: '#1f2937',
    cardBorder: '#374151',
    inputBackground: '#1f2937',
    inputBorder: '#4b5563',
    buttonPrimary: '#22c55e',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#374151',
    buttonSecondaryText: '#e5e7eb',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.2)',
  }
};

export type Theme = typeof theme.light;