import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { RecallWithDisplay, CardSplit, SplitPreview } from '@/types/display';
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

  const images = recall.processedImages || [];
  const hasImages = images.length > 0;

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
    let mainImages = cardSplits[0] ? images.slice(0, cardSplits[0].startIndex) : images;
    
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
      endIndex: cardSplits[0]?.startIndex || images.length
    });

    // Split card previews
    cardSplits.forEach((split, index) => {
      let splitImages = images.slice(split.startIndex, split.endIndex);
      
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
    const startIndex = lastSplit ? lastSplit.endIndex : Math.floor(images.length / 2);
    const endIndex = images.length;
    
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

  const handleSave = () => {
    const updatedRecall: RecallWithDisplay = {
      ...editedRecall,
      display: {
        ...editedRecall.display,
        previewTitle: previewTitle || undefined,
        primaryImageIndex: primaryImageIndex >= 0 ? primaryImageIndex : undefined,
        cardSplits: cardSplits.length > 0 ? cardSplits : undefined,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: 'current-user' // TODO: Get from auth context
      }
    };
    
    onSave(updatedRecall);
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
              <p><strong>Images:</strong> {images.length}</p>
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
                {(cardSplits.length > 0 ? images.slice(0, cardSplits[0].startIndex) : images).map((img, index) => (
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
              </div>
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
                disabled={cardSplits.length >= images.length - 1}
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
                        max={index === cardSplits.length - 1 ? images.length : cardSplits[index + 1]?.startIndex || images.length}
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
                    <div className={styles.imageGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
                      {images.slice(split.startIndex, split.endIndex).map((img, imgIndex) => (
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
                    className={styles.removeButton}
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}