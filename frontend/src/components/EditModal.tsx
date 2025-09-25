/**
 * EditModal Component
 * 
 * A comprehensive modal component for editing recall display properties with role-based functionality.
 * Supports both USDA and FDA recalls with different behavior based on user permissions:
 * 
 * - **Admin Users**: Changes are applied immediately to live data
 * - **Member Users**: Changes are submitted as pending changes for admin approval
 * 
 * Features:
 * - Preview title and URL overrides
 * - Primary image selection with visual grid interface
 * - Card splitting functionality with range controls
 * - Image upload with drag-and-drop support
 * - Real-time preview of changes
 * - Role-aware UI messaging and button text
 * 
 * @component
 * @example
 * ```tsx
 * <EditModal
 *   recall={selectedRecall}
 *   onClose={() => setModalOpen(false)}
 *   onSave={handleRecallUpdate}
 * />
 * ```
 */

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { Button } from './ui/Button';
import { AutocompleteInput } from './ui/AutocompleteInput';
import { UnifiedRecall } from '@/types/recall.types';
import { CardSplit, SplitPreview, UploadedImage } from '@/types/display';
import { api } from '@/services/api';
import { pendingChangesApi } from '@/services/pending-changes.api';
import { getUnifiedRecallImages } from '@/utils/imageUtils';
import { US_STATES } from '@/data/states';
import styles from './EditModal.module.css';

interface EditModalProps {
  /** The recall object to edit (supports both USDA and FDA recalls) */
  recall: UnifiedRecall;
  /** Callback function to close the modal */
  onClose: () => void;
  /** Callback function called after successful save (admin) or submission (member) */
  onSave: (updatedRecall: UnifiedRecall) => void;
}

export function EditModal({ recall, onClose, onSave }: EditModalProps) {
  const { currentTheme } = useTheme();
  const { internal_user } = useAuth();
  const { hasPendingChanges, getPendingChangesForRecall } = usePendingChanges();
  
  // Core state management
  const [editedRecall, setEditedRecall] = useState<UnifiedRecall>(recall);
  
  // Display customization states
  /** Custom title override for the recall */
  const [previewTitle, setPreviewTitle] = useState(recall.display?.previewTitle || '');
  /** Custom URL override for the recall's "Visit USDA/FDA Page" link */
  const [previewUrl, setPreviewUrl] = useState(recall.display?.previewUrl || '');
  /** Index of the primary image to display first (-1 = no primary image) */
  const [primaryImageIndex, setPrimaryImageIndex] = useState(recall.display?.primaryImageIndex ?? -1);
  
  // Card splitting functionality states
  /** Array of card split configurations */
  const [cardSplits, setCardSplits] = useState<CardSplit[]>(recall.display?.cardSplits || []);
  /** Generated previews for each split configuration */
  const [splitPreviews, setSplitPreviews] = useState<SplitPreview[]>([]);
  
  // Image management states
  /** Existing uploaded images (already stored in Firebase) */
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>(recall.display?.uploadedImages || []);
  /** New files selected for upload with preview URLs */
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string; metadata: UploadedImage }[]>([]);
  /** Upload operation status */
  const [isUploading, setIsUploading] = useState(false);
  
  // File input reference for programmatic triggering
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Manual states override states (FDA only)
  const [showStatesSection, setShowStatesSection] = useState(false);
  const [manualStates, setManualStates] = useState<string[]>([]);
  const [currentStateInput, setCurrentStateInput] = useState('');
  const [isSavingStates, setIsSavingStates] = useState(false);

  // Scrapped images configuration states
  const [scrappedImagesEnabled, setScrappedImagesEnabled] = useState(
    recall.display?.scrappedImagesConfig?.enabled !== undefined
      ? recall.display.scrappedImagesConfig.enabled
      : true  // Default to true (enabled)
  );
  const [scrappedImagesOrder, setScrappedImagesOrder] = useState<number[]>(
    recall.display?.scrappedImagesConfig?.order || []
  );
  const [scrappedImagesVisible, setScrappedImagesVisible] = useState<number[]>(
    recall.display?.scrappedImagesConfig?.visibleIndices !== undefined
      ? recall.display.scrappedImagesConfig.visibleIndices
      : (recall.scrapped_images ? Array.from({ length: recall.scrapped_images.count }, (_, i) => i) : [])
  );
  const [isReorderingMode, setIsReorderingMode] = useState(false);
  const [tempOrder, setTempOrder] = useState<number[]>([]);

  // No images available toggle state
  const [noImagesAvailable, setNoImagesAvailable] = useState(
    recall.display?.noImagesAvailable || false
  );

  // Hide from frontend toggle state
  const [hideFromFrontend, setHideFromFrontend] = useState(
    recall.display?.hideFromFrontend || false
  );

  // Check if this is an FDA recall and user is admin
  const isFDARecall = recall.source === 'FDA';
  const canModifyStates = isFDARecall && internal_user?.role === 'admin';

  // Get separate image arrays for editing (avoid duplication)
  const allImages = getUnifiedRecallImages(recall);
  // Extract only the actual processed images (not uploaded ones) for the selection grid
  const processedImages = (recall.images || []).map(img => ({
    originalFilename: img.filename || 'unknown',
    type: img.type as any,
    sourceUrl: img.filename || '',
    storageUrl: img.storageUrl,
    size: 0,
    processedAt: new Date().toISOString()
  }));
  const hasImages = processedImages.length > 0 || uploadedImages.length > 0 || pendingFiles.length > 0;
  const showImageSections = true; // Always show image options for all recalls
  
  // Count scrapped images (if enabled)
  const scrappedImageCount = (scrappedImagesEnabled && recall.scrapped_images)
    ? scrappedImagesVisible.length // Use visible count, not total
    : 0;

  // Total image count including scrapped images and pending files for split calculations
  const totalImageCount = processedImages.length + uploadedImages.length + pendingFiles.length + scrappedImageCount;
  
  // Combined array of all images for split display (including pending)
  const allImagesIncludingPending = [
    ...allImages,
    ...pendingFiles.map(pf => ({
      storageUrl: pf.previewUrl,
      filename: pf.metadata.filename,
      originalFilename: pf.metadata.originalName,
      sourceUrl: pf.previewUrl,
      type: 'pending' as any,
      size: pf.metadata.size,
      processedAt: pf.metadata.uploadedAt
    }))
  ];

  // Generate split previews whenever splits change
  useEffect(() => {
    generateSplitPreviews();
  }, [cardSplits, primaryImageIndex]);
  
  // Initialize manual states for FDA recalls
  useEffect(() => {
    if (isFDARecall && recall.originalData) {
      const fdaData = recall.originalData as any;
      // Check if manual states are already set
      if (fdaData.useManualStates && fdaData.manualStatesOverride) {
        setManualStates(fdaData.manualStatesOverride);
      }
    }
  }, [isFDARecall, recall]);

  const generateSplitPreviews = () => {
    if (!hasImages || cardSplits.length === 0) {
      setSplitPreviews([]);
      return;
    }

    const previews: SplitPreview[] = [];
    
    // Main card preview (from 0 to first split)
    let mainImages = cardSplits[0] ? allImagesIncludingPending.slice(0, cardSplits[0].startIndex) : allImagesIncludingPending;
    
    // Apply primary image reordering for main card
    if (primaryImageIndex >= 0 && primaryImageIndex < mainImages.length) {
      const primaryImage = mainImages[primaryImageIndex];
      mainImages = [primaryImage, ...mainImages.filter((_, i) => i !== primaryImageIndex)];
    }
    
    previews.push({
      splitIndex: -1,
      title: previewTitle || recall.productTitle,
      images: mainImages,
      startIndex: 0,
      endIndex: cardSplits[0]?.startIndex || allImagesIncludingPending.length
    });

    // Split card previews
    cardSplits.forEach((split, index) => {
      let splitImages = allImagesIncludingPending.slice(split.startIndex, split.endIndex);
      
      // Apply primary image reordering for this split
      if (split.primaryImageIndex !== undefined && split.primaryImageIndex >= 0 && split.primaryImageIndex < splitImages.length) {
        const primaryImage = splitImages[split.primaryImageIndex];
        splitImages = [primaryImage, ...splitImages.filter((_, i) => i !== split.primaryImageIndex)];
      }
      
      previews.push({
        splitIndex: index,
        title: split.previewTitle || `${recall.productTitle} - Part ${index + 2}`,
        images: splitImages,
        startIndex: split.startIndex,
        endIndex: split.endIndex
      });
    });

    setSplitPreviews(previews);
  };

  const handleAddSplit = () => {
    // Always allow adding splits now
    
    const lastSplit = cardSplits[cardSplits.length - 1];
    const startIndex = lastSplit ? lastSplit.endIndex : Math.max(1, Math.floor(totalImageCount / 2));
    const endIndex = Math.max(startIndex + 1, totalImageCount);
    
    if (startIndex < endIndex) {
      setCardSplits([...cardSplits, {
        startIndex,
        endIndex,
        previewTitle: ''
      }]);
    }
  };

  const handleRemoveSplit = (index: number) => {
    setCardSplits(cardSplits.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index: number, field: keyof CardSplit, value: any) => {
    const newSplits = [...cardSplits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    
    // Ensure splits don't overlap
    if (field === 'startIndex' || field === 'endIndex') {
      // Adjust adjacent splits if needed
      for (let i = 0; i < newSplits.length; i++) {
        if (i > 0 && newSplits[i].startIndex < newSplits[i-1].endIndex) {
          newSplits[i].startIndex = newSplits[i-1].endIndex;
        }
        if (i < newSplits.length - 1 && newSplits[i].endIndex > newSplits[i+1].startIndex) {
          newSplits[i].endIndex = newSplits[i+1].startIndex;
        }
      }
    }
    
    setCardSplits(newSplits);
  };

  /**
   * Main save handler that routes to appropriate save method based on user role.
   * Admins save changes directly, while members create pending changes for approval.
   */
  const handleSave = async () => {
    try {
      setIsUploading(true);

      // Prepare display data object with only defined values
      const displayData = {
        previewTitle: previewTitle || undefined,
        previewUrl: previewUrl || undefined,
        primaryImageIndex: primaryImageIndex >= 0 ? primaryImageIndex : undefined,
        cardSplits: cardSplits.length > 0 ? cardSplits : undefined,
        uploadedImages: uploadedImages.length > 0 ? uploadedImages : undefined,
        scrappedImagesConfig: recall.scrapped_images && recall.scrapped_images.count > 0 ? {
          enabled: scrappedImagesEnabled,
          visibleIndices: scrappedImagesVisible.length > 0 ? scrappedImagesVisible : undefined,
          order: scrappedImagesOrder.length > 0 ? scrappedImagesOrder : undefined
        } : undefined,
        noImagesAvailable: noImagesAvailable || undefined,
        hideFromFrontend: hideFromFrontend || undefined
      };

      // Role-based routing: Admins save directly, members create pending changes
      if (internal_user?.role === 'admin') {
        await handleAdminSave(displayData);
      } else {
        await handleMemberSave(displayData);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Admin save handler - applies changes immediately to live data.
   * Handles both image upload and display data updates for USDA and FDA recalls.
   * 
   * @param displayData - The display customization data to save
   */
  const handleAdminSave = async (displayData: any) => {
    // Add admin audit information to display data
    const auditedDisplayData = {
      ...displayData,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: internal_user?.username || 'admin'
    };

    let finalRecall: UnifiedRecall;

    if (pendingFiles.length > 0) {
      // Upload new images and update display data in one operation
      const files = pendingFiles.map(pf => pf.file);
      
      // Use source-appropriate API endpoint
      if (recall.isTemp) {
        // Temp recall image upload
        const response = await api.uploadTempRecallImages(recall.id, files, auditedDisplayData);
        
        // Clean up memory from preview URLs
        pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
        setPendingFiles([]);
        
        // Update local state with server response
        finalRecall = {
          ...editedRecall,
          display: response.data.displayData
        };
      } else if (recall.source === 'USDA') {
        const response = await api.uploadImagesAndUpdateDisplay(recall.id, files, auditedDisplayData);
        
        // Clean up memory from preview URLs
        pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
        setPendingFiles([]);
        
        // Update local state with server response
        finalRecall = {
          ...editedRecall,
          display: response.data.displayData
        };
      } else {
        // FDA image upload support
        const response = await api.uploadFDAImagesAndUpdateDisplay(recall.id, files, auditedDisplayData);
        
        // Clean up memory from preview URLs
        pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
        setPendingFiles([]);
        
        // Update local state with server response
        finalRecall = {
          ...editedRecall,
          display: response.data.displayData
        };
      }
    } else {
      // No new images - only update display customization data
      if (recall.isTemp) {
        await api.updateTempRecallDisplay(recall.id, auditedDisplayData);
      } else if (recall.source === 'USDA') {
        await api.updateRecallDisplay(recall.id, auditedDisplayData);
      } else {
        await api.updateFDARecallDisplay(recall.id, auditedDisplayData);
      }
      
      // Update local state with new display data
      finalRecall = {
        ...editedRecall,
        display: auditedDisplayData
      };
    }
    
    // Notify parent component and close modal
    onSave(finalRecall);
    alert('Changes saved successfully!');
  };

  /**
   * Member save handler - creates pending changes for admin approval.
   * Images are uploaded to pending change only (NOT to live recall).
   * 
   * @param displayData - The display customization data to submit for approval
   */
  const handleMemberSave = async (displayData: any) => {
    // Clean up any undefined values in the proposed display data
    const cleanProposedDisplay = JSON.parse(JSON.stringify(displayData, (key, value) => 
      value === undefined ? null : value
    ));
    
    // Step 1: Create/update pending change WITHOUT images first
    const pendingChange = await pendingChangesApi.createPendingChange({
      recallId: recall.id,
      recallSource: recall.isTemp ? 'TEMP_FDA' : recall.source,
      originalRecall: recall, // Store full recall data to avoid additional API calls
      proposedDisplay: cleanProposedDisplay
    });

    // Step 2: If there are pending files, upload them to the pending change
    if (pendingFiles.length > 0) {
      const files = pendingFiles.map(pf => pf.file);
      
      // Upload images to PENDING CHANGE (not live recall)
      const uploadResponse = await pendingChangesApi.uploadImagesToPendingChange(
        pendingChange.id,
        files,
        cleanProposedDisplay
      );
      
      // Clean up memory from preview URLs
      pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
      setPendingFiles([]);
    }

    // Close modal and let parent handle pending changes refresh
    onSave(recall); // Pass original recall since changes are pending
    alert('Changes submitted for approval! An admin will review your changes.');
  };

  const handleReset = async () => {
    try {
      // Clear all display data in state
      setPreviewTitle('');
      setPreviewUrl('');
      setPrimaryImageIndex(-1);
      setCardSplits([]);
      setUploadedImages([]);
      setScrappedImagesEnabled(false);
      setScrappedImagesOrder([]);
      setScrappedImagesVisible([]);
      setIsReorderingMode(false);
      setTempOrder([]);
      
      // Clean up pending files and their preview URLs
      pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
      setPendingFiles([]);
      
      // Only admins can directly reset data
      if (internal_user?.role === 'admin') {
        // Make API call to clear display data based on source
        if (recall.isTemp) {
          await api.updateTempRecallDisplay(recall.id, undefined);
        } else if (recall.source === 'USDA') {
          await api.updateRecallDisplay(recall.id, undefined);
        } else {
          await api.updateFDARecallDisplay(recall.id, undefined);
        }
        
        // Create recall with empty display for local state
        const updatedRecall: UnifiedRecall = {
          ...editedRecall,
          display: undefined // Remove display object entirely
        };
        
        // Update local state
        onSave(updatedRecall);
        alert('Reset completed successfully!');
      } else {
        // For members, check if this recall has pending changes
        const recallSource = recall.isTemp ? 'TEMP_FDA' : recall.source;
        if (hasPendingChanges(recall.id, recallSource)) {
          // If it has pending changes, withdraw them (remove from pending queue)
          const pendingChangesForRecall = getPendingChangesForRecall(recall.id, recallSource);
          
          if (pendingChangesForRecall.length > 0) {
            // Withdraw the pending change (members can withdraw their own changes)
            const pendingChangeId = pendingChangesForRecall[0].id;
            await pendingChangesApi.withdrawPendingChange(pendingChangeId);
            
            // Let parent handle pending changes refresh
            onSave(recall); // Pass original recall since pending changes were removed
            alert('Pending changes removed! The recall has been returned to its original state.');
          }
        } else {
          // No pending changes to remove
          alert('Form reset. Note: Only admins can permanently reset recall data.');
        }
      }
    } catch (error) {
      console.error('Reset failed:', error);
      alert(`Failed to reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Manual states handlers
  const handleAddState = () => {
    if (currentStateInput && !manualStates.includes(currentStateInput)) {
      setManualStates([...manualStates, currentStateInput]);
      setCurrentStateInput('');
    }
  };
  
  const handleRemoveState = (stateToRemove: string) => {
    setManualStates(manualStates.filter(state => state !== stateToRemove));
  };
  
  const handleSaveManualStates = async () => {
    if (!isFDARecall || !internal_user || internal_user.role !== 'admin') return;
    
    setIsSavingStates(true);
    try {
      // Use the appropriate API method based on whether it's a temp recall
      if (recall.isTemp) {
        await api.updateTempRecallManualStates(recall.id, manualStates, manualStates.length > 0);
      } else {
        // For regular FDA recalls, use the existing fetch approach since there's no API method yet
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fda/recalls/${recall.id}/manual-states`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            states: manualStates,
            useManualStates: manualStates.length > 0
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to save manual states');
        }
      }
      
      alert('Manual states saved successfully');
      setShowStatesSection(false);
    } catch (error) {
      alert(`Failed to save manual states: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingStates(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      // Convert FileList to Array and validate image files
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024 // 10MB limit
      );
      
      if (imageFiles.length === 0) {
        alert('Please select valid image files (max 10MB each).');
        return;
      }

      // Create pending file objects for preview and later upload
      const newPendingFiles = imageFiles.map(file => {
        const metadata: UploadedImage = {
          filename: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${file.name}`,
          originalName: file.name,
          type: 'uploaded-image' as const,
          storageUrl: '', // Will be set after upload
          uploadedAt: new Date().toISOString(),
          uploadedBy: internal_user?.username || 'unknown-user',
          size: file.size
        };

        return {
          file,
          previewUrl: URL.createObjectURL(file),
          metadata
        };
      });

      // Add to pending files for display and later upload
      setPendingFiles(prev => [...prev, ...newPendingFiles]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload preparation failed:', error);
      alert('Failed to prepare images for upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveUploadedImage = (index: number) => {
    setUploadedImages(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const updated = [...prev];
      // Clean up the object URL to prevent memory leaks
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        onClick={e => e.stopPropagation()}
        style={{ 
          backgroundColor: currentTheme.cardBackground,
          color: currentTheme.text
        }}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2>Edit Recall Display</h2>
            {internal_user && (
              <p style={{ 
                fontSize: '0.875rem', 
                color: currentTheme.textSecondary,
                margin: '0.25rem 0 0 0'
              }}>
                {internal_user.role === 'admin' 
                  ? 'Changes will be applied immediately' 
                  : 'Changes will be submitted for admin approval'
                }
              </p>
            )}
          </div>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            style={{ color: currentTheme.textSecondary }}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Administrative Controls */}
          <div className={styles.section}>
            <h3>Visibility Control</h3>
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel} style={{ color: currentTheme.text, fontSize: '0.875rem' }}>
                Hide recall from public website:
              </label>
              <label htmlFor="hideFromFrontendToggle">
                <input
                  id="hideFromFrontendToggle"
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={hideFromFrontend}
                  onChange={(e) => setHideFromFrontend(e.target.checked)}
                />
                <div className={styles.toggleSwitch} />
              </label>
            </div>
            <p style={{
              color: currentTheme.textSecondary,
              fontSize: '0.75rem'
            }}>
              Enable this to prevent duplicate recalls from appearing on the frontend
            </p>
          </div>

          {/* Original Title Display */}
          <div className={styles.section}>
            <h3>Original Information</h3>
            <div className={styles.originalInfo}>
              <p><strong>Original Title:</strong> {recall.originalData?.field_title || recall.originalData?.product_description || recall.productTitle}</p>
              {recall.llmTitle && (
                <p><strong>AI-Enhanced Title:</strong> {recall.llmTitle}</p>
              )}
              <p><strong>Recall Number:</strong> {recall.recallNumber}</p>
              <p><strong>Images:</strong> {totalImageCount}</p>
            </div>
          </div>

          {/* Preview Title */}
          <div className={styles.section}>
            <h3>Preview Title</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--color-textSecondary)', marginBottom: '0.5rem' }}>
              Title priority: Custom Preview → AI-Enhanced → Original
            </p>
            <input
              type="text"
              value={previewTitle}
              onChange={(e) => setPreviewTitle(e.target.value)}
              placeholder={recall.llmTitle ? "Leave empty to use AI-enhanced title" : "Leave empty to use original title"}
              className={styles.input}
              style={{ 
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.cardBorder,
                color: currentTheme.text
              }}
            />
          </div>

          {/* Recall URL */}
          <div className={styles.section}>
            <h3>Recall URL</h3>
            <p className={styles.sectionDescription}>
              Override the recall URL. If set, this URL will be used when users click "Visit USDA Page" or "Visit FDA Page"
            </p>
            <input
              type="url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="Leave empty to use default URL behavior"
              className={styles.input}
              style={{ 
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.cardBorder,
                color: currentTheme.text
              }}
            />
          </div>

          {/* Primary Image Selection for Main Card */}
          {showImageSections && (
            <div className={styles.section}>
              <h3>Primary Image for Main Card</h3>
              <p className={styles.sectionDescription}>
                Select which image should appear first in the main card. Images in splits are shown greyed out and not selectable.
              </p>
              <div className={styles.imageGrid}>
                {/* Show ALL processed images, but grey out ones in splits */}
                {processedImages.map((img, index) => {
                  const isInSplit = cardSplits.length > 0 && index >= cardSplits[0].startIndex;
                  const isSelectable = !isInSplit;
                  
                  return (
                  <div 
                    key={index}
                    className={`${styles.imageThumb} ${primaryImageIndex === index && isSelectable ? styles.selected : ''}`}
                    onClick={() => isSelectable && setPrimaryImageIndex(index)}
                    style={{ 
                      borderColor: primaryImageIndex === index && isSelectable ? currentTheme.primary : currentTheme.cardBorder,
                      opacity: isInSplit ? 0.5 : 1,
                      cursor: isSelectable ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <img 
                      src={img.storageUrl || '/placeholder.png'} 
                      alt={`Main Card Image ${index + 1}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                    <span className={styles.imageNumber}>#{index + 1}</span>
                  </div>
                  );
                })}
                
                {/* Already Uploaded Images */}
                {uploadedImages.map((img, index) => {
                  const adjustedIndex = processedImages.length + index; // Uploaded images come after processed images
                  const isInSplit = cardSplits.length > 0 && adjustedIndex >= cardSplits[0].startIndex;
                  const isSelectable = !isInSplit;
                  
                  return (
                  <div 
                    key={`uploaded-${index}`}
                    className={`${styles.imageThumb} ${styles.uploaded} ${primaryImageIndex === adjustedIndex && isSelectable ? styles.selected : ''}`}
                    onClick={() => isSelectable && setPrimaryImageIndex(adjustedIndex)}
                    style={{ 
                      borderColor: primaryImageIndex === adjustedIndex && isSelectable ? currentTheme.primary : currentTheme.cardBorder,
                      position: 'relative',
                      opacity: isInSplit ? 0.5 : 1,
                      cursor: isSelectable ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <img 
                      src={img.storageUrl} 
                      alt={`Uploaded Image ${index + 1}`}
                    />
                    <span className={styles.imageNumber}>U{index + 1}</span>
                    <button
                      className={styles.removeButton}
                      onClick={() => handleRemoveUploadedImage(index)}
                      style={{ 
                        backgroundColor: currentTheme.danger,
                        color: 'white'
                      }}
                      title="Remove uploaded image"
                    >
                      ×
                    </button>
                  </div>
                  );
                })}
                
                {/* Pending Files (to be uploaded on save) */}
                {pendingFiles.map((pendingFile, index) => {
                  const adjustedIndex = processedImages.length + uploadedImages.length + index; // Pending files come after uploaded images
                  const isInSplit = cardSplits.length > 0 && adjustedIndex >= cardSplits[0].startIndex;
                  const isSelectable = !isInSplit;
                  
                  return (
                  <div 
                    key={`pending-${index}`}
                    className={`${styles.imageThumb} ${styles.uploaded} ${styles.pending} ${primaryImageIndex === adjustedIndex && isSelectable ? styles.selected : ''}`}
                    onClick={() => isSelectable && setPrimaryImageIndex(adjustedIndex)}
                    style={{ 
                      borderColor: primaryImageIndex === adjustedIndex && isSelectable ? currentTheme.primary : currentTheme.primary,
                      borderStyle: primaryImageIndex === adjustedIndex && isSelectable ? 'solid' : 'dashed',
                      position: 'relative',
                      opacity: isInSplit ? 0.5 : 1,
                      cursor: isSelectable ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <img 
                      src={pendingFile.previewUrl} 
                      alt={`Pending Image ${index + 1}`}
                    />
                    <span className={styles.imageNumber} style={{ backgroundColor: currentTheme.primary }}>
                      P{index + 1}
                    </span>
                    <button
                      className={styles.removeButton}
                      onClick={() => handleRemovePendingFile(index)}
                      style={{ 
                        backgroundColor: currentTheme.danger,
                        color: 'white'
                      }}
                      title="Remove pending image"
                    >
                      ×
                    </button>
                  </div>
                  );
                })}
                
                {/* Upload Button */}
                <div 
                  className={`${styles.imageThumb} ${styles.uploadButton}`}
                  onClick={handleUploadClick}
                  style={{ 
                    borderColor: currentTheme.primary,
                    borderStyle: 'dashed',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    opacity: isUploading ? 0.6 : 1
                  }}
                >
                  <div className={styles.uploadContent}>
                    <svg 
                      fill={currentTheme.primary} 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                      width="40"
                      height="40"
                    >
                      <path d="M19,13a1,1,0,0,0-1,1v.38L16.52,12.9a2.79,2.79,0,0,0-3.93,0l-.7.7L9.41,11.12a2.85,2.85,0,0,0-3.93,0L4,12.6V7A1,1,0,0,1,5,6h7a1,1,0,0,0,0-2H5A3,3,0,0,0,2,7V19a3,3,0,0,0,3,3H17a3,3,0,0,0,3-3V14A1,1,0,0,0,19,13ZM5,20a1,1,0,0,1-1-1V15.43l2.9-2.9a.79.79,0,0,1,1.09,0l3.17,3.17,0,0L15.46,20Zm13-1a.89.89,0,0,1-.18.53L13.31,15l.7-.7a.77.77,0,0,1,1.1,0L18,17.21ZM22.71,4.29l-3-3a1,1,0,0,0-.33-.21,1,1,0,0,0-.76,0,1,1,0,0,0-.33.21l-3,3a1,1,0,0,0,1.42,1.42L18,4.41V10a1,1,0,0,0,2,0V4.41l1.29,1.3a1,1,0,0,0,1.42,0A1,1,0,0,0,22.71,4.29Z" />
                    </svg>
                    <span style={{ color: currentTheme.primary, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {isUploading ? 'Uploading...' : 'Upload Images'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => setPrimaryImageIndex(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: currentTheme.textSecondary,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  textDecoration: 'underline'
                }}
              >
                Clear primary image
              </button>

              {/* No Images Available Toggle */}
              <div style={{ paddingBottom: '1.5rem', marginBottom: '-1rem', borderBottom: `1px solid ${currentTheme.cardBorder}` }}>
                <div className={styles.toggleRow}>
                  <label className={styles.toggleLabel} style={{ color: currentTheme.text, fontSize: '0.875rem' }}>
                    No images found anywhere:
                  </label>
                  <label htmlFor="noImagesToggle">
                    <input
                      id="noImagesToggle"
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={noImagesAvailable}
                      onChange={(e) => setNoImagesAvailable(e.target.checked)}
                    />
                    <div className={styles.toggleSwitch} />
                  </label>
                </div>
                <p style={{
                  color: currentTheme.textSecondary,
                  fontSize: '0.75rem'
                }}>
                  Check this if you've searched for images but couldn't find any
                </p>
              </div>
            </div>
          )}

          {/* Scrapped Images Toggle - Only show if recall has scrapped images */}
          {recall.scrapped_images && recall.scrapped_images.count > 0 && (
            <div className={styles.section}>
              <h3>Scraped Images</h3>
              <p className={styles.sectionDescription}>
                {recall.scrapped_images.count} images were automatically scraped from the FDA website.
                Toggle to include them in the recall display.
              </p>

              {/* Toggle Switch */}
              <div className={styles.toggleRow}>
                <label className={styles.toggleLabel} style={{ color: currentTheme.text }}>
                  Show scraped images:
                </label>
                <label htmlFor="scrappedImagesToggle">
                  <input
                    id="scrappedImagesToggle"
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={scrappedImagesEnabled}
                    onChange={(e) => setScrappedImagesEnabled(e.target.checked)}
                  />
                  <div className={styles.toggleSwitch} />
                </label>
              </div>

              {/* Image Management Grid - Only show when enabled */}
              {scrappedImagesEnabled && (
                <div className={styles.scrappedImagesGrid}>
                  <p className={styles.gridDescription} style={{ color: currentTheme.textSecondary, marginBottom: '0.75rem' }}>
                    {isReorderingMode
                      ? `Reordering ${scrappedImagesVisible.length} selected images - click them in your preferred order:`
                      : 'Select which images to show:'}
                  </p>

                  <div className={styles.imageGrid}>
                    {recall.scrapped_images.urls.map((url, index) => {
                      // In reorder mode, only show visible images
                      if (isReorderingMode && !scrappedImagesVisible.includes(index)) {
                        return null;
                      }

                      return (
                      <div
                        key={`scrapped-${index}`}
                        className={styles.scrappedImageItem}
                        onClick={(e) => {
                          // Only process click if not clicking on download button
                          if (!(e.target as HTMLElement).closest(`.${styles.downloadButton}`)) {
                            if (isReorderingMode) {
                              // In reordering mode, add/remove from order
                              const orderIndex = tempOrder.indexOf(index);
                              if (orderIndex >= 0) {
                                // Remove from order
                                setTempOrder(tempOrder.filter(i => i !== index));
                              } else {
                                // Add to order
                                setTempOrder([...tempOrder, index]);
                              }
                            } else {
                              // Normal mode - toggle visibility
                              if (scrappedImagesVisible.includes(index)) {
                                setScrappedImagesVisible(scrappedImagesVisible.filter(i => i !== index));
                              } else {
                                setScrappedImagesVisible([...scrappedImagesVisible, index]);
                              }
                            }
                          }
                        }}
                        style={{
                          borderColor: isReorderingMode
                            ? (tempOrder.includes(index) ? currentTheme.primary : currentTheme.cardBorder)
                            : (scrappedImagesVisible.includes(index) ? currentTheme.primary : currentTheme.cardBorder),
                          borderWidth: isReorderingMode && tempOrder.includes(index) ? '3px' : '2px',
                          position: 'relative',
                          backgroundColor: 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        {/* Checkbox for visibility OR order number for reordering */}
                        {isReorderingMode ? (
                          // Show order number in reordering mode
                          tempOrder.includes(index) && (
                            <div
                              className={styles.imageCheckbox}
                              style={{
                                backgroundColor: currentTheme.primary,
                                borderColor: currentTheme.primary,
                                pointerEvents: 'none',
                                fontWeight: 'bold',
                                fontSize: '0.875rem',
                                color: 'white'
                              }}
                            >
                              {tempOrder.indexOf(index) + 1}
                            </div>
                          )
                        ) : (
                          // Show checkbox in normal mode
                          <div
                            className={styles.imageCheckbox}
                            style={{
                              backgroundColor: scrappedImagesVisible.includes(index) ? currentTheme.primary : 'transparent',
                              borderColor: currentTheme.primary,
                              pointerEvents: 'none'
                            }}
                          >
                            {scrappedImagesVisible.includes(index) && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            )}
                          </div>
                        )}

                        {/* Image thumbnail */}
                        <img
                          src={url}
                          alt={`Scraped ${index + 1}`}
                          style={{
                            opacity: isReorderingMode
                              ? (tempOrder.includes(index) ? 1 : 0.5)
                              : (scrappedImagesVisible.includes(index) ? 1 : 0.4),
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            margin: 0,
                            padding: 0,
                            pointerEvents: 'none' // Disable pointer events to let parent handle click
                          }}
                        />

                        {/* Image number badge - show display position */}
                        {!isReorderingMode && (
                          <div
                            className={styles.imageBadge}
                            style={{
                              backgroundColor: scrappedImagesVisible.includes(index)
                                ? currentTheme.primary
                                : currentTheme.textSecondary,
                              color: 'white',
                              opacity: scrappedImagesVisible.includes(index) ? 1 : 0.6
                            }}
                          >
                            {(() => {
                              if (scrappedImagesVisible.includes(index) && scrappedImagesOrder.length > 0) {
                                // For visible images with custom order, calculate display position
                                const positionInOrder = scrappedImagesOrder.indexOf(index);

                                // Count how many visible images come before this one in the order
                                let displayPosition = 1;
                                for (let i = 0; i < positionInOrder; i++) {
                                  if (scrappedImagesVisible.includes(scrappedImagesOrder[i])) {
                                    displayPosition++;
                                  }
                                }
                                return displayPosition;
                              } else {
                                // For non-visible or non-ordered images, show original position
                                return index + 1;
                              }
                            })()}
                          </div>
                        )}

                        {/* Download button */}
                        <button
                          className={styles.downloadButton}
                          onClick={async () => {
                            try {
                              // Use backend endpoint to download the image
                              const filename = `scraped-${recall.recallNumber}-${index + 1}.jpg`;
                              const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/recalls/download-image?` +
                                `url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

                              const response = await fetch(downloadUrl, {
                                credentials: 'include'
                              });

                              if (!response.ok) {
                                throw new Error('Failed to download image');
                              }

                              const blob = await response.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = filename;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Failed to download image:', error);
                              alert('Failed to download image');
                            }
                          }}
                          style={{
                            color: currentTheme.primary
                          }}
                          title="Download image"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2V10M8 10L5 7M8 10L11 7M2 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                      );
                    })}
                  </div>

                  {/* Bulk actions */}
                  <div className={styles.bulkActions}>
                    {isReorderingMode ? (
                      // Reorder mode buttons
                      <>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => {
                            // Create a new order array that maintains positions for all images
                            const newOrder: number[] = [];

                            // First, add the reordered visible images
                            tempOrder.forEach(index => {
                              newOrder.push(index);
                            });

                            // Then add any visible images that weren't reordered (shouldn't happen but safe)
                            scrappedImagesVisible.forEach(index => {
                              if (!newOrder.includes(index)) {
                                newOrder.push(index);
                              }
                            });

                            // Finally, add all non-visible images at the end to maintain their relative order
                            for (let i = 0; i < recall.scrapped_images!.count; i++) {
                              if (!newOrder.includes(i)) {
                                newOrder.push(i);
                              }
                            }

                            setScrappedImagesOrder(newOrder);
                            setIsReorderingMode(false);
                          }}
                          disabled={tempOrder.length === 0}
                        >
                          Apply Order
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setTempOrder([]);
                            setIsReorderingMode(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      // Normal mode buttons
                      <>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setScrappedImagesVisible(
                            Array.from({ length: recall.scrapped_images!.count }, (_, i) => i)
                          )}
                        >
                          Show All
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setScrappedImagesVisible([])}
                        >
                          Hide All
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setIsReorderingMode(true);
                            setTempOrder([]);
                          }}
                          disabled={scrappedImagesVisible.length === 0}
                        >
                          Reorder Images
                        </Button>
                        {scrappedImagesOrder.length > 0 && (
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setScrappedImagesOrder([]);
                              alert('Image order has been reset to default');
                            }}
                          >
                            Reset Order
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card Splitting */}
          {showImageSections && (
            <div className={styles.section}>
              <h3>Card Splitting</h3>
              <p className={styles.sectionDescription}>
                Split this recall into multiple cards based on images
              </p>
              
              <Button 
                variant="secondary" 
                size="small" 
                onClick={handleAddSplit}
                disabled={cardSplits.length >= totalImageCount - 1}
              >
                + Add Split Point
              </Button>

              {cardSplits.map((split, index) => (
                <div key={index} className={styles.splitConfig}>
                  <h4>Split {index + 1}</h4>
                  <div className={styles.splitControls}>
                    <div className={styles.rangeControl}>
                      <label>Start Image:</label>
                      <input
                        type="number"
                        min={index === 0 ? 1 : cardSplits[index - 1]?.endIndex || 1}
                        max={split.endIndex - 1}
                        value={split.startIndex + 1}
                        onChange={(e) => handleSplitChange(index, 'startIndex', parseInt(e.target.value) - 1)}
                        className={styles.numberInput}
                        style={{ 
                          backgroundColor: currentTheme.background,
                          borderColor: currentTheme.cardBorder,
                          color: currentTheme.text
                        }}
                      />
                    </div>
                    <div className={styles.rangeControl}>
                      <label>End Image:</label>
                      <input
                        type="number"
                        min={split.startIndex + 1}
                        max={index === cardSplits.length - 1 ? totalImageCount : cardSplits[index + 1]?.startIndex || totalImageCount}
                        value={split.endIndex}
                        onChange={(e) => handleSplitChange(index, 'endIndex', parseInt(e.target.value))}
                        className={styles.numberInput}
                        style={{ 
                          backgroundColor: currentTheme.background,
                          borderColor: currentTheme.cardBorder,
                          color: currentTheme.text
                        }}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={split.previewTitle || ''}
                    onChange={(e) => handleSplitChange(index, 'previewTitle', e.target.value)}
                    placeholder={`${recall.productTitle} - Part ${index + 2}`}
                    className={styles.input}
                    style={{ 
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.cardBorder,
                      color: currentTheme.text,
                      marginTop: '0.5rem'
                    }}
                  />
                  
                  {/* Primary Image Selection for this Split */}
                  <div style={{ marginTop: '1rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Primary Image for this Split:</h5>
                    <div className={styles.imageGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                      {allImagesIncludingPending.slice(split.startIndex, split.endIndex).map((img, imgIndex) => (
                        <div 
                          key={imgIndex}
                          className={`${styles.imageThumb} ${split.primaryImageIndex === imgIndex ? styles.selected : ''}`}
                          onClick={() => handleSplitChange(index, 'primaryImageIndex', imgIndex)}
                          style={{ 
                            borderColor: split.primaryImageIndex === imgIndex ? currentTheme.primary : currentTheme.cardBorder
                          }}
                        >
                          <img 
                            src={img.storageUrl || '/placeholder.png'} 
                            alt={`Split ${index + 1} Image ${imgIndex + 1}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.png';
                            }}
                          />
                          <span className={styles.imageNumber}>#{imgIndex + 1}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSplitChange(index, 'primaryImageIndex', undefined)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: currentTheme.textSecondary,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        marginTop: '0.5rem',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear primary image
                    </button>
                  </div>
                  
                  <Button 
                    variant="secondary" 
                    size="small" 
                    onClick={() => handleRemoveSplit(index)}
                    className={styles.removeSplitButton}
                  >
                    Remove Split
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {splitPreviews.length > 0 && (
            <div className={styles.section}>
              <h3>Card Preview</h3>
              <div className={styles.previewCards}>
                {splitPreviews.map((preview, index) => (
                  <div 
                    key={index} 
                    className={styles.previewCard}
                    style={{ 
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.cardBorder
                    }}
                  >
                    <h4>{preview.title}</h4>
                    <p>{preview.images.length} images</p>
                    <p className={styles.imageRange}>
                      Images {preview.startIndex + 1} - {preview.endIndex}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual States Override (FDA only, Admin only) */}
          {canModifyStates && (
            <div className={styles.section}>
              <h3>States Management</h3>
              <p className={styles.sectionDescription}>
                Override the affected states for this FDA recall
              </p>
              
              {!showStatesSection ? (
                <Button 
                  variant="secondary" 
                  size="small" 
                  onClick={() => setShowStatesSection(true)}
                >
                  Modify States
                </Button>
              ) : (
                <div className={styles.statesEditor}>
                  {/* Display current information */}
                  <div className={styles.statesInfo} style={{
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.cardBorder,
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    border: `1px solid ${currentTheme.cardBorder}`
                  }}>
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong>Distribution Pattern:</strong>
                    </p>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: currentTheme.textSecondary,
                      marginBottom: '1rem',
                      fontStyle: 'italic',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '100%',
                      overflow: 'hidden'
                    }}>
                      {(recall.originalData as any)?.distribution_pattern || 'No distribution pattern available'}
                    </p>
                    
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong>Current Affected States:</strong>
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {recall.affectedStates?.length > 0 ? (
                        recall.affectedStates.map(state => (
                          <span 
                            key={state}
                            className={styles.stateBadge}
                            style={{
                              backgroundColor: `${currentTheme.primary}20`,
                              color: currentTheme.primary,
                              border: `1px solid ${currentTheme.primary}`,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem'
                            }}
                          >
                            {state}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: currentTheme.textSecondary, fontSize: '0.875rem' }}>
                          No states detected
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Manual states editor */}
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                      Manual States Override:
                    </p>
                    
                    {/* State input with add button */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <AutocompleteInput
                          options={US_STATES.filter(state => state.value !== 'ALL')}
                          value={currentStateInput}
                          onChange={setCurrentStateInput}
                          placeholder="Select a state to add..."
                        />
                      </div>
                      <button
                        onClick={handleAddState}
                        disabled={!currentStateInput || manualStates.includes(currentStateInput)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: currentTheme.primary,
                          color: currentTheme.buttonPrimaryText,
                          border: 'none',
                          cursor: currentStateInput && !manualStates.includes(currentStateInput) ? 'pointer' : 'not-allowed',
                          opacity: !currentStateInput || manualStates.includes(currentStateInput) ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          fontWeight: 'bold'
                        }}
                      >
                        +
                      </button>
                    </div>
                    
                    {/* Display selected states as badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                      {manualStates.length > 0 ? (
                        manualStates.map(state => (
                          <span 
                            key={state}
                            className={styles.stateBadgeEditable}
                            style={{
                              backgroundColor: currentTheme.primary,
                              color: currentTheme.buttonPrimaryText,
                              padding: '0.375rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.875rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            {state}
                            <button
                              onClick={() => handleRemoveState(state)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: currentTheme.buttonPrimaryText,
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '1rem',
                                lineHeight: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px'
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={{ color: currentTheme.textSecondary, fontSize: '0.875rem' }}>
                          No manual states added yet
                        </span>
                      )}
                    </div>
                    
                    {/* Save/Cancel buttons for states */}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="secondary" 
                        size="small"
                        onClick={() => {
                          setShowStatesSection(false);
                          // Reset to original states if they exist
                          if (recall.originalData) {
                            const fdaData = recall.originalData as any;
                            if (fdaData.useManualStates && fdaData.manualStatesOverride) {
                              setManualStates(fdaData.manualStatesOverride);
                            } else {
                              setManualStates([]);
                            }
                          }
                          setCurrentStateInput('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="primary" 
                        size="small"
                        onClick={handleSaveManualStates}
                        disabled={isSavingStates || manualStates.length === 0}
                      >
                        {isSavingStates ? 'Saving...' : 'Save States'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button 
              variant="secondary" 
              onClick={handleReset}
              style={{ 
                backgroundColor: currentTheme.danger,
                color: currentTheme.buttonPrimaryText,
                border: 'none'
              }}
            >
              {internal_user?.role === 'admin' ? 'Reset All' : 'Reset'}
            </Button>
          </div>
          <div className={styles.modalFooterButtons}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUploading}>
              {isUploading 
                ? (pendingFiles.length > 0 
                  ? `Uploading ${pendingFiles.length} image${pendingFiles.length > 1 ? 's' : ''}...` 
                  : (internal_user?.role === 'admin' ? 'Saving...' : 'Submitting...')) 
                : (internal_user?.role === 'admin' 
                  ? `Save Changes${pendingFiles.length > 0 ? ` & Upload ${pendingFiles.length} Image${pendingFiles.length > 1 ? 's' : ''}` : ''}`
                  : `Submit for Approval${pendingFiles.length > 0 ? ` & Upload ${pendingFiles.length} Image${pendingFiles.length > 1 ? 's' : ''}` : ''}`
                )
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}