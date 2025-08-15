/**
 * ProtectedRoute Component
 * 
 * A higher-order component that provides authentication and authorization
 * protection for pages and components. Automatically redirects unauthenticated
 * users to login and handles role-based access control.
 * 
 * **Authentication Flow:**
 * 1. Check if user authentication is still loading
 * 2. If not authenticated → redirect to `/login`
 * 3. If admin required but user is not admin → redirect to `/unauthorized`
 * 4. Otherwise → render protected content
 * 
 * **Features:**
 * - **Automatic redirects**: Seamless navigation based on auth state
 * - **Role-based protection**: Optional admin-only access control  
 * - **Loading states**: Prevents flash of unauthorized content
 * - **Route protection**: Works with Next.js App Router navigation
 * 
 * **Usage Patterns:**
 * - Wrap entire pages for authentication protection
 * - Use `requireAdmin={true}` for admin-only sections
 * - Handles both component-level and route-level protection
 * 
 * @component
 * @example
 * ```tsx
 * // Basic authentication protection
 * <ProtectedRoute>
 *   <InternalEditPage />
 * </ProtectedRoute>
 * 
 * // Admin-only protection
 * <ProtectedRoute requireAdmin={true}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 * ```
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  /** Child components to render when access is authorized */
  children: React.ReactNode;
  /** Whether admin role is required (defaults to false) */
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { internal_user, isInternalAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  /**
   * Handle authentication and authorization redirects.
   * Only runs after authentication state is fully loaded.
   */
  useEffect(() => {
    if (!isLoading) {
      // Redirect unauthenticated users to internal login
      if (!isInternalAuthenticated) {
        router.push('/internal/login');
        return;
      }

      // Redirect non-admin users away from admin-only routes
      if (requireAdmin && internal_user?.role !== 'admin') {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isInternalAuthenticated, isLoading, internal_user, requireAdmin, router]);

  // Show loading spinner while authentication state is being determined
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        color: 'var(--text)',
        fontSize: '1.1rem'
      }}>
        Loading...
      </div>
    );
  }

  // Prevent flash of unauthorized content during redirects
  if (!isInternalAuthenticated || (requireAdmin && internal_user?.role !== 'admin')) {
    return null;
  }

  // Authentication and authorization checks passed - render protected content
  return <>{children}</>;
};