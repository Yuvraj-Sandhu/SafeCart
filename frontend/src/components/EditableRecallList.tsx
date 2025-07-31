'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { PendingBadge } from './ui/PendingBadge';
import { UnifiedRecall } from '@/types/recall.types';
import { ImageModal } from './ui/ImageModal';
import { getUnifiedRecallImages } from '@/utils/imageUtils';
import { formatRecallDate } from '@/utils/dateUtils';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import styles from './RecallList.module.css';
import editStyles from './EditableRecallList.module.css';

import { ProcessedImage } from '@/services/api';

interface EditableRecallListProps {
  recalls: UnifiedRecall[];
  loading: boolean;
  error: string | null;
  onEdit: (recall: UnifiedRecall) => void;
  hidePendingBadges?: boolean;
}

export function EditableRecallList({ recalls, loading, error, onEdit, hidePendingBadges = false }: EditableRecallListProps) {
  const { currentTheme } = useTheme();
  const { hasPendingChanges, getPendingChangesForRecall } = usePendingChanges();
  const [selectedImageModal, setSelectedImageModal] = useState<{
    images: ProcessedImage[];
    currentIndex: number;
    recallTitle: string;
  } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate column count based on screen size
  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumnCount(4);
      else if (width >= 1024) setColumnCount(3);
      else if (width >= 640) setColumnCount(2);
      else setColumnCount(1);
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  // Filter recalls by search term
  const filteredRecalls = recalls.filter(recall =>
    recall.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recall.recallingFirm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create masonry columns with horizontal ordering (including split cards)
  const createMasonryColumns = (recalls: UnifiedRecall[]) => {
    // Expand recalls that have display splits
    const expandedRecalls: Array<{ recall: UnifiedRecall, splitIndex: number }> = [];
    
    recalls.forEach(recall => {
      const display = recall.display;
      if (display?.cardSplits && display.cardSplits.length > 0) {
        // Add main card
        expandedRecalls.push({ recall, splitIndex: -1 });
        // Add split cards
        display.cardSplits.forEach((_, index: number) => {
          expandedRecalls.push({ recall, splitIndex: index });
        });
      } else {
        // No splits, just add the single card
        expandedRecalls.push({ recall, splitIndex: -1 });
      }
    });
    
    const columns: Array<Array<{ recall: UnifiedRecall, splitIndex: number }>> = Array(columnCount).fill(null).map(() => []);
    
    // Fill columns horizontally (round-robin) with expanded recalls
    expandedRecalls.forEach((expandedRecall, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(expandedRecall);
    });
    
    return columns;
  };

  const handleViewDetails = (recall: UnifiedRecall, cardId?: string) => {
    // Check if there's a custom URL in display data
    const display = (recall as any).display;
    const previewUrl = display?.previewUrl;
    const effectiveUrl = previewUrl || recall.recallUrl;
    
    if (effectiveUrl) {
      // Open website in new tab
      window.open(effectiveUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Toggle card expansion
      const targetId = cardId || recall.id;
      setExpandedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(targetId)) {
          newSet.delete(targetId);
        } else {
          newSet.add(targetId);
        }
        return newSet;
      });
    }
  };

  const handleImageClick = (images: ProcessedImage[], title: string, imageIndex: number = 0) => {
    const validImages = images.filter(img => 
      img.type !== 'error' && img.storageUrl
    ) || [];
    
    if (validImages.length > 0) {
      setSelectedImageModal({
        images: validImages,
        currentIndex: imageIndex,
        recallTitle: title
      });
    }
  };

  const closeModal = () => {
    setSelectedImageModal(null);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const level = riskLevel.toLowerCase();
    if (level.includes('high') || level.includes('class i')) return currentTheme.danger;
    if (level.includes('medium') || level.includes('class ii')) return currentTheme.warning;
    if (level.includes('low') || level.includes('class iii')) return currentTheme.success;
    return currentTheme.textSecondary;
  };

  const getSourceColor = (source: 'USDA' | 'FDA') => {
    return source === 'USDA' ? currentTheme.primary : currentTheme.primary;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p style={{ color: currentTheme.textSecondary }}>Loading recalls...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={styles.error}
        style={{ 
          backgroundColor: currentTheme.dangerLight,
          color: currentTheme.danger 
        }}
      >
        <p>Error: {error}</p>
      </div>
    );
  }

  if (recalls.length === 0) {
    return (
      <div 
        className={styles.empty}
        style={{ color: currentTheme.textSecondary }}
      >
        <p>No recalls found for the selected criteria.</p>
      </div>
    );
  }

  if (filteredRecalls.length === 0 && searchTerm) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 style={{ color: currentTheme.text }}>
            Found 0 recalls (filtered from {recalls.length})
          </h2>
        </div>
        
        <div className={styles.searchSection}>
          <div className={styles.searchContainer}>
            <svg 
              className={styles.searchIcon}
              xmlns="http://www.w3.org/2000/svg" 
              x="0px" y="0px" 
              width="20" height="20" 
              viewBox="0 0 50 50"
              fill={currentTheme.textSecondary}
            >
              <path d="M 21 3 C 11.601563 3 4 10.601563 4 20 C 4 29.398438 11.601563 37 21 37 C 24.355469 37 27.460938 36.015625 30.09375 34.34375 L 42.375 46.625 L 46.625 42.375 L 34.5 30.28125 C 36.679688 27.421875 38 23.878906 38 20 C 38 10.601563 30.398438 3 21 3 Z M 21 7 C 28.199219 7 34 12.800781 34 20 C 34 27.199219 28.199219 33 21 33 C 13.800781 33 8 27.199219 8 20 C 8 12.800781 13.800781 7 21 7 Z"></path>
            </svg>
            <input
              type="text"
              placeholder="Search recalls by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              style={{
                backgroundColor: currentTheme.cardBackground,
                color: currentTheme.text,
                borderColor: currentTheme.cardBorder,
              }}
            />
          </div>
        </div>
        <div 
          className={styles.empty}
          style={{ color: currentTheme.textSecondary }}
        >
          <p>No recalls found matching "{searchTerm}". Try a different search term.</p>
        </div>
      </div>
    );
  }

  const masonryColumns = createMasonryColumns(filteredRecalls);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 style={{ color: currentTheme.text }}>
          Found {filteredRecalls.length} recall{filteredRecalls.length !== 1 ? 's' : ''}
          {searchTerm && ` (filtered from ${recalls.length})`}
        </h2>
      </div>
      
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <svg 
            className={styles.searchIcon}
            xmlns="http://www.w3.org/2000/svg" 
            x="0px" y="0px" 
            width="20" height="20" 
            viewBox="0 0 50 50"
            fill={currentTheme.textSecondary}
          >
            <path d="M 21 3 C 11.601563 3 4 10.601563 4 20 C 4 29.398438 11.601563 37 21 37 C 24.355469 37 27.460938 36.015625 30.09375 34.34375 L 42.375 46.625 L 46.625 42.375 L 34.5 30.28125 C 36.679688 27.421875 38 23.878906 38 20 C 38 10.601563 30.398438 3 21 3 Z M 21 7 C 28.199219 7 34 12.800781 34 20 C 34 27.199219 28.199219 33 21 33 C 13.800781 33 8 27.199219 8 20 C 8 12.800781 13.800781 7 21 7 Z"></path>
          </svg>
          <input
            type="text"
            placeholder="Search recalls by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
            style={{
              backgroundColor: currentTheme.cardBackground,
              color: currentTheme.text,
              borderColor: currentTheme.cardBorder,
            }}
          />
        </div>
      </div>
      
      <div ref={containerRef} className={styles.masonry}>
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {column.map((expandedRecall, cardIndex) => {
              const { recall, splitIndex } = expandedRecall;
              const cardId = splitIndex === -1 ? recall.id : `${recall.id}-${splitIndex}`;
              
              // Get display data
              const display = recall.display;
              
              // Get card-specific images
              // Get combined images (processed + uploaded)
              const allImages = getUnifiedRecallImages(recall);
              
              let cardImages = allImages;
              if (splitIndex !== -1 && display?.cardSplits?.[splitIndex]) {
                const split = display.cardSplits[splitIndex];
                cardImages = cardImages.slice(split.startIndex, split.endIndex);
              } else if (splitIndex === -1 && display?.cardSplits && display.cardSplits.length > 0) {
                // Main card shows images up to first split
                cardImages = cardImages.slice(0, display.cardSplits[0].startIndex);
              }
              
              // Apply primary image for each card independently
              let primaryIndex = -1;
              if (splitIndex === -1) {
                // Main card: use display.primaryImageIndex (relative to main card's images)
                primaryIndex = display?.primaryImageIndex ?? -1;
              } else if (display?.cardSplits?.[splitIndex]?.primaryImageIndex !== undefined) {
                // Split card: use split's primaryImageIndex (relative to split's images)
                primaryIndex = display.cardSplits[splitIndex].primaryImageIndex!;
              }
              
              // Reorder images if we have a valid primary image within this card's range
              if (primaryIndex >= 0 && primaryIndex < cardImages.length && cardImages.length > 0) {
                const primaryImage = cardImages[primaryIndex];
                cardImages = [primaryImage, ...cardImages.filter((_, i) => i !== primaryIndex)];
              }
              
              const firstImage = cardImages.find(img => 
                img.type !== 'error' && img.storageUrl
              );
              const isExpanded = expandedCards.has(cardId);
              
              // Get display title
              let displayTitle = recall.productTitle;
              if (splitIndex !== -1 && display?.cardSplits?.[splitIndex]?.previewTitle) {
                displayTitle = display.cardSplits[splitIndex].previewTitle;
              } else if (display?.previewTitle) {
                displayTitle = display.previewTitle;
              }
              
              return (
                <div
                  key={cardId}
                  className={styles.recallCard}
                  style={{
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.cardBorder,
                  }}
                >
                  {firstImage ? (
                    <div 
                      className={styles.imageContainer}
                      onClick={() => handleImageClick(cardImages, displayTitle, 0)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img 
                        src={firstImage.storageUrl} 
                        alt={`${displayTitle} label`}
                        className={styles.recallImage}
                        loading="lazy"
                      />
                      {/* Edit button before image count - only show on main card */}
                      {splitIndex === -1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(recall);
                          }}
                          className={editStyles.editButton}
                          style={{ 
                            right: cardImages.length > 1 ? '5rem' : '1rem'
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {cardImages.length > 1 && (
                        <div 
                          className={styles.imageCount}
                          style={{ backgroundColor: currentTheme.primaryHover}}
                        >
                          +{cardImages.length - 1}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className={styles.imagePlaceholder}
                      style={{ backgroundColor: currentTheme.backgroundSecondary }}
                    >
                      <svg 
                        width="60" 
                        height="60" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke={currentTheme.textSecondary}
                        strokeWidth="1.5"
                        style={{ opacity: 0.5 }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      {/* Edit button for cards without images - only show on main card */}
                      {splitIndex === -1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(recall);
                          }}
                          className={editStyles.editButton}
                          style={{
                            right: '1rem'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className={styles.cardContent}>
                    {splitIndex !== -1 && (
                      <div 
                        className={editStyles.splitIndicator}
                        style={{
                          color: currentTheme.primary,
                        }}
                      >
                        Part {splitIndex + 2}
                      </div>
                    )}
                    
                    <div className={styles.recallHeader}>
                      <span 
                        className={styles.sourceTag}
                        style={{ 
                          color: getSourceColor(recall.source),
                          borderColor: getSourceColor(recall.source),
                        }}
                      >
                        {recall.source}
                      </span>
                      <span 
                        className={styles.riskLevel}
                        style={{ 
                          color: getRiskLevelColor(recall.classification),
                          borderColor: getRiskLevelColor(recall.classification),
                        }}
                      >
                        {recall.classification}
                      </span>
                      <span 
                        className={styles.activeStatus}
                        style={{ 
                          color: recall.isActive ? currentTheme.warning : currentTheme.textSecondary,
                          borderColor: recall.isActive ? currentTheme.warning : currentTheme.textSecondary,
                        }}
                      >
                        {recall.isActive ? 'Active' : 'Closed'}
                      </span>
                      
                      {/* Show pending badge only on main card */}
                      {!hidePendingBadges && splitIndex === -1 && hasPendingChanges(recall.id, recall.source) && (
                        <PendingBadge 
                          count={getPendingChangesForRecall(recall.id, recall.source).length}
                        />
                      )}
                    </div>
                    
                    <h3 
                      className={styles.recallTitle}
                      style={{ color: currentTheme.text }}
                    >
                      {displayTitle}
                    </h3>
                    
                    {/* Commented out state names display - uncomment to show states again
                    <div className={styles.recallStates}>
                      <span style={{ color: currentTheme.text }}>
                        {recall.affectedStates.join(', ')}
                      </span>
                    </div>
                    */}
                    
                    <div className={styles.recallMeta}>
                      <span 
                        className={styles.metaItem}
                        style={{ color: currentTheme.textSecondary }}
                      >
                        {recall.recallingFirm}
                      </span>
                      <span 
                        className={styles.metaItem}
                        style={{ color: currentTheme.textSecondary }}
                      >
                        {formatRecallDate(recall.recallDate)}
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <div className={styles.expandedDetails}>
                        {recall.reasonForRecall && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Recall Reason</h4>
                            <p style={{ color: currentTheme.textSecondary }}>
                              {recall.reasonForRecall}
                            </p>
                          </div>
                        )}
                        
                        {recall.terminationDate && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Closed Date</h4>
                            <p style={{ color: currentTheme.textSecondary }}>
                              {formatRecallDate(recall.terminationDate)}
                            </p>
                          </div>
                        )}
                        
                        <div className={styles.detailSection}>
                          <h4 style={{ color: currentTheme.text }}>Product Details</h4>
                          <p style={{ color: currentTheme.textSecondary }}>
                            {recall.productDescription}
                          </p>
                        </div>
                        
                        {recall.source === 'USDA' && (recall.originalData?.field_summary || recall.productDescription) && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Summary</h4>
                            <div 
                              style={{ color: currentTheme.textSecondary }}
                              dangerouslySetInnerHTML={{ 
                                __html: ((recall.originalData?.field_summary || recall.productDescription) || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') 
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={styles.recallActions}>
                      <Button 
                        size="small" 
                        variant="secondary"
                        onClick={() => handleViewDetails(recall, cardId)}
                      >
                        {(display?.previewUrl || recall.recallUrl) ? `Visit ${recall.source} Page` : (isExpanded ? 'Show Less' : 'View Details')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={selectedImageModal !== null}
        images={selectedImageModal?.images || []}
        currentIndex={selectedImageModal?.currentIndex || 0}
        onClose={closeModal}
        recallTitle={selectedImageModal?.recallTitle || ''}
      />
    </div>
  );
}