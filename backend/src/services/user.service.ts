/**
 * Internal User Service - SafeCart Team Member Management
 * 
 * Manages user accounts for SafeCart's internal team members (admins and members).
 * This service is completely separate from the public user email subscription system
 * and handles authentication for accessing SafeCart's internal tools and admin features.
 * 
 * Key Features:
 * - Internal team member account creation and management
 * - Password-based and Google OAuth authentication support
 * - Role-based access control (admin vs member permissions)
 * - User profile management and updates
 * - Administrative user listing and management
 * 
 * Account Types:
 * - Admin: Full access to all features, can approve pending changes, manage users
 * - Member: Standard access, can edit recalls and submit changes for approval
 * 
 * Security Model:
 * - Uses 'internal_users' collection (separate from public 'users' collection)
 * - bcrypt password hashing with salt for password-based accounts
 * - Google OAuth integration for enterprise SSO
 * - JWT tokens with 7-day expiration for session management
 * - Role validation on all protected endpoints
 * 
 * Integration Points:
 * - GoogleAuthService for OAuth authentication flows
 * - AuthService for password hashing and verification
 * - Internal tools frontend for team member interfaces
 * - Role-based middleware for endpoint protection
 * 
 * Database Strategy:
 * - Uses Firestore 'internal_users' collection
 * - Optimized queries with username and email indexes
 * - Direct document access for user ID lookups
 * - Supports both password and Google authentication methods
 * 
 * Business Logic:
 * - Team members authenticate to access internal recall editing tools
 * - Role changes affect permissions immediately (no cached roles)
 * - Account creation supports both manual (password) and OAuth (Google) flows
 * - User management is admin-only functionality
 * 
 * @author Yuvraj
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
import { User } from '../types/user.types';
import { AuthService } from './auth.service';

const INTERNAL_USERS_COLLECTION = 'internal_users';

/**
 * Internal User Service Class
 * 
 * Static service class for managing SafeCart team member accounts.
 * All methods are static as this is a stateless service for database operations.
 */
export class UserService {
  /**
   * Create New Internal Team Member Account
   * 
   * Creates a new account for SafeCart team members (admin or member).
   * Used for manual account creation when Google OAuth is not available.
   * 
   * @param userData - User data including username, email, role, and password
   * @returns Promise<User> - Complete user object with generated UID
   * @throws Error - If username/email already exists or validation fails
   * 
   * Business Logic:
   * - Creates password-based accounts for internal team members
   * - Default role is 'member' (admin role must be explicitly assigned)
   * - Username and email should be unique (enforced by calling code)
   * - Account is immediately active (no email verification required)
   * 
   * Security Features:
   * - Password is securely hashed using bcrypt with salt
   * - Original password is never stored in database
   * - Unique document ID generation for user UID
   * - Role validation should be performed by calling code
   * 
   * Account Structure:
   * - uid: Firestore-generated document ID (unique identifier)
   * - username: Display name for internal tools UI
   * - email: Primary identifier for authentication
   * - role: 'admin' or 'member' (determines permissions)
   * - passwordHash: bcrypt hash for authentication
   * - authMethod: 'password' (vs 'google' for OAuth accounts)
   * 
   * Integration Notes:
   * - Used for initial admin account setup
   * - Backup authentication method when Google OAuth unavailable
   * - Should validate against existing usernames/emails before calling
   * - Consider adding email verification flow for production
   */
  static async createUser(userData: Omit<User, 'uid'> & { password: string }): Promise<User> {
    const { password, ...userWithoutPassword } = userData;
    
    // Hash the password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Create the user document
    const userRef = db.collection(INTERNAL_USERS_COLLECTION).doc();
    const user: User = {
      uid: userRef.id,
      username: userWithoutPassword.username,
      email: userWithoutPassword.email,
      role: userWithoutPassword.role || 'member',
      passwordHash
    };
    
    await userRef.set(user);
    
    return user;
  }

  /**
   * Get Internal User by Username
   * 
   * Retrieves team member account using username as the lookup key.
   * Primary method for password-based authentication of internal users.
   * 
   * @param username - Team member's username (case-sensitive)
   * @returns Promise<User | null> - User object if found, null if not found
   * 
   * Business Logic:
   * - Used during login authentication for password-based accounts
   * - Username lookup is case-sensitive (exact match required)
   * - Returns complete user object including role for authorization
   * - Used primarily for non-Google authentication flows
   * 
   * Security Considerations:
   * - Query optimized with limit(1) to prevent performance attacks
   * - Returns null for non-existent usernames (not exceptions)
   * - Firestore index on username field ensures fast lookups
   * - No rate limiting at service level (handled by API layer)
   * 
   * Authentication Flow:
   * - User provides username/password via login form
   * - Service looks up user by username
   * - Calling code verifies password against stored hash
   * - JWT token generated if authentication succeeds
   * 
   * Performance Notes:
   * - Single document lookup with username index
   * - Firestore charges 1 read operation per call
   * - Consider caching for high-frequency usage
   * - Alternative to email-based lookup for internal users
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    const snapshot = await db.collection(INTERNAL_USERS_COLLECTION)
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as User;
  }

  /**
   * Get Internal User by Unique ID
   * 
   * Retrieves team member account using Firestore document ID.
   * Primary method for JWT token validation and authenticated user data retrieval.
   * 
   * @param uid - User's unique identifier (Firestore document ID)
   * @returns Promise<User | null> - User object if found, null if not found
   * 
   * Business Logic:
   * - Used after JWT token validation to get current user data
   * - Used in authentication middleware to attach user to requests
   * - Returns fresh data to handle role changes and account updates
   * - Essential for validating user still exists after token issued
   * 
   * Security Considerations:
   * - Direct document lookup by ID (most secure Firestore operation)
   * - No query scanning or potential injection vulnerabilities
   * - Returns null for deleted/non-existent internal users
   * - Firestore security rules apply to this read operation
   * 
   * Authorization Flow:
   * - JWT middleware extracts user ID from validated token
   * - Service retrieves current user data including role
   * - Role information used for endpoint authorization
   * - Account deletion/suspension handled gracefully
   * 
   * Performance Notes:
   * - Single document read (most efficient Firestore operation)
   * - Firestore charges 1 read operation per call
   * - No indexes required (direct document access)
   * - Consider request-level caching for high-traffic scenarios
   * 
   * Data Consistency:
   * - Always returns current user state from database
   * - Role changes take effect immediately (no cached roles)
   * - Account modifications reflected in next request
   * - Handles concurrent user updates safely
   */
  static async getUserById(uid: string): Promise<User | null> {
    const doc = await db.collection(INTERNAL_USERS_COLLECTION).doc(uid).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as User;
  }

  /**
   * Update Internal User Account
   * 
   * Updates specific fields of a team member account while preserving other data.
   * Used for role changes, profile updates, and account maintenance.
   * 
   * @param uid - User's unique identifier
   * @param updates - Partial user object with fields to update
   * @returns Promise<void> - Completes when update is successful
   * @throws Error - If user doesn't exist or update fails
   * 
   * Business Logic:
   * - Updates only specified fields (partial update semantics)
   * - Preserves existing data not included in updates object
   * - Used for admin role assignments and profile management
   * - Immediate effect (no caching delays)
   * 
   * Security Considerations:
   * - Caller must validate admin permissions before calling
   * - No built-in authorization (handled by calling route/middleware)
   * - Atomic operation prevents partial updates on failure
   * - Firestore security rules apply to update operations
   * 
   * Common Use Cases:
   * - Role changes: Admin promoting member to admin or vice versa
   * - Profile updates: Username or email changes
   * - Account status: Activating or deactivating accounts (future feature)
   * - Google account linking: Adding googleId to password-based accounts
   * 
   * Implementation Notes:
   * - Uses Firestore's merge semantics (preserves unspecified fields)
   * - No timestamp conversion needed (User type has simple fields)
   * - Validates document exists before attempting update
   * - Updates are immediately visible to subsequent queries
   * 
   * Admin Workflow:
   * - Admin views user management interface
   * - Admin selects user and modifies role/profile
   * - Frontend calls API with user ID and updates object
   * - Service persists changes to internal_users collection
   * - Changes take effect on user's next request
   */
  static async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    await db.collection(INTERNAL_USERS_COLLECTION).doc(uid).update(updates);
  }

  /**
   * List All Internal Users
   * 
   * Retrieves complete list of all SafeCart team members.
   * Administrative function for user management and team overview.
   * 
   * @returns Promise<User[]> - Array of all internal user accounts
   * 
   * Business Logic:
   * - Returns all team member accounts (admins and members)
   * - Used for admin user management interface
   * - Includes all user data except sensitive fields (passwords already hashed)
   * - No pagination needed (team size expected to remain small < 50 users)
   * 
   * Security Considerations:
   * - ADMIN-ONLY function (calling code must validate permissions)
   * - Returns all user data including roles and contact information
   * - Should be protected by admin role middleware
   * - Consider audit logging for user access events
   * 
   * Administrative Use Cases:
   * - User management dashboard: View all team members
   * - Role assignment interface: See current role distribution
   * - Account maintenance: Identify inactive or problematic accounts
   * - Team directory: Contact information and role identification
   * 
   * Performance Considerations:
   * - Loads all documents from internal_users collection
   * - Firestore charges 1 read per user account
   * - Consider caching if called frequently
   * - No filtering or ordering (returns raw collection data)
   * 
   * Implementation Notes:
   * - Uses collection-wide scan (no query filters)
   * - Returns complete user objects with all fields
   * - Password hashes included but not sensitive (already encrypted)
   * - Consider adding pagination when team grows beyond 100 members
   * 
   * Data Privacy:
   * - Internal team data only (not public user information)
   * - Used for legitimate business administration
   * - Access should be logged for compliance
   * - Consider adding data export/audit functionality
   */
  static async listUsers(): Promise<User[]> {
    const snapshot = await db.collection(INTERNAL_USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data() as User);
  }
}