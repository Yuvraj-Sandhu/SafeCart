import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { RecallWithDisplay, CardSplit, SplitPreview, UploadedImage } from '@/types/display';
import { api } from '@/services/api';
import { getRecallImages } from '@/utils/imageUtils';
import styles from './EditModal.module.css';

interface EditModalProps {
  recall: RecallWithDisplay;
  onClose: () => void;
  onSave: (updatedRecall: RecallWithDisplay) => void;
}

export function EditModal({ recall, onClose, onSave }: EditModalProps) {
  const { currentTheme } = useTheme();
  const [editedRecall, setEditedRecall] = useState<RecallWithDisplay>(recall);
  const [previewTitle, setPreviewTitle] = useState(recall.display?.previewTitle || '');
  const [primaryImageIndex, setPrimaryImageIndex] = useState(recall.display?.primaryImageIndex ?? -1);
  const [cardSplits, setCardSplits] = useState<CardSplit[]>(recall.display?.cardSplits || []);
  const [splitPreviews, setSplitPreviews] = useState<SplitPreview[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>(recall.display?.uploadedImages || []);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string; metadata: UploadedImage }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get combined images (processed + uploaded)
  const allImages = getRecallImages(recall);
  const hasImages = allImages.length > 0;

  // Generate split previews whenever splits change
  useEffect(() => {
    generateSplitPreviews();
  }, [cardSplits, primaryImageIndex]);

  const generateSplitPreviews = () => {
    if (!hasImages || cardSplits.length === 0) {
      setSplitPreviews([]);
      return;
    }

    const previews: SplitPreview[] = [];
    
    // Main card preview (from 0 to first split)
    let mainImages = cardSplits[0] ? allImages.slice(0, cardSplits[0].startIndex) : allImages;
    
    // Apply primary image reordering for main card
    if (primaryImageIndex >= 0 && primaryImageIndex < mainImages.length) {
      const primaryImage = mainImages[primaryImageIndex];
      mainImages = [primaryImage, ...mainImages.filter((_, i) => i !== primaryImageIndex)];
    }
    
    previews.push({
      splitIndex: -1,
      title: previewTitle || recall.field_title,
      images: mainImages,
      startIndex: 0,
      endIndex: cardSplits[0]?.startIndex || allImages.length
    });

    // Split card previews
    cardSplits.forEach((split, index) => {
      let splitImages = allImages.slice(split.startIndex, split.endIndex);
      
      // Apply primary image reordering for this split
      if (split.primaryImageIndex !== undefined && split.primaryImageIndex >= 0 && split.primaryImageIndex < splitImages.length) {
        const primaryImage = splitImages[split.primaryImageIndex];
        splitImages = [primaryImage, ...splitImages.filter((_, i) => i !== split.primaryImageIndex)];
      }
      
      previews.push({
        splitIndex: index,
        title: split.previewTitle || `${recall.field_title} - Part ${index + 2}`,
        images: splitImages,
        startIndex: split.startIndex,
        endIndex: split.endIndex
      });
    });

    setSplitPreviews(previews);
  };

  const handleAddSplit = () => {
    if (!hasImages) return;
    
    const lastSplit = cardSplits[cardSplits.length - 1];
    const startIndex = lastSplit ? lastSplit.endIndex : Math.floor(allImages.length / 2);
    const endIndex = allImages.length;
    
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

  const handleSave = async () => {
    try {
      setIsUploading(true);

      // Prepare display data without uploaded images (they'll be added by the API)
      const displayData = {
        previewTitle: previewTitle || undefined,
        primaryImageIndex: primaryImageIndex >= 0 ? primaryImageIndex : undefined,
        cardSplits: cardSplits.length > 0 ? cardSplits : undefined,
        uploadedImages: uploadedImages.length > 0 ? uploadedImages : undefined, // Existing uploaded images
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: 'current-user' // TODO: Get from auth context
      };

      let finalRecall: RecallWithDisplay;

      if (pendingFiles.length > 0) {
        // Upload new images and update display data
        const files = pendingFiles.map(pf => pf.file);
        const response = await api.uploadImagesAndUpdateDisplay(recall.id, files, displayData);
        
        // Clean up preview URLs
        pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
        setPendingFiles([]);
        
        // Update with response data
        finalRecall = {
          ...editedRecall,
          display: response.data.displayData
        };
      } else {
        // No new images, just update display data
        await api.updateRecallDisplay(recall.id, displayData);
        finalRecall = {
          ...editedRecall,
          display: displayData
        };
      }
      
      onSave(finalRecall);
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    // Clear all display data
    setPreviewTitle('');
    setPrimaryImageIndex(-1);
    setCardSplits([]);
    setUploadedImages([]);
    
    // Clean up pending files and their preview URLs
    pendingFiles.forEach(pf => URL.revokeObjectURL(pf.previewUrl));
    setPendingFiles([]);
    
    // Create recall with empty display
    const updatedRecall: RecallWithDisplay = {
      ...editedRecall,
      display: undefined // Remove display object entirely
    };
    
    // Save the reset state
    onSave(updatedRecall);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
          uploadedBy: 'current-user', // TODO: Replace with actual user ID from auth context
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
          <h2>Edit Recall Display</h2>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            style={{ color: currentTheme.textSecondary }}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Original Title Display */}
          <div className={styles.section}>
            <h3>Original Information</h3>
            <div className={styles.originalInfo}>
              <p><strong>Title:</strong> {recall.field_title}</p>
              <p><strong>Recall Number:</strong> {recall.field_recall_number}</p>
              <p><strong>Images:</strong> {allImages.length}</p>
            </div>
          </div>

          {/* Preview Title */}
          <div className={styles.section}>
            <h3>Preview Title</h3>
            <input
              type="text"
              value={previewTitle}
              onChange={(e) => setPreviewTitle(e.target.value)}
              placeholder="Leave empty to use original title"
              className={styles.input}
              style={{ 
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.cardBorder,
                color: currentTheme.text
              }}
            />
          </div>

          {/* Primary Image Selection for Main Card */}
          {hasImages && (
            <div className={styles.section}>
              <h3>Primary Image for Main Card</h3>
              <p className={styles.sectionDescription}>
                Select which image should appear first in the main card. Only images that will be shown in the main card are available.
              </p>
              <div className={styles.imageGrid}>
                {/* Show only images that will be in the main card */}
                {(cardSplits.length > 0 ? allImages.slice(0, cardSplits[0].startIndex) : allImages).map((img, index) => (
                  <div 
                    key={index}
                    className={`${styles.imageThumb} ${primaryImageIndex === index ? styles.selected : ''}`}
                    onClick={() => setPrimaryImageIndex(index)}
                    style={{ 
                      borderColor: primaryImageIndex === index ? currentTheme.primary : currentTheme.cardBorder
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
                ))}
                
                {/* Already Uploaded Images */}
                {uploadedImages.map((img, index) => (
                  <div 
                    key={`uploaded-${index}`}
                    className={`${styles.imageThumb} ${styles.uploaded}`}
                    style={{ 
                      borderColor: currentTheme.cardBorder,
                      position: 'relative'
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
                ))}
                
                {/* Pending Files (to be uploaded on save) */}
                {pendingFiles.map((pendingFile, index) => (
                  <div 
                    key={`pending-${index}`}
                    className={`${styles.imageThumb} ${styles.uploaded} ${styles.pending}`}
                    style={{ 
                      borderColor: currentTheme.primary,
                      borderStyle: 'dashed',
                      position: 'relative'
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
                ))}
                
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
            </div>
          )}

          {/* Card Splitting */}
          {hasImages && (
            <div className={styles.section}>
              <h3>Card Splitting</h3>
              <p className={styles.sectionDescription}>
                Split this recall into multiple cards based on images
              </p>
              
              <Button 
                variant="secondary" 
                size="small" 
                onClick={handleAddSplit}
                disabled={cardSplits.length >= allImages.length - 1}
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
                        max={index === cardSplits.length - 1 ? allImages.length : cardSplits[index + 1]?.startIndex || allImages.length}
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
                    placeholder={`${recall.field_title} - Part ${index + 2}`}
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
                    <div className={styles.imageGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                      {allImages.slice(split.startIndex, split.endIndex).map((img, imgIndex) => (
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
              Reset All
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUploading}>
              {isUploading 
                ? (pendingFiles.length > 0 
                  ? `Uploading ${pendingFiles.length} image${pendingFiles.length > 1 ? 's' : ''}...` 
                  : 'Saving...') 
                : `Save Changes${pendingFiles.length > 0 ? ` & Upload ${pendingFiles.length} Image${pendingFiles.length > 1 ? 's' : ''}` : ''}`
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}