/**
 * User Email Preferences Routes
 * 
 * Manages email subscription preferences for SafeCart users.
 * This is the core functionality that allows users to subscribe to daily recall digests.
 * 
 * Key Features:
 * - Get/update email subscription preferences
 * - State-based subscription selection (required for email delivery)
 * - Schedule preferences (weekdays/weekends, morning/evening)
 * - One-click unsubscribe via secure tokens (CAN-SPAM compliance)
 * - Test email functionality for subscription verification
 * 
 * Business Logic:
 * - Users must select a state to receive relevant recalls
 * - Subscription is opt-in only (never automatic)
 * - Unsubscribe tokens are generated automatically on first subscription
 * - Default preferences are set for new users (unsubscribed, morning weekdays)
 * 
 * Security & Compliance:
 * - All authenticated endpoints require valid user JWT token
 * - Unsubscribe works without authentication (CAN-SPAM requirement)
 * - State validation prevents invalid data storage
 * - User input is validated to prevent malformed preferences
 * 
 * @author Yuvraj
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserEmailService } from '../services/user-email.service';
import { EmailPreferences } from '../types/user-email.types';

const router = Router();

/**
 * Authentication Middleware
 * 
 * Validates user JWT token and attaches user object to request.
 * This middleware is reused across all authenticated endpoints in this router.
 * 
 * Implementation Notes:
 * - Identical logic to /me endpoint in auth routes (consider extracting to shared middleware)
 * - Fetches fresh user data from database (not from token claims)
 * - Validates token type to prevent internal user tokens from being used
 * 
 * Security Considerations:
 * - Always fetch current user data to handle account changes/deletions
 * - Generic error messages prevent information leakage
 * - Token type validation maintains system separation
 */
const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies.user_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Verify and decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // Ensure this is a public user token, not internal admin/member token
    if (decoded.type !== 'user') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Fetch current user data from database
    // Critical: validates user still exists and gets fresh preference data
    const user = await UserEmailService.getUserById(decoded.uid);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Attach user object to request for downstream handlers
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * GET /email-preferences
 * 
 * Returns current user's email subscription preferences.
 * Used by frontend to populate preference forms and display current settings.
 * 
 * Business Logic:
 * - Returns user's current preferences if they exist
 * - Provides sensible defaults for new users (unsubscribed, weekday mornings)
 * - Defaults use Eastern Time zone (SafeCart's operational timezone)
 * 
 * Frontend Usage:
 * - Call to populate email preferences form
 * - Check subscription status for UI state
 * - Display current schedule settings
 */
router.get('/email-preferences', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user;
    
    // Return current preferences or sensible defaults
    // Defaults align with SafeCart's operational schedule (weekday mornings ET)
    res.json({
      emailPreferences: user.emailPreferences || {
        subscribed: false, // Always start unsubscribed (opt-in required)
        schedule: {
          weekdays: true,  // Most users prefer weekday notifications
          weekends: false, // Avoid weekend email noise
          timeOfDay: 'morning', // 8 AM ET fits most work schedules
          timezone: 'America/New_York' // SafeCart operational timezone
        }
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /email-preferences
 * 
 * Updates user's email subscription preferences.
 * This is the primary endpoint for managing email subscriptions.
 * 
 * Business Logic:
 * - Validates state selection when subscribing (required for targeted emails)
 * - Generates unsubscribe token automatically on first subscription
 * - Preserves existing preferences when updating specific fields
 * - Returns updated preferences for frontend state synchronization
 * 
 * Validation Rules:
 * - State is required when subscribed=true (prevents incomplete subscriptions)
 * - State must be valid US state code (prevents invalid data)
 * - Schedule preferences are optional (defaults will be used)
 * 
 * Security Notes:
 * - User can only update their own preferences (enforced by authentication)
 * - State validation prevents data corruption
 * - Unsubscribe token generation is handled securely in service layer
 */
router.put('/email-preferences', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { emailPreferences }: { emailPreferences: EmailPreferences } = req.body;
    
    // Validate request body structure
    if (!emailPreferences) {
      return res.status(400).json({ error: 'Email preferences are required' });
    }
    
    // Business rule: subscription requires state selection for targeted delivery
    if (emailPreferences.subscribed && !emailPreferences.state) {
      return res.status(400).json({ error: 'State is required when subscribing' });
    }
    
    // Validate state code against official US state abbreviations
    // Prevents invalid data that would cause email delivery failures
    if (emailPreferences.state) {
      const validStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
      ];
      
      if (!validStates.includes(emailPreferences.state)) {
        return res.status(400).json({ error: 'Invalid state code' });
      }
    }
    
    // Persist preferences to database
    // Service layer handles unsubscribe token generation automatically
    await UserEmailService.updateEmailPreferences(user.uid, emailPreferences);
    
    // Fetch and return updated preferences for frontend state sync
    // Important: get fresh data to ensure token generation is reflected
    const updatedUser = await UserEmailService.getUserById(user.uid);
    
    res.json({
      success: true,
      emailPreferences: updatedUser?.emailPreferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /unsubscribe/:token
 * 
 * One-click unsubscribe functionality using secure tokens.
 * This endpoint is CAN-SPAM Act compliant and requires no authentication.
 * 
 * Business Logic:
 * - Immediately unsubscribes user when valid token is provided
 * - Token-based approach allows unsubscribe from any device/browser
 * - Preserves other preferences (only changes subscribed status)
 * - Token remains valid even after unsubscribe (for re-subscribe scenarios)
 * 
 * Compliance Notes:
 * - CAN-SPAM Act requires unsubscribe to work without login
 * - Must process unsubscribe within 10 business days (we do it immediately)
 * - Cannot require additional information beyond clicking the link
 * - Must be operational for at least 30 days after email is sent
 * 
 * Security Notes:
 * - Tokens are cryptographically secure (32 random bytes)
 * - Invalid tokens return 404 (not 400) to prevent token guessing
 * - No rate limiting needed (legitimate operation)
 */
router.post('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validate token parameter exists
    if (!token) {
      return res.status(400).json({ error: 'Unsubscribe token is required' });
    }
    
    // Lookup user by unsubscribe token
    // Service layer handles token validation and user lookup
    const user = await UserEmailService.getUserByUnsubscribeToken(token);
    
    if (!user) {
      // Return 404 for invalid tokens (prevents token enumeration attacks)
      return res.status(404).json({ error: 'Invalid unsubscribe token' });
    }
    
    // Update only subscription status, preserve other preferences
    // Important: don't remove state, schedule, or token (allows re-subscription)
    const updatedPreferences = {
      ...user.emailPreferences,
      subscribed: false
    };
    
    await UserEmailService.updateEmailPreferences(user.uid, updatedPreferences);
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from email alerts'
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * POST /send-test-email
 * 
 * Sends a test email to verify subscription setup.
 * Helps users confirm their email preferences are working correctly.
 * 
 * Business Logic:
 * - Only works for subscribed users with selected state
 * - Sends real email using production templates (when implemented)
 * - Uses actual recall data for realistic testing
 * - Counts as regular email for rate limiting purposes
 * 
 * Implementation Notes:
 * - Currently returns placeholder response (Step 2 will implement)
 * - Will integrate with email service and digest generation
 * - Should use same template as daily digest emails
 * - Consider adding rate limiting (max 1 test per hour per user)
 * 
 * Security Notes:
 * - Requires authentication to prevent abuse
 * - Validates subscription status to prevent spam
 * - Test emails should be clearly labeled as such
 */
router.post('/send-test-email', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user;
    
    // Validate user is properly subscribed before sending test
    // Prevents test emails to users who haven't completed setup
    if (!user.emailPreferences?.subscribed || !user.emailPreferences?.state) {
      return res.status(400).json({
        error: 'You must be subscribed with a selected state to receive test emails'
      });
    }
    
    // TODO: Implement actual test email sending in Step 2 (Email Templates)
    // Implementation will:
    // 1. Fetch recent recalls for user's state
    // 2. Generate email HTML using React Email templates
    // 3. Send via email service with "TEST" subject prefix
    // 4. Log test email for analytics/debugging
    res.json({
      success: true,
      message: 'Test email functionality will be implemented in Step 2'
    });
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default router;