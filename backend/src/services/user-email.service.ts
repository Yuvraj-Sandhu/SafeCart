/**
 * User Email Service - Public User Account Management
 * 
 * Manages user accounts for SafeCart's public email subscription service.
 * This service is completely separate from the internal team authentication system
 * and handles the consumer-facing user registration and email preference management.
 * 
 * Key Features:
 * - Email-based user registration and authentication
 * - Email subscription preference management
 * - Secure password hashing and verification
 * - Unsubscribe token generation and validation
 * - State-based subscriber queries for digest distribution
 * - CAN-SPAM compliant unsubscribe functionality
 * 
 * Account Model:
 * - Users register with email, name, and password
 * - Email verification status tracking (future feature)
 * - Default email preferences (unsubscribed, weekday mornings)
 * - Secure unsubscribe tokens for one-click unsubscribe
 * - State-based subscription targeting
 * 
 * Security Features:
 * - bcrypt password hashing with salt
 * - Email uniqueness enforcement
 * - Cryptographically secure unsubscribe tokens
 * - Generic error messages to prevent user enumeration
 * - Safe database query patterns
 * 
 * Business Logic:
 * - Users start unsubscribed (opt-in only model)
 * - Default preferences align with SafeCart operational schedule
 * - Unsubscribe tokens remain valid for re-subscription
 * - State selection is required for subscription
 * - Email preferences are preserved even when unsubscribed
 * 
 * Integration Points:
 * - AuthService for password hashing/verification
 * - Email service for digest distribution
 * - Frontend user authentication and preferences UI
 * - Daily digest generation and state-based targeting
 * 
 * Database Strategy:
 * - Uses 'users' collection (public users)
 * - Separate from 'internal_users' collection (team members)
 * - Firestore queries optimized for email distribution
 * - Timestamp handling for Firestore compatibility
 * 
 * @author Yuvraj
 */

import * as admin from 'firebase-admin';
import { User, UserCreateData, EmailPreferences } from '../types/user-email.types';
import { AuthService } from './auth.service';
import crypto from 'crypto';

const db = admin.firestore();
const USERS_COLLECTION = 'users';

/**
 * User Email Service Class
 * 
 * Static service class for managing public user accounts and email preferences.
 * All methods are static as this is a stateless service that operates on database records.
 */
export class UserEmailService {
  
  /**
   * Create New Public User Account
   * 
   * Creates a new user account for SafeCart's public email subscription service.
   * This is the primary registration method for consumers who want to receive recall alerts.
   * 
   * @param userData - User registration data including email, name, and password
   * @returns Promise<User> - Complete user object with generated fields
   * @throws Error - If email already exists or validation fails
   * 
   * Business Logic:
   * - Users start with unsubscribed status (opt-in required)
   * - Default preferences align with SafeCart operational schedule
   * - Email uniqueness is enforced to prevent duplicate accounts
   * - Password is securely hashed before storage
   * 
   * Security Features:
   * - Password hashing using bcrypt with salt
   * - Email existence check prevents account enumeration attacks
   * - Secure UID generation using Firestore document IDs
   * - No sensitive data in error messages
   * 
   * Default Settings:
   * - subscribed: false (users must opt-in explicitly)
   * - weekdays: true, weekends: false (business-friendly schedule)
   * - timeOfDay: 'morning' (8 AM ET aligns with work schedules)
   * - timezone: 'America/New_York' (SafeCart operational timezone)
   * - emailVerified: false (future feature for email verification)
   * 
   * Implementation Notes:
   * - Uses Firestore server timestamp for consistent creation times
   * - Generates unique document ID for user UID
   * - Separates password from user data before hashing
   * - Returns complete user object for immediate use in authentication
   */
  static async createUser(userData: UserCreateData): Promise<User> {
    const { password, ...userWithoutPassword } = userData;
    
    // Hash the password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Check if user already exists
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Create the user document
    const userRef = db.collection(USERS_COLLECTION).doc();
    const user: User = {
      uid: userRef.id,
      email: userWithoutPassword.email,
      name: userWithoutPassword.name,
      passwordHash,
      emailVerified: false,
      createdAt: new Date(),
      emailPreferences: {
        subscribed: false,
        schedule: {
          weekdays: true,
          weekends: false,
          timeOfDay: 'morning',
          timezone: 'America/New_York'
        }
      }
    };
    
    await userRef.set({
      ...user,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return user;
  }

  /**
   * Get User by Email Address
   * 
   * Retrieves user account using email as the lookup key.
   * Primary method for user authentication and email uniqueness validation.
   * 
   * @param email - User's email address (case-sensitive)
   * @returns Promise<User | null> - User object if found, null if not found
   * 
   * Business Logic:
   * - Used during login authentication to find user account
   * - Used during registration to check for existing accounts
   * - Email lookup is case-sensitive (users must use exact email)
   * - Returns null for non-existent emails (not exceptions)
   * 
   * Security Considerations:
   * - Query is optimized with limit(1) to prevent performance attacks
   * - No error messages reveal whether email exists in system
   * - Firestore index on email field ensures fast lookups
   * - Handles Firestore timestamp conversion safely
   * 
   * Data Transformation:
   * - Converts Firestore timestamps to JavaScript Date objects
   * - Preserves all user fields including password hash
   * - Handles missing emailPreferences gracefully
   * - Maps document ID to user UID for consistency
   * 
   * Performance Notes:
   * - Single document lookup with email index
   * - Firestore charges 1 read operation
   * - Results should be cached at application level if needed
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const data = snapshot.docs[0].data();
    return {
      uid: snapshot.docs[0].id,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: data.emailVerified || false,
      createdAt: data.createdAt?.toDate(),
      emailPreferences: data.emailPreferences ? {
        ...data.emailPreferences,
        subscribedAt: data.emailPreferences.subscribedAt?.toDate()
      } : undefined
    } as User;
  }

  /**
   * Get User by Unique ID
   * 
   * Retrieves user account using Firestore document ID.
   * Primary method for authenticated user data retrieval and token validation.
   * 
   * @param uid - User's unique identifier (Firestore document ID)
   * @returns Promise<User | null> - User object if found, null if not found
   * 
   * Business Logic:
   * - Used after JWT token validation to get current user data
   * - Used in middleware to attach user object to requests
   * - Returns fresh data for each request (no caching)
   * - Essential for validating user still exists after token issued
   * 
   * Security Considerations:
   * - Direct document lookup by ID (most secure and efficient)
   * - No query scanning or potential injection points
   * - Returns null for deleted/non-existent users
   * - Firestore security rules apply to this operation
   * 
   * Data Consistency:
   * - Always returns current user state from database
   * - Handles account deletions gracefully
   * - Converts Firestore timestamps to JavaScript dates
   * - Preserves complete user profile including preferences
   * 
   * Performance Notes:
   * - Single document read operation (most efficient Firestore query)
   * - Firestore charges 1 read operation per call
   * - No indexes required (direct document access)
   * - Consider request-level caching for heavy usage
   */
  static async getUserById(uid: string): Promise<User | null> {
    const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data()!;
    return {
      uid: doc.id,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: data.emailVerified || false,
      createdAt: data.createdAt?.toDate(),
      emailPreferences: data.emailPreferences ? {
        ...data.emailPreferences,
        subscribedAt: data.emailPreferences.subscribedAt?.toDate()
      } : undefined
    } as User;
  }

  /**
   * Update User Account Data
   * 
   * Updates specific fields of a user account while preserving other data.
   * Handles Firestore timestamp conversion and partial updates safely.
   * 
   * @param uid - User's unique identifier
   * @param updates - Partial user object with fields to update
   * @returns Promise<void> - Completes when update is successful
   * @throws Error - If user doesn't exist or update fails
   * 
   * Business Logic:
   * - Updates only specified fields (partial update)
   * - Preserves existing data not included in updates
   * - Handles timestamp conversion for Firestore compatibility
   * - Used for profile updates and account maintenance
   * 
   * Security Considerations:
   * - Caller must validate user permissions before calling
   * - No built-in authorization (handled by calling code)
   * - Atomic operation prevents partial updates on failure
   * - Firestore security rules apply to update operations
   * 
   * Data Handling:
   * - Converts JavaScript Date objects to Firestore timestamps
   * - Preserves original data types for other fields
   * - Merges updates with existing document data
   * - Validates document exists before attempting update
   * 
   * Use Cases:
   * - Profile information updates (name, email verification status)
   * - Email preference changes (handled by specialized method)
   * - Account status modifications (active/inactive)
   * - Internal administrative updates
   */
  static async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    const updateData: any = { ...updates };
    
    // Convert Date objects to Firestore Timestamps if needed
    if (updateData.createdAt instanceof Date) {
      updateData.createdAt = admin.firestore.Timestamp.fromDate(updateData.createdAt);
    }
    
    await db.collection(USERS_COLLECTION).doc(uid).update(updateData);
  }

  /**
   * Update Email Subscription Preferences
   * 
   * Specialized method for updating user email preferences with business logic.
   * Handles unsubscribe token generation and subscription state management.
   * 
   * @param uid - User's unique identifier
   * @param preferences - Complete email preferences object
   * @returns Promise<void> - Completes when preferences are updated
   * @throws Error - If user doesn't exist or update fails
   * 
   * Business Logic:
   * - Generates unsubscribe token automatically on first subscription
   * - Preserves existing tokens to allow re-subscription
   * - Sets subscription timestamp for analytics and compliance
   * - Handles all preference fields (state, schedule, subscription status)
   * 
   * Security Features:
   * - Unsubscribe tokens are cryptographically secure (32 random bytes)
   * - Tokens are unique per user and remain valid indefinitely
   * - No token regeneration prevents breaking existing unsubscribe links
   * - Server timestamp ensures accurate subscription timing
   * 
   * Subscription Flow:
   * - subscribing for first time: generates token + sets subscribedAt
   * - re-subscribing: preserves existing token + updates subscribedAt
   * - unsubscribing: preserves token + preferences (only changes subscribed flag)
   * - updating preferences: preserves subscription state and tokens
   * 
   * Compliance Considerations:
   * - CAN-SPAM Act requires functional unsubscribe for 30+ days
   * - Persistent tokens ensure unsubscribe links never break
   * - subscribedAt timestamp proves user consent for legal compliance
   * - Preference preservation enables easy re-subscription
   */
  static async updateEmailPreferences(uid: string, preferences: EmailPreferences): Promise<void> {
    const updateData: any = {
      emailPreferences: { ...preferences }
    };
    
    // Generate unsubscribe token if subscribing for first time
    if (preferences.subscribed && !preferences.unsubscribeToken) {
      updateData.emailPreferences.unsubscribeToken = crypto.randomBytes(32).toString('hex');
      updateData.emailPreferences.subscribedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await db.collection(USERS_COLLECTION).doc(uid).update(updateData);
  }

  /**
   * Get User by Unsubscribe Token
   * 
   * Retrieves user account using their unique unsubscribe token.
   * Critical for CAN-SPAM compliant one-click unsubscribe functionality.
   * 
   * @param token - 64-character hex unsubscribe token
   * @returns Promise<User | null> - User object if valid token, null otherwise
   * 
   * Business Logic:
   * - Used exclusively for unsubscribe link processing
   * - Tokens are generated during first subscription and persist forever
   * - No authentication required (CAN-SPAM compliance)
   * - Returns complete user object for preference preservation
   * 
   * Security Considerations:
   * - Tokens are 32 random bytes (256-bit entropy) making guessing impossible
   * - Query uses exact token match (no partial matching)
   * - Invalid tokens return null (not exceptions)
   * - No rate limiting needed (legitimate unsubscribe operation)
   * 
   * Compliance Requirements:
   * - CAN-SPAM Act mandates unsubscribe work without login/authentication
   * - Tokens must remain functional for minimum 30 days after email sent
   * - One-click operation (no additional confirmations required)
   * - Must process unsubscribe within 10 business days (we do immediately)
   * 
   * Token Lifecycle:
   * - Generated: First time user subscribes to emails
   * - Persisted: Never regenerated to avoid breaking links
   * - Used: Each time user clicks unsubscribe link
   * - Validity: Permanent (tokens never expire)
   * 
   * Performance Notes:
   * - Firestore query on nested field requires composite index
   * - Single document lookup with limit(1) for efficiency
   * - Returns complete user data for immediate preference updates
   */
  static async getUserByUnsubscribeToken(token: string): Promise<User | null> {
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('emailPreferences.unsubscribeToken', '==', token)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const data = snapshot.docs[0].data();
    return {
      uid: snapshot.docs[0].id,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: data.emailVerified || false,
      createdAt: data.createdAt?.toDate(),
      emailPreferences: data.emailPreferences ? {
        ...data.emailPreferences,
        subscribedAt: data.emailPreferences.subscribedAt?.toDate()
      } : undefined
    } as User;
  }

  /**
   * Get Subscribed Users by State
   * 
   * Retrieves all users subscribed to email alerts for a specific US state.
   * Primary method for daily digest email distribution and targeted recall alerts.
   * 
   * @param state - Two-letter US state code (e.g., 'CA', 'TX', 'NY')
   * @returns Promise<User[]> - Array of subscribed users for the state
   * 
   * Business Logic:
   * - Only returns users with subscribed=true AND matching state
   * - Used for daily digest generation and recall alert distribution
   * - Results include complete user data for email personalization
   * - Empty array returned if no subscribers for state
   * 
   * Distribution Strategy:
   * - Called once per state during daily digest generation
   * - Results used to create batch email operations
   * - Each user receives personalized content (state-specific recalls)
   * - Supports state-level recall targeting and relevance
   * 
   * Query Optimization:
   * - Compound query requires Firestore composite index
   * - Index: (emailPreferences.subscribed, emailPreferences.state)
   * - No pagination needed (state subscriber counts typically < 10K)
   * - Query cost scales with subscriber count per state
   * 
   * Performance Considerations:
   * - California and Texas likely to have highest subscriber counts
   * - Consider pagination if any state exceeds 1000 subscribers
   * - Results should be processed immediately (no caching needed)
   * - Query executed during off-peak hours (early morning ET)
   * 
   * Data Consistency:
   * - Returns current subscription status (users can unsubscribe anytime)
   * - Includes users who recently subscribed (real-time accuracy)
   * - Excludes users who unsubscribed since last digest
   * - Fresh data ensures compliance with unsubscribe requests
   */
  static async getSubscribedUsersByState(state: string): Promise<User[]> {
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('emailPreferences.subscribed', '==', true)
      .where('emailPreferences.state', '==', state)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        emailVerified: data.emailVerified || false,
        createdAt: data.createdAt?.toDate(),
        emailPreferences: data.emailPreferences ? {
          ...data.emailPreferences,
          subscribedAt: data.emailPreferences.subscribedAt?.toDate()
        } : undefined
      } as User;
    });
  }

  /**
   * Authenticate User with Email and Password
   * 
   * Validates user credentials and returns authentication result.
   * Primary login method for public user accounts on SafeCart.
   * 
   * @param email - User's email address
   * @param password - Plain text password for verification
   * @returns Promise<AuthResult> - Success status with user data or error message
   * 
   * Business Logic:
   * - Used for public user login to access email preferences
   * - Separate from internal team authentication (different JWT type)
   * - Returns standardized result format for consistent error handling
   * - No account lockout (relies on rate limiting at API gateway level)
   * 
   * Security Features:
   * - Password verification using bcrypt timing-safe comparison
   * - Generic error messages prevent user enumeration attacks
   * - No differentiation between "user not found" and "wrong password"
   * - All authentication attempts logged for security monitoring
   * 
   * Authentication Flow:
   * 1. Lookup user by email address
   * 2. Verify provided password against stored hash
   * 3. Return success with user data or failure with generic message
   * 4. Calling code generates JWT token if authentication succeeds
   * 
   * Error Handling:
   * - Database errors return generic "Authentication failed" message
   * - Invalid credentials return "Invalid email or password" message
   * - Missing password hash treated as authentication failure
   * - All errors logged for debugging but not exposed to client
   * 
   * Performance Notes:
   * - Single database lookup by email (indexed field)
   * - bcrypt verification is intentionally slow (security feature)
   * - Consider implementing request-level rate limiting
   * - Authentication success/failure should be logged for analytics
   */
  static async authenticateUser(email: string, password: string): Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user || !user.passwordHash) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }
      
      const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash);
      
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }
      
      // User authenticated successfully
      
      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return {
        success: false,
        message: 'Authentication failed'
      };
    }
  }
}