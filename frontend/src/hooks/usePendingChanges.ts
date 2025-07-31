import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { pendingChangesApi } from '@/services/pending-changes.api';
import { PendingChange } from '@/types/pending-changes.types';

// Shared cache to prevent multiple API calls across hook instances
let sharedPendingChanges: PendingChange[] = [];
let sharedLoading = false;
let sharedError: string | null = null;
let lastUserId: string | null = null;
let fetchPromise: Promise<void> | null = null;

const subscribers = new Set<() => void>();

export function usePendingChanges() {
  const { user, isAuthenticated } = useAuth();
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>(sharedPendingChanges);
  const [loading, setLoading] = useState(sharedLoading);
  const [error, setError] = useState<string | null>(sharedError);
  const subscribedRef = useRef(false);

  const notifySubscribers = () => {
    subscribers.forEach(callback => callback());
  };

  const updateState = () => {
    setPendingChanges([...sharedPendingChanges]);
    setLoading(sharedLoading);
    setError(sharedError);
  };

  const fetchPendingChanges = async () => {
    if (!isAuthenticated || !user) {
      // Clear data when logged out
      sharedPendingChanges = [];
      sharedLoading = false;
      sharedError = null;
      lastUserId = null;
      fetchPromise = null;
      notifySubscribers();
      return;
    }

    // Check if we already have data for this user and no fetch is in progress
    if (lastUserId === user.uid && !sharedLoading && fetchPromise === null) {
      return; // Use cached data
    }

    // If there's already a fetch in progress (for any user), wait for it
    if (fetchPromise) {
      return fetchPromise;
    }

    // Start new fetch - only one fetch can happen at a time
    fetchPromise = (async () => {
      try {
        sharedLoading = true;
        sharedError = null;
        notifySubscribers();
        
        let changes: PendingChange[] = [];
        
        if (user.role === 'admin') {
          // Admins see all pending changes
          changes = await pendingChangesApi.getAllPendingChanges();
        } else {
          // Members see only their own pending changes
          changes = await pendingChangesApi.getMyPendingChanges();
        }
        
        sharedPendingChanges = changes;
        lastUserId = user.uid;
      } catch (err) {
        sharedError = err instanceof Error ? err.message : 'Failed to fetch pending changes';
      } finally {
        sharedLoading = false;
        fetchPromise = null;
        notifySubscribers();
      }
    })();

    return fetchPromise;
  };

  // Subscribe to shared state updates
  useEffect(() => {
    if (!subscribedRef.current) {
      subscribers.add(updateState);
      subscribedRef.current = true;
    }

    return () => {
      subscribers.delete(updateState);
      subscribedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Only fetch if user changed or we don't have data for this user
    if (isAuthenticated && user && (lastUserId !== user.uid)) {
      fetchPendingChanges();
    } else if (!isAuthenticated || !user) {
      fetchPendingChanges(); // This will clear the data
    }
  }, [isAuthenticated, user?.uid]); // Only depend on user.uid, not the entire user object

  // Helper function to check if a recall has pending changes
  const hasPendingChanges = (recallId: string, recallSource: 'USDA' | 'FDA'): boolean => {
    return pendingChanges.some(
      change => change.recallId === recallId && change.recallSource === recallSource
    );
  };

  // Helper function to get pending changes for a specific recall
  const getPendingChangesForRecall = (recallId: string, recallSource: 'USDA' | 'FDA'): PendingChange[] => {
    return pendingChanges.filter(
      change => change.recallId === recallId && change.recallSource === recallSource
    );
  };

  // Helper function to get total count
  const totalPendingCount = pendingChanges.length;

  // Force refetch function
  const refetch = async () => {
    if (!isAuthenticated || !user) return;
    
    // Clear cache to force fresh fetch
    lastUserId = null;
    fetchPromise = null;
    
    await fetchPendingChanges();
  };

  return {
    pendingChanges,
    loading,
    error,
    hasPendingChanges,
    getPendingChangesForRecall,
    totalPendingCount,
    refetch
  };
}