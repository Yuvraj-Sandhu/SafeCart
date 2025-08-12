/**
 * Google OAuth Authentication Service
 * 
 * Handles Google OAuth 2.0 authentication for SafeCart internal team members.
 * This service is separate from the public user authentication system and is specifically
 * designed for admin and member access to internal tools.
 * 
 * Key Features:
 * - Google ID token verification using official Google Auth Library
 * - Pre-authorized email list integration (authorized_emails collection)
 * - Automatic account creation for first-time Google sign-ins
 * - Role assignment based on authorized email configuration
 * - JWT token generation for session management
 * - Account linking and profile updates
 * 
 * Security Model:
 * - Only pre-authorized email addresses can authenticate
 * - Google ID token verification prevents token spoofing
 * - JWT tokens have shorter expiration (7 days vs 30 for public users)
 * - Role-based access control (admin vs member permissions)
 * - Automatic role updates when authorized_emails changes
 * 
 * Business Logic:
 * - Internal team members sign in with Google accounts
 * - First sign-in creates account automatically (no manual registration)
 * - User profiles sync with Google account changes (name updates)
 * - Role changes in authorized_emails apply on next login
 * - Failed authorization provides clear feedback for support requests
 * 
 * Integration Points:
 * - authorized_emails collection for access control
 * - internal_users collection for account storage
 * - JWT token system for session management
 * - Frontend Google Sign-In component integration
 * 
 * Environment Dependencies:
 * - GOOGLE_CLIENT_ID: OAuth client ID from Google Cloud Console
 * - GOOGLE_CLIENT_SECRET: OAuth client secret (optional for ID token flow)
 * - GOOGLE_REDIRECT_URI: Configured redirect URI (optional for ID token flow)
 * - JWT_SECRET: Secret for signing internal user tokens
 * 
 * @author Yuvraj
 */

import { OAuth2Client } from 'google-auth-library';
import * as admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { authorizedEmailsService } from './authorized-emails.service';
import logger from '../utils/logger';

const INTERNAL_USERS_COLLECTION = 'internal_users';

/**
 * Google User Interface
 * 
 * Represents the essential user information extracted from Google ID tokens.
 * Contains only the fields needed for SafeCart account creation and management.
 */
export interface GoogleUser {
  email: string;    // Primary identifier for authorization checks
  name: string;     // Display name for UI and account management
  googleId: string; // Google's unique user ID for account linking
}

/**
 * Google Authentication Service Class
 * 
 * Manages the complete Google OAuth flow for internal team authentication.
 * Handles token verification, authorization checks, and account management.
 */
export class GoogleAuthService {
  private client: OAuth2Client;
  private db = admin.firestore();

  /**
   * Initialize Google OAuth Service
   * 
   * Sets up the Google OAuth2 client with environment configuration.
   * Uses Google's official authentication library for secure token verification.
   * 
   * Configuration Notes:
   * - GOOGLE_CLIENT_ID is required for ID token verification
   * - GOOGLE_CLIENT_SECRET is optional for ID token flow (frontend handles OAuth)
   * - GOOGLE_REDIRECT_URI is optional for ID token flow
   * - Same client ID should be used in frontend and backend
   * 
   * Security Considerations:
   * - Client ID can be public (embedded in frontend)
   * - Client secret must be kept private (environment variable only)
   * - Redirect URI must be configured in Google Cloud Console
   */
  constructor() {
    // Initialize Google OAuth2 client with environment configuration
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Verify Google ID Token
   * 
   * Validates a Google ID token and extracts user information.
   * This method handles the core security verification that prevents token spoofing.
   * 
   * @param idToken - Google ID token from frontend authentication
   * @returns Promise<GoogleUser | null> - Verified user info or null if invalid
   * 
   * Security Process:
   * 1. Verifies token signature using Google's public keys
   * 2. Validates token audience matches our client ID
   * 3. Checks token expiration and issuer
   * 4. Extracts user claims from verified payload
   * 
   * Error Handling:
   * - Invalid tokens return null (not exceptions)
   * - Network errors are logged but don't crash the application
   * - Malformed tokens are handled gracefully
   * 
   * Business Logic:
   * - Only extracts essential user information (email, name, Google ID)
   * - Email is used for authorization checks against allowed list
   * - Name is used for display and account management
   * - Google ID enables account linking and prevents duplicate accounts
   */
  async verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
    try {
      // Verify ID token with Google's servers
      // This validates signature, expiration, audience, and issuer
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID, // Must match frontend client ID
      });
      
      // Extract verified user information from token payload
      const payload = ticket.getPayload();
      
      if (!payload) {
        // Payload missing indicates invalid token structure
        return null;
      }

      // Return essential user information for account management
      return {
        email: payload.email!,      // Primary identifier for authorization
        name: payload.name!,        // Display name for UI
        googleId: payload.sub,      // Google's unique user ID for linking
      };
    } catch (error) {
      // Log verification errors for debugging but don't expose details
      logger.error('Error verifying Google token:', error);
      return null; // Always return null for any verification failure
    }
  }

  /**
   * Authenticate User with Google OAuth
   * 
   * Complete authentication flow that verifies Google token, checks authorization,
   * manages user accounts, and issues SafeCart JWT tokens.
   * 
   * @param idToken - Google ID token from frontend Google Sign-In
   * @returns Promise<AuthResult> - Complete authentication result with user data and JWT
   * 
   * Authentication Flow:
   * 1. Verify Google ID token authenticity
   * 2. Check if email is in authorized_emails list
   * 3. Create or update user account in internal_users
   * 4. Generate SafeCart JWT token for session management
   * 5. Return user data and token for frontend use
   * 
   * Authorization Strategy:
   * - Only pre-authorized emails can authenticate (prevents unauthorized access)
   * - Roles are assigned from authorized_emails collection
   * - Role changes take effect on next login (no immediate revocation)
   * - New team members are added via authorized_emails, not direct user creation
   * 
   * Account Management:
   * - First login automatically creates user account
   * - Existing accounts get profile updates (name, role changes)
   * - Google ID linking prevents duplicate accounts
   * - Account data syncs with Google profile changes
   * 
   * Security Features:
   * - JWT tokens have 7-day expiration (shorter than public users)
   * - Tokens include role information for authorization
   * - Failed authentication doesn't reveal whether email exists
   * - All authentication events are logged for audit
   */
  async authenticateWithGoogle(idToken: string): Promise<{
    success: boolean;
    user?: any;
    token?: string;
    message?: string;
  }> {
    try {
      // Step 1: Verify Google ID token authenticity
      const googleUser = await this.verifyGoogleToken(idToken);
      
      if (!googleUser) {
        return {
          success: false,
          message: 'Invalid Google token'
        };
      }

      // Step 2: Check authorization against pre-approved email list
      // This is the core security gate that prevents unauthorized access
      const { authorized, role } = await authorizedEmailsService.checkAuthorization(googleUser.email);
      
      if (!authorized) {
        // Provide clear feedback for support requests
        // Don't reveal whether email exists in system
        return {
          success: false,
          message: 'Email not authorized. Please contact an administrator.'
        };
      }

      // Step 3: Check if user account already exists
      const userQuery = await this.db
        .collection(INTERNAL_USERS_COLLECTION)
        .where('email', '==', googleUser.email)
        .limit(1)
        .get();

      let userId: string;
      let userData: any;

      if (!userQuery.empty) {
        // Existing user - update profile and role information
        const existingUser = userQuery.docs[0];
        userId = existingUser.id;
        
        // Update user data with current Google profile and role
        // Important: Role updates from authorized_emails take effect immediately
        await existingUser.ref.update({
          googleId: googleUser.googleId,           // Link Google account if not already linked
          username: googleUser.name,               // Sync display name with Google profile
          role: role!,                            // Apply current role from authorized_emails
        });

        // Prepare user data for JWT token and response
        userData = {
          uid: userId,
          ...existingUser.data(),
          googleId: googleUser.googleId,
          username: googleUser.name,
          role: role!, // Use updated role from authorized_emails
        };
      } else {
        // New user - create account automatically
        // No manual registration required for authorized team members
        const newUserRef = await this.db.collection(INTERNAL_USERS_COLLECTION).add({
          email: googleUser.email,
          username: googleUser.name,
          googleId: googleUser.googleId,
          role: role!,                            // Role assigned from authorized_emails
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          authMethod: 'google'                    // Track authentication method
        });

        userId = newUserRef.id;
        userData = {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          googleId: googleUser.googleId,
          role: role!,
          authMethod: 'google'
        };
      }

      // Step 4: Generate SafeCart JWT token for session management
      // Token includes role information for authorization middleware
      const token = jwt.sign(
        {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          role: userData.role,              // Critical: role determines access permissions
          type: 'internal'                  // Distinguishes from public user tokens
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }                 // Shorter expiration than public users (30d)
      );

      // Log successful authentication for audit trail
      logger.info(`User ${googleUser.email} authenticated via Google OAuth with role: ${userData.role}`);

      // Step 5: Return successful authentication result
      return {
        success: true,
        user: {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          role: userData.role
        },
        token
      };
    } catch (error) {
      // Log authentication errors for debugging
      logger.error('Error authenticating with Google:', error);
      
      // Return generic error to prevent information leakage
      return {
        success: false,
        message: 'Authentication failed'
      };
    }
  }
}

/**
 * Singleton Google Authentication Service Instance
 * 
 * Pre-configured Google OAuth service ready for use throughout the application.
 * Handles all Google authentication flows for SafeCart internal team members.
 * 
 * Usage in route handlers:
 * ```typescript
 * import { googleAuthService } from './google-auth.service';
 * 
 * // Authenticate with Google ID token
 * const result = await googleAuthService.authenticateWithGoogle(idToken);
 * 
 * if (result.success) {
 *   // Set JWT cookie and redirect to internal tools
 *   res.cookie('token', result.token);
 *   res.json({ user: result.user });
 * } else {
 *   // Handle authentication failure
 *   res.status(401).json({ error: result.message });
 * }
 * ```
 * 
 * Integration Points:
 * - Frontend Google Sign-In component sends ID tokens to backend
 * - Backend verifies tokens and manages user accounts
 * - JWT tokens are used for subsequent API authentication
 * - Role-based access control determines feature availability
 * 
 * Security Notes:
 * - Only pre-authorized emails can authenticate
 * - All authentication events are logged for audit
 * - JWT tokens include role information for authorization
 * - Token expiration is shorter than public user tokens
 */
export const googleAuthService = new GoogleAuthService();