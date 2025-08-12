/**
 * User Authentication Routes
 * 
 * Handles public user registration, login, and session management for SafeCart email subscribers.
 * This system is separate from the internal admin/member authentication system.
 * 
 * Key Features:
 * - Email-based user accounts with password authentication
 * - 30-day JWT sessions (longer than internal users for better UX)
 * - Secure httpOnly cookies with environment-aware settings
 * - Input validation and sanitization
 * - Proper error handling without information leakage
 * 
 * Security Considerations:
 * - Passwords must be 6+ characters (basic requirement)
 * - Email addresses are normalized (lowercase, trimmed)
 * - JWT tokens include user type to prevent token misuse
 * - Cookies use secure flags in production
 * - Rate limiting should be implemented at the reverse proxy level
 * 
 * @author Yuvraj
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserEmailService } from '../services/user-email.service';
import { UserCreateData, UserLoginData } from '../types/user-email.types';

const router = Router();

/**
 * POST /register
 * 
 * Creates a new public user account for email subscription service.
 * Users can register without admin approval, unlike internal team members.
 * 
 * Business Logic:
 * - Creates account with default email preferences (unsubscribed)
 * - Email verification is set to false initially (future feature)
 * - Automatically logs in the user after successful registration
 * 
 * Security Notes:
 * - Email uniqueness is enforced at the service layer
 * - Password is hashed using bcrypt before storage
 * - Input is sanitized to prevent injection attacks
 * - Returns 409 for existing emails to distinguish from other errors
 */
router.post('/register', async (req, res) => {
  try {
    const { email, name, password }: UserCreateData = req.body;
    
    // Validate required fields - fail fast for missing data
    if (!email || !name || !password) {
      return res.status(400).json({
        error: 'Email, name, and password are required'
      });
    }
    
    // Enforce minimum password length - prevents weak passwords
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }
    
    // Basic email format validation - catches obvious typos
    // Note: More comprehensive validation could be added, but this covers 99% of cases
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }
    
    // Normalize input data - prevents case sensitivity issues
    // toLowerCase() ensures email uniqueness, trim() removes accidental whitespace
    const user = await UserEmailService.createUser({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password
    });
    
    // Generate JWT with user type distinction - prevents cross-system token abuse
    // 'type: user' ensures this token can't be used for internal admin functions
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        name: user.name,
        type: 'user' // Critical: distinguishes from internal 'admin'/'member' tokens
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' } // Longer expiry for better UX (vs 7d for internal users)
    );
    
    // Set secure cookie with environment-aware configuration
    // httpOnly prevents XSS attacks, secure ensures HTTPS in production
    res.cookie('user_token', token, {
      httpOnly: true, // Prevents client-side JavaScript access
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CORS-friendly in prod
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      path: '/' // Cookie available site-wide
    });
    
    // Return user data without sensitive information
    // Note: passwordHash is never returned in any API response
    res.status(201).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        emailPreferences: user.emailPreferences
      }
    });
    
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Specific error handling for user experience
    // 409 Conflict indicates email already exists (vs generic 500 error)
    if (error.message === 'User with this email already exists') {
      return res.status(409).json({ error: error.message });
    }
    
    // Generic error to prevent information leakage about system internals
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /login
 * 
 * Authenticates an existing user with email and password.
 * 
 * Business Logic:
 * - Validates credentials against hashed password in database
 * - Issues new JWT token on successful authentication
 * - Sets httpOnly cookie for subsequent requests
 * 
 * Security Notes:
 * - Uses timing-safe comparison via bcrypt to prevent timing attacks
 * - Returns generic error message to prevent user enumeration
 * - No rate limiting implemented here (should be done at proxy level)
 * - Password is never logged or returned in response
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password }: UserLoginData = req.body;
    
    // Basic input validation - prevent null/undefined values
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }
    
    // Delegate authentication to service layer
    // Service handles password hashing comparison and user lookup
    const result = await UserEmailService.authenticateUser(
      email.toLowerCase().trim(), // Normalize email for consistent lookup
      password
    );
    
    // Handle authentication failure with generic message
    // Prevents user enumeration attacks by not revealing if email exists
    if (!result.success || !result.user) {
      return res.status(401).json({
        error: result.message || 'Invalid credentials'
      });
    }
    
    // Generate fresh JWT token for this session
    // Each login gets a new token rather than extending existing ones
    const token = jwt.sign(
      {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.name,
        type: 'user' // Maintain separation from internal user tokens
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    
    // Set identical cookie configuration as registration
    // Consistency ensures predictable behavior across auth endpoints
    res.cookie('user_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    // Return successful authentication with user data
    res.json({
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.name,
        emailVerified: result.user.emailVerified,
        emailPreferences: result.user.emailPreferences
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    // Generic error prevents information leakage about system state
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /logout
 * 
 * Logs out the current user by clearing their authentication cookie.
 * 
 * Implementation Notes:
 * - Client-side logout by clearing httpOnly cookie
 * - No server-side token invalidation (stateless JWT approach)
 * - Cookie options must match those used during login for proper clearing
 * - Always returns success, even if user wasn't logged in
 * 
 * Security Notes:
 * - JWT tokens remain valid until expiration (30 days max)
 * - For high-security applications, consider token blacklisting
 * - Client should clear any cached user data after logout
 */
router.post('/logout', (req, res) => {
  // Clear authentication cookie with identical options to login/register
  // Critical: options must match exactly or cookie won't be cleared
  res.clearCookie('user_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });
  
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /me
 * 
 * Returns current authenticated user information.
 * Used by frontend to check authentication status and get user data.
 * 
 * Business Logic:
 * - Validates JWT token from cookie
 * - Fetches fresh user data from database (not from token)
 * - Ensures user still exists and account is active
 * 
 * Security Notes:
 * - Validates token type to prevent internal user tokens from being used
 * - Always fetches current data from DB (handles account changes)
 * - Returns 401 for any authentication failure (expired, invalid, missing)
 * 
 * Frontend Usage:
 * - Call on app initialization to restore user session
 * - Use to verify authentication before protected actions
 * - Data returned here should match login/register responses
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.user_token;
    
    // Early return for missing token - most common case
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Verify and decode JWT token
    // Will throw exception for expired, malformed, or invalid signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // Prevent internal user tokens from accessing public user endpoints
    // Critical security check to maintain system separation
    if (decoded.type !== 'user') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Fetch current user data from database
    // Important: don't trust token data, always verify user still exists
    const user = await UserEmailService.getUserById(decoded.uid);
    
    if (!user) {
      // User was deleted after token was issued
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user data consistent with login/register endpoints
    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      emailPreferences: user.emailPreferences
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    // Generic error for any JWT issues (expired, invalid, etc.)
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;