/**
 * Email Templates Export Index
 * 
 * Centralized exports for all SafeCart email templates and components.
 * Provides clean imports for the email service integration.
 * 
 * @author Yuvraj
 */

// Templates
export { RecallDigest } from './templates/RecallDigest';
export { WelcomeEmail } from './templates/WelcomeEmail';

// Components  
export { BaseLayout } from './components/BaseLayout';
export { RecallCard } from './components/RecallCard';

// Default exports for direct usage
export { default as RecallDigestDefault } from './templates/RecallDigest';
export { default as WelcomeEmailDefault } from './templates/WelcomeEmail';