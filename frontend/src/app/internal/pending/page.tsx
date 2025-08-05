'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { EditableRecallList } from '@/components/EditableRecallList';
import { EditModal } from '@/components/EditModal';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { UnifiedRecall } from '@/types/recall.types';
import { EditModalState } from '@/types/display';
import { PendingChange } from '@/types/pending-changes.types';
import styles from '../../page.module.css';

export default function MemberPendingPage() {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  // Use shared pending changes hook to avoid duplicate API calls
  const { pendingChanges, loading, error } = usePendingChanges();

  // Local state for recalls display
  const [recalls, setRecalls] = useState<UnifiedRecall[]>([]);
  
  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    recall: UnifiedRecall | null;
    mode: 'view' | 'edit';
  }>({
    isOpen: false,
    recall: null,
    mode: 'view'
  });

  // Redirect admin users to their admin pending page
  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/internal/admin/pending');
      return;
    }
  }, [user, router]);

  // Fetch member's pending changes and their associated recalls
  // Process pending changes from the shared hook into recalls for display
  useEffect(() => {
    if (!user || user.role !== 'member') return;

    // Create UnifiedRecall objects from pending changes data
    if (pendingChanges.length > 0) {
      const recallsFromPendingChanges = pendingChanges.map((change): UnifiedRecall => {
        // Use the full recall data from originalRecall
        const originalRecall = change.originalRecall;
        
        // Extract title from proposed display or original recall
        const displayTitle = change.proposedDisplay?.previewTitle || 
                           originalRecall?.display?.previewTitle ||
                           originalRecall?.productTitle ||
                           originalRecall?.field_title ||
                           `Recall ${change.recallId}`;
        
        // Create a UnifiedRecall object using the original recall data
        const recall: UnifiedRecall = {
          id: change.recallId, // Use ORIGINAL recall ID so EditModal can find existing pending change
          recallNumber: originalRecall?.recallNumber || change.recallId,
          source: change.recallSource,
          isActive: originalRecall?.isActive ?? true,
          classification: originalRecall?.classification || originalRecall?.field_risk_level || 'Pending Review',
          recallingFirm: originalRecall?.recallingFirm || originalRecall?.recalling_firm || 'Pending Changes',
          productTitle: displayTitle,
          productDescription: originalRecall?.productDescription || originalRecall?.field_summary || `Changes submitted by ${change.proposedBy.username}`,
          reasonForRecall: originalRecall?.reasonForRecall || originalRecall?.reason_for_recall || 'Review Pending',
          recallDate: originalRecall?.recallDate || originalRecall?.report_date || change.proposedAt,
          affectedStates: originalRecall?.affectedStates || originalRecall?.affectedStatesArray || ['Pending Review'],
          images: originalRecall?.images || originalRecall?.processedImages || [],
          display: change.proposedDisplay, // The proposed changes for editing
          originalData: change // Store pending change for reference
        };

        return recall;
      });

      setRecalls(recallsFromPendingChanges);
    } else {
      setRecalls([]);
    }
  }, [user, pendingChanges]); // Depend on pendingChanges from the hook

  const handleEditRecall = (recall: UnifiedRecall) => {
    setEditModal({
      isOpen: true,
      recall,
      mode: 'edit'
    });
  };

  const handleSaveEdit = async (updatedRecall: UnifiedRecall) => {
    // For members, this will create a new pending change or update existing one
    try {
      // The EditModal handles the actual API calls, we just need to refresh
      window.location.reload();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      recall: null,
      mode: 'view'
    });
  };

  // Don't render for admin users (they get redirected)
  if (user?.role === 'admin') {
    return null;
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <main className={styles.main}>
          <Header subtitle="My Pending Changes" />
          <div className="container">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px',
              color: currentTheme.textSecondary 
            }}>
              Loading your pending changes...
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <main className={styles.main}>
          <Header subtitle="My Pending Changes" />
          
          <div className="container">
            <Button 
              variant="secondary"
              onClick={() => router.push('/internal/edit')}
            >
              Back to Edit
            </Button>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px',
              gap: '1rem'
            }}>
              <p style={{ color: currentTheme.danger }}>{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className={styles.main}>
        <Header subtitle="My Pending Changes" />

        <div className="container">
          {recalls.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '300px',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: currentTheme.text, margin: 0 }}>
                No Pending Changes
              </h3>
              <p style={{ color: currentTheme.textSecondary, margin: 0 }}>
                You haven't submitted any changes for approval yet.
              </p>
              <Button 
                variant="primary"
                onClick={() => router.push('/internal/edit')}
              >
                Start Editing Recalls
              </Button>
            </div>
          ) : (
            <div>
              <div style={{ 
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: currentTheme.cardBackground,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: '0.75rem'
              }}>
                <Button 
                  variant="primary"
                  onClick={() => router.push('/internal/edit')}
                >
                  Back to Edit
                </Button>
                <h3 style={{ 
                  color: currentTheme.text, 
                  margin: '1rem 0 0.5rem 0',
                  fontSize: '1.2rem'
                }}>
                  Your Submitted Changes
                </h3>
                <p style={{ 
                  color: currentTheme.textSecondary, 
                  margin: 0,
                  fontSize: '1rem'
                }}>
                  These recalls have changes waiting for admin approval. You can still edit them before they're reviewed.
                </p>
              </div>

              <EditableRecallList
                recalls={recalls}
                loading={false}
                error={null}
                onEdit={handleEditRecall}
              />
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editModal.isOpen && editModal.recall && (
          <EditModal
            recall={editModal.recall}
            onClose={closeEditModal}
            onSave={handleSaveEdit}
          />
        )}
      </main>
    </ProtectedRoute>
  );
}