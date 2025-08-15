/**
 * AuthContext - Dual Authentication System for SafeCart
 * 
 * A comprehensive authentication context that manages two distinct user types:
 * 1. Internal Users (Admin/Member) - Team members with edit/admin permissions
 * 2. Account Users (Public) - Regular users managing email alert preferences
 * 
 * ARCHITECTURE OVERVIEW:
 * =====================
 * 
 * This context implements a dual authentication system where both user types
 * can coexist and be authenticated simultaneously. Each type has its own:
 * - Authentication endpoints (/api/auth/* vs /api/user/auth/*)
 * - User state management (internal_user vs account_user)
 * - Authentication flags (isInternalAuthenticated vs isAccountAuthenticated)
 * - Login/logout methods with appropriate naming conventions
 * 
 * SECURITY CONSIDERATIONS:
 * =======================
 * 
 * 1. Token Separation: Internal and account users use different JWT tokens
 *    with different 'type' claims to prevent cross-system access
 * 
 * 2. Independent Validation: Each user type is validated independently,
 *    preventing authentication failures from affecting the other type
 * 
 * 3. Cookie Security: Both systems use httpOnly cookies with appropriate
 *    security flags for production environments
 * 
 * 4. Graceful Degradation: Authentication failures for one user type
 *    don't impact the other, allowing mixed authentication states
 * 
 * USAGE PATTERNS:
 * ==============
 * 
 * Internal Users (Team Members):
 * ```tsx
 * const { internal_user, isInternalAuthenticated, internalLogin, internalLogout } = useAuth();
 * 
 * // Login
 * const success = await internalLogin('username', 'password');
 * 
 * // Check authentication
 * if (isInternalAuthenticated && internal_user?.role === 'admin') {
 *   // Show admin features
 * }
 * ```
 * 
 * Account Users (Public):
 * ```tsx
 * const { account_user, isAccountAuthenticated, accountLogin, accountLogout } = useAuth();
 * 
 * // Login
 * const success = await accountLogin('user@example.com', 'password');
 * 
 * // Check authentication
 * if (isAccountAuthenticated) {
 *   // Show user-specific content
 * }
 * ```
 * 
 * BACKWARD COMPATIBILITY:
 * ======================
 * 
 * Legacy methods (login, logout, user) are maintained for existing internal
 * user components. These map to internal user methods to prevent breaking changes.
 * 
 * @author SafeCart Development Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { InternalUser, AccountUser, AuthState } from '../types/auth.types';
import { authApi } from '../services/auth.api';

/**
 * AuthContext Interface
 * 
 * Extends the base AuthState with authentication methods for both user types.
 * Methods are clearly prefixed to indicate which user type they operate on.
 */
interface AuthContextType extends AuthState {
  // Internal user methods (admin/member team access)
  internalLogin: (username: string, password: string) => Promise<boolean>;
  internalLoginWithGoogle: (idToken: string) => Promise<boolean>;
  internalLogout: () => void;
  
  // Account user methods (public user email preferences)
  accountLogin: (email: string, password: string) => Promise<boolean>;
  accountLogout: () => void;
  accountRegister: (name: string, email: string, password: string) => Promise<boolean>;
  
  // Legacy methods for backward compatibility (internal user only)
  // TODO: Consider deprecating these in favor of explicit internal* methods
  login: (username: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => void;
  user: InternalUser | null; // Legacy property mapping to internal_user
}

/**
 * AuthContext Instance
 * 
 * The React context that holds authentication state and methods.
 * Must be consumed within an AuthProvider.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * useAuth Hook
 * 
 * Custom hook to access authentication context. Provides type-safe access
 * to all authentication methods and state for both user types.
 * 
 * @throws {Error} When used outside of AuthProvider
 * @returns {AuthContextType} Complete authentication context
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { internal_user, isAccountAuthenticated } = useAuth();
 *   // ... component logic
 * }
 * ```
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider Component
 * 
 * React context provider that manages authentication state for both user types.
 * Should wrap the entire application or sections requiring authentication.
 * 
 * INITIALIZATION FLOW:
 * 1. Component mounts with loading state
 * 2. Automatically checks existing authentication for both user types
 * 3. Sets appropriate authentication flags based on valid sessions
 * 4. Exposes methods for login/logout operations
 * 
 * @param children React components that need access to authentication
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication state for both user types
  const [authState, setAuthState] = useState<AuthState>({
    internal_user: null,
    account_user: null,
    isInternalAuthenticated: false,
    isAccountAuthenticated: false,
    isLoading: true
  });

  // Check for existing authentication on mount
  // This enables automatic login restoration after page refreshes
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Check Authentication Status
   * 
   * Validates existing authentication for both user types independently.
   * This function is critical for session restoration after page refreshes.
   * 
   * DESIGN RATIONALE:
   * - Each user type is checked independently to prevent cross-contamination
   * - Failures are expected and handled gracefully (not all users have both types)
   * - No authentication failures prevent checking the other type
   * - State is updated atomically after both checks complete
   * 
   * ENDPOINT BEHAVIOR:
   * - Internal: /api/auth/me returns { success: boolean, user: InternalUser }
   * - Account: /api/user/auth/me returns AccountUser data directly
   * 
   * @private
   */
  const checkAuthStatus = async () => {
    let internal_user = null;
    let isInternalAuthenticated = false;
    let account_user = null;
    let isAccountAuthenticated = false;

    // Check internal user authentication independently
    // Internal users are team members (admin/member roles) with different token types
    try {
      const internalData = await authApi.getCurrentInternalUser();
      if (internalData.success && internalData.user) {
        internal_user = internalData.user;
        isInternalAuthenticated = true;
      }
    } catch (error) {
      // Expected when internal user is not logged in or token is invalid/expired
      // This is normal behavior and should not be treated as an application error
      console.log('Internal auth check failed (expected if not internal user)');
    }

    // Check account user authentication independently
    // Account users are public users managing email alert preferences
    try {
      const accountData = await authApi.getCurrentAccountUser();
      if (accountData && accountData.uid) {
        // Transform backend response to match frontend AccountUser type
        // Backend uses 'uid' while frontend expects 'id'
        account_user = {
          id: accountData.uid,
          name: accountData.name,
          email: accountData.email,
          createdAt: '', // Not provided by /me endpoint - could be enhanced
          emailPreferences: accountData.emailPreferences
        };
        isAccountAuthenticated = true;
      }
    } catch (error) {
      // Expected when account user is not logged in or token is invalid/expired
      // This is normal behavior and should not be treated as an application error
      console.log('Account auth check failed (expected if not account user)');
    }

    // Update authentication state atomically
    // This prevents race conditions and ensures consistent state
    setAuthState({
      internal_user,
      account_user,
      isInternalAuthenticated,
      isAccountAuthenticated,
      isLoading: false
    });
  };

  // ========================================================================
  // INTERNAL USER AUTHENTICATION METHODS
  // ========================================================================
  
  /**
   * Internal User Login
   * 
   * Authenticates team members (admin/member roles) using username/password.
   * Sets internal authentication state on success while preserving account state.
   * 
   * SECURITY FEATURES:
   * - Uses separate JWT token type ('admin'/'member' vs 'user')
   * - httpOnly cookie prevents XSS attacks
   * - 7-day token expiration (shorter than account users)
   * 
   * @param username Internal user's unique username
   * @param password Plain text password (hashed server-side)
   * @returns Promise<boolean> True if authentication successful
   * 
   * @example
   * ```tsx
   * const success = await internalLogin('admin', 'password123');
   * if (success) {
   *   router.push('/internal/edit');
   * }
   * ```
   */
  const internalLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const data = await authApi.internalLogin(username, password);
      
      if (data.success && data.user) {
        // Update only internal user state, preserve account user state
        setAuthState(prev => ({
          ...prev,
          internal_user: data.user,
          isInternalAuthenticated: true,
          isLoading: false
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Internal login failed:', error);
      return false;
    }
  };

  /**
   * Internal User Google Login
   * 
   * Authenticates team members using Google OAuth 2.0.
   * Validates against pre-authorized email list in authorized_emails collection.
   * 
   * AUTHORIZATION FLOW:
   * 1. Google provides idToken after user consent
   * 2. Backend validates token with Google
   * 3. Checks if email exists in authorized_emails collection
   * 4. Creates/updates user record with Google profile data
   * 5. Issues internal JWT token
   * 
   * @param idToken Google OAuth 2.0 ID token from @react-oauth/google
   * @returns Promise<boolean> True if authentication successful
   * 
   * @example
   * ```tsx
   * // In Google OAuth callback
   * const success = await internalLoginWithGoogle(credentialResponse.credential);
   * ```
   */
  const internalLoginWithGoogle = async (idToken: string): Promise<boolean> => {
    try {
      const data = await authApi.internalLoginWithGoogle(idToken);
      
      if (data.success && data.user) {
        // Update only internal user state, preserve account user state
        setAuthState(prev => ({
          ...prev,
          internal_user: data.user,
          isInternalAuthenticated: true,
          isLoading: false
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Internal Google login failed:', error);
      return false;
    }
  };

  /**
   * Internal User Logout
   * 
   * Logs out team member by clearing internal authentication cookie.
   * Preserves account user authentication state if present.
   * 
   * LOGOUT PROCESS:
   * 1. Clear internal authentication cookie server-side
   * 2. Reset internal user state to null
   * 3. Preserve account user state (independent sessions)
   * 
   * NOTE: JWT tokens remain valid until expiration (stateless approach).
   * For high-security applications, consider implementing token blacklisting.
   */
  const internalLogout = async () => {
    try {
      await authApi.internalLogout();
    } catch (error) {
      console.error('Internal logout error:', error);
      // Continue with client-side cleanup even if server call fails
    }
    
    // Clear only internal user state, preserve account user state
    setAuthState(prev => ({
      ...prev,
      internal_user: null,
      isInternalAuthenticated: false
    }));
  };

  // ========================================================================
  // ACCOUNT USER AUTHENTICATION METHODS
  // ========================================================================
  
  /**
   * Account User Login
   * 
   * Authenticates public users for email alert management using email/password.
   * Sets account authentication state on success while preserving internal state.
   * 
   * SECURITY FEATURES:
   * - Uses separate JWT token type ('user' vs 'admin'/'member')
   * - httpOnly cookie prevents XSS attacks
   * - 30-day token expiration (longer for better UX)
   * - Email normalization (lowercase, trimmed)
   * 
   * @param email User's email address (will be normalized)
   * @param password Plain text password (hashed server-side)
   * @returns Promise<boolean> True if authentication successful
   * 
   * @example
   * ```tsx
   * const success = await accountLogin('user@example.com', 'password123');
   * if (success) {
   *   router.push('/');
   * }
   * ```
   */
  const accountLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await authApi.accountLogin(email, password);
      
      if (data.success && data.user) {
        // Update only account user state, preserve internal user state
        setAuthState(prev => ({
          ...prev,
          account_user: {
            id: data.user.uid,
            name: data.user.name,
            email: data.user.email,
            createdAt: '', // Not provided by login endpoint - could be enhanced
            emailPreferences: data.user.emailPreferences
          },
          isAccountAuthenticated: true,
          isLoading: false
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Account login failed:', error);
      return false;
    }
  };

  /**
   * Account User Registration
   * 
   * Creates new public user account and automatically logs them in.
   * Users can register without admin approval (unlike internal users).
   * 
   * REGISTRATION FLOW:
   * 1. Validates email format and password strength (6+ chars)
   * 2. Creates user record with default email preferences (unsubscribed)
   * 3. Automatically logs in user with new account
   * 4. Sends welcome email if preferences are configured
   * 
   * BUSINESS LOGIC:
   * - Email uniqueness enforced at service layer (409 conflict if exists)
   * - Default email preferences are unsubscribed for GDPR compliance
   * - Account creation and login are atomic (both succeed or both fail)
   * 
   * @param name User's display name (will be trimmed)
   * @param email User's email address (will be normalized)
   * @param password Plain text password (6+ chars, hashed server-side)
   * @returns Promise<boolean> True if registration and login successful
   * 
   * @example
   * ```tsx
   * const success = await accountRegister('John Doe', 'john@example.com', 'password123');
   * if (success) {
   *   router.push('/account/alerts?welcome=true');
   * }
   * ```
   */
  const accountRegister = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const data = await authApi.accountRegister(name, email, password);
      
      if (data.success && data.user) {
        // Update only account user state, preserve internal user state
        // Note: Registration automatically logs in the user
        setAuthState(prev => ({
          ...prev,
          account_user: {
            id: data.user.uid,
            name: data.user.name,
            email: data.user.email,
            createdAt: '', // Not provided by register endpoint - could be enhanced
            emailPreferences: data.user.emailPreferences
          },
          isAccountAuthenticated: true,
          isLoading: false
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Account registration failed:', error);
      return false;
    }
  };

  /**
   * Account User Logout
   * 
   * Logs out public user by clearing account authentication cookie.
   * Preserves internal user authentication state if present.
   * 
   * LOGOUT PROCESS:
   * 1. Clear account authentication cookie server-side
   * 2. Reset account user state to null
   * 3. Preserve internal user state (independent sessions)
   * 
   * NOTE: JWT tokens remain valid until expiration (stateless approach).
   * Users can continue using the app in anonymous mode after logout.
   */
  const accountLogout = async () => {
    try {
      await authApi.accountLogout();
    } catch (error) {
      console.error('Account logout error:', error);
      // Continue with client-side cleanup even if server call fails
    }
    
    // Clear only account user state, preserve internal user state
    setAuthState(prev => ({
      ...prev,
      account_user: null,
      isAccountAuthenticated: false
    }));
  };

  // ========================================================================
  // LEGACY COMPATIBILITY METHODS
  // ========================================================================
  
  /**
   * Legacy authentication methods maintained for backward compatibility.
   * These methods map to internal user operations to prevent breaking changes
   * in existing components that haven't been updated to use the new API.
   * 
   * @deprecated Use explicit internalLogin/internalLogout methods instead
   * @todo Consider deprecating these in favor of explicit method names
   */
  const login = internalLogin;
  const loginWithGoogle = internalLoginWithGoogle;
  const logout = internalLogout;

  return (
    <AuthContext.Provider
      value={{
        // Authentication state for both user types
        ...authState,
        
        // Internal user methods (team members)
        internalLogin,
        internalLoginWithGoogle,
        internalLogout,
        
        // Account user methods (public users)
        accountLogin,
        accountLogout,
        accountRegister,
        
        // Legacy methods (backward compatibility)
        login,
        loginWithGoogle,
        logout,
        user: authState.internal_user // Legacy property mapping to internal_user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};