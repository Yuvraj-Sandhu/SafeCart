'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { PendingBadge } from './ui/PendingBadge';
import { ApprovedBadge } from './ui/ApprovedBadge';
import { UnifiedRecall } from '@/types/recall.types';
import { ImageModal } from './ui/ImageModal';
import { getUnifiedRecallImages } from '@/utils/imageUtils';
import { formatRecallDate } from '@/utils/dateUtils';
import { getRelativeTime } from '@/utils/relativeTime';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import styles from './RecallList.module.css';
import editStyles from './EditableRecallList.module.css';

import { ProcessedImage } from '@/services/api';

interface EditableRecallListProps {
  recalls: UnifiedRecall[];
  loading: boolean;
  error: string | null;
  onEdit: (recall: UnifiedRecall) => void;
  onReview?: (recall: UnifiedRecall) => void; // New prop for approve/reject action
  hidePendingBadges?: boolean;
  hideSearch?: boolean;
  // Selection props (optional)
  enableSelection?: boolean;
  selectedRecalls?: Set<string>;
  onRecallSelect?: (recallId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  imageStats?: { total: number; withImages: number };
}

export function EditableRecallList({ 
  recalls, 
  loading, 
  error, 
  onEdit, 
  onReview, 
  hidePendingBadges = false,
  hideSearch = false,
  enableSelection = false,
  selectedRecalls = new Set(),
  onRecallSelect,
  onSelectAll,
  onDeselectAll,
  imageStats
}: EditableRecallListProps) {
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

  // Filter recalls by search term (only if search is not hidden)
  const filteredRecalls = hideSearch ? recalls : recalls.filter(recall =>
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

  const handleVisitPage = (recall: UnifiedRecall) => {
    // Check if there's a custom URL in display data
    const display = (recall as any).display;
    const previewUrl = display?.previewUrl;
    const effectiveUrl = previewUrl || recall.recallUrl;
    
    if (effectiveUrl) {
      // Open website in new tab
      window.open(effectiveUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleDetails = (recall: UnifiedRecall, cardId?: string) => {
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

  if (filteredRecalls.length === 0 && searchTerm && !hideSearch) {
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

  // Selection handlers
  const handleRecallClick = (recallId: string) => {
    if (enableSelection && onRecallSelect) {
      onRecallSelect(recallId);
    }
  };

  const handleSelectAllToggle = () => {
    if (!enableSelection) return;
    
    const allSelected = selectedRecalls.size === filteredRecalls.length && filteredRecalls.length > 0;
    if (allSelected && onDeselectAll) {
      onDeselectAll();
    } else if (onSelectAll) {
      onSelectAll();
    }
  };

  return (
    <div className={styles.container}>
      {!hideSearch && (
        <div className={styles.header}>
          <h2 style={{ color: currentTheme.text }}>
            Found {filteredRecalls.length} recall{filteredRecalls.length !== 1 ? 's' : ''}
            {searchTerm && ` (filtered from ${recalls.length})`}
          </h2>
        </div>
      )}

      {/* Select All Section with Image Stats - only show when enableSelection is true */}
      {enableSelection && filteredRecalls.length > 0 && (
        <div 
          className={editStyles.selectAllSection}
          style={{
            backgroundColor: currentTheme.background,
            border: `1px solid ${currentTheme.cardBorder}`
          }}
        >
          <div className={editStyles.selectAllContainer}>
            <button
              onClick={handleSelectAllToggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                color: currentTheme.primary,
                fontWeight: '600',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${currentTheme.primary}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {selectedRecalls.size === filteredRecalls.length && filteredRecalls.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            
            {/* Image Statistics Badge */}
            {imageStats && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: `${currentTheme.info}15`,
                  borderRadius: '1rem',
                  border: `1px solid ${currentTheme.info}30`,
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: currentTheme.info
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {imageStats.withImages}/{imageStats.total} with images
              </div>
            )}
          </div>

          <div className={editStyles.selectedContainer}>
            <div
              style={{
                padding: '0.375rem 0.875rem',
                backgroundColor: selectedRecalls.size > 0 ? `${currentTheme.success}15` : `${currentTheme.textSecondary}15`,
                borderRadius: '1rem',
                border: `1px solid ${selectedRecalls.size > 0 ? currentTheme.success + '30' : currentTheme.textSecondary + '30'}`,
                fontWeight: '600',
                color: selectedRecalls.size > 0 ? currentTheme.success : currentTheme.textSecondary,
                transition: 'all 0.2s ease'
              }}
            >
              {selectedRecalls.size} selected
            </div>
            <div style={{ 
              color: currentTheme.textSecondary,
              fontWeight: '500'
            }}>
              of {filteredRecalls.length} total
            </div>
          </div>
        </div>
      )}
      
      {!hideSearch && (
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
      )}
      
      <div 
        ref={containerRef} 
        className={styles.masonry}
        style={{ '--masonry-columns': columnCount } as React.CSSProperties}
      >
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
              const isSelected = enableSelection && selectedRecalls.has(recall.id);
              
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
                    borderColor: isSelected ? currentTheme.primary : currentTheme.cardBorder,
                    borderWidth: isSelected ? '2px' : '1px',
                  }}
                >

                  {firstImage ? (
                    <div 
                      className={styles.imageContainer}
                      onClick={() => handleImageClick(cardImages, displayTitle, 0)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <img 
                        src={firstImage.storageUrl} 
                        alt={`${displayTitle} label`}
                        className={styles.recallImage}
                        loading="lazy"
                      />
                      {/* Relative time badge */}
                      {recall.recallInitiationDate && (
                        <div 
                          className={styles.timeBadge}
                          style={{ 
                            backgroundColor: currentTheme.cardBackground,
                            color: currentTheme.textSecondary,
                            borderColor: currentTheme.cardBorder
                          }}
                        >
                          {getRelativeTime(recall.recallInitiationDate)}
                        </div>
                      )}
                      {/* Review button before image count - only show on main card */}
                      {splitIndex === -1 && onReview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReview(recall);
                          }}
                          className={editStyles.editButton}
                          style={{ 
                            right: cardImages.length > 1 ? '8.5rem' : '4.5rem',
                            backgroundColor: currentTheme.warning,
                            color: 'white'
                          }}
                        >
                          Review
                        </button>
                      )}
                      
                      {/* Edit button before image count - only show on main card */}
                      {splitIndex === -1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(recall);
                          }}
                          className={editStyles.editButton}
                          style={{ 
                            right: cardImages.length > 1 ? '4.5rem' : '0.5rem'
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
                      style={{ backgroundColor: currentTheme.backgroundSecondary, position: 'relative' }}
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
                      {/* Relative time badge for recalls without images */}
                      {recall.recallInitiationDate && (
                        <div 
                          className={styles.timeBadge}
                          style={{ 
                            backgroundColor: currentTheme.cardBackground,
                            color: currentTheme.textSecondary,
                            borderColor: currentTheme.cardBorder
                          }}
                        >
                          {getRelativeTime(recall.recallInitiationDate)}
                        </div>
                      )}
                      {/* Review button for cards without images - only show on main card */}
                      {splitIndex === -1 && onReview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReview(recall);
                          }}
                          className={editStyles.editButton}
                          style={{
                            right: '4.5rem',
                            backgroundColor: currentTheme.warning,
                            color: 'white'
                          }}
                        >
                          Review
                        </button>
                      )}
                      
                      {/* Edit button for cards without images - only show on main card */}
                      {splitIndex === -1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(recall);
                          }}
                          className={editStyles.editButton}
                          style={{
                            right: '0.5rem'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div 
                    className={styles.cardContent}
                    onClick={enableSelection ? () => handleRecallClick(recall.id) : undefined}
                    style={{ cursor: enableSelection ? 'pointer' : 'default' }}
                  >
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

                      {/* <span 
                        className={styles.riskLevel}
                        style={{ 
                          color: getRiskLevelColor(recall.classification),
                          borderColor: getRiskLevelColor(recall.classification),
                        }}
                      >
                        {recall.classification}
                      </span> */}

                      {/* <span 
                        className={styles.activeStatus}
                        style={{ 
                          color: recall.isActive ? currentTheme.warning : currentTheme.textSecondary,
                          borderColor: recall.isActive ? currentTheme.warning : currentTheme.textSecondary,
                        }}
                      >
                        {recall.isActive ? 'Active' : 'Closed'}
                      </span> */}
                      
                      {/* Show pending badge only on main card */}
                      {!hidePendingBadges && splitIndex === -1 && hasPendingChanges(recall.id, recall.source) && (
                        <PendingBadge 
                          count={getPendingChangesForRecall(recall.id, recall.source).length}
                        />
                      )}
                      
                      {/* Show approved badge only on main card when no pending changes */}
                      {!hidePendingBadges && splitIndex === -1 && !hasPendingChanges(recall.id, recall.source) && (
                        // Case 1: Member-proposed changes that were approved
                        (recall.display?.approvedAt && recall.display?.approvedBy && recall.display?.proposedBy) ? (
                          <ApprovedBadge 
                            approvedBy={recall.display.approvedBy}
                            proposedBy={recall.display.proposedBy}
                            approvedAt={recall.display.approvedAt}
                          />
                        ) : (
                          // Case 2: Direct admin edits (no approval workflow)
                          recall.display?.lastEditedBy && recall.display?.lastEditedAt && (
                            <ApprovedBadge 
                              approvedBy={recall.display.lastEditedBy}
                              approvedAt={recall.display.lastEditedAt}
                            />
                          )
                        )
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
                      {/* <span 
                        className={styles.metaItem}
                        style={{ color: currentTheme.textSecondary }}
                      >
                        {recall.recallingFirm}
                      </span> */}
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

                        {recall.recallingFirm && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Recalling Firm</h4>
                            <p style={{ color: currentTheme.textSecondary }}>
                              {recall.recallingFirm}
                            </p>
                          </div>
                        )}
                        
                        {/* {recall.terminationDate && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Closed Date</h4>
                            <p style={{ color: currentTheme.textSecondary }}>
                              {formatRecallDate(recall.terminationDate)}
                            </p>
                          </div>
                        )} */}
                        
                        <div className={styles.detailSection}>
                          <h4 style={{ color: currentTheme.text }}>Product Details</h4>
                          <p style={{ color: currentTheme.textSecondary }}>
                            {recall.productDescription}
                          </p>
                        </div>
                        
                        {/* Link to USDA/FDA page and Share button */}
                        {(display?.previewUrl || recall.recallUrl) && (
                          <div className={styles.detailSection}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%'
                            }}>
                              <a
                                href={display?.previewUrl || recall.recallUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: currentTheme.text,
                                  textDecoration: 'underline',
                                  fontSize: '0.9rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Visit {recall.source} Page
                                <svg 
                                  width="14" 
                                  height="14" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  xmlns="http://www.w3.org/2000/svg"
                                  style={{ flexShrink: 0 }}
                                >
                                  <path 
                                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </a>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/recalls/${recall.id}`, '_blank');
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: currentTheme.textSecondary,
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.875rem',
                                  lineHeight: '1.4'
                                }}
                                title="Share this recall"
                              >
                                <svg 
                                  width="16" 
                                  height="16" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path 
                                    d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L7.08259 9.34057C6.54303 8.52269 5.58896 8 4.5 8C2.84315 8 1.5 9.34315 1.5 11C1.5 12.6569 2.84315 14 4.5 14C5.58896 14 6.54303 13.4773 7.08259 12.6594L15.0227 16.6294C15.0077 16.7508 15 16.8745 15 17C15 18.6569 16.3431 20 18 20C19.6569 20 21 18.6569 21 17C21 15.3431 19.6569 14 18 14C16.9111 14 15.957 14.5226 15.4174 15.3406L7.47733 11.3706C7.49229 11.2492 7.5 11.1255 7.5 11C7.5 10.8745 7.49229 10.7508 7.47733 10.6294L15.4174 6.65943C15.957 7.47731 16.9111 8 18 8Z" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Share
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* {recall.source === 'USDA' && (recall.originalData?.field_summary || recall.productDescription) && (
                          <div className={styles.detailSection}>
                            <h4 style={{ color: currentTheme.text }}>Summary</h4>
                            <div 
                              style={{ color: currentTheme.textSecondary }}
                              dangerouslySetInnerHTML={{ 
                                __html: ((recall.originalData?.field_summary || recall.productDescription) || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') 
                              }}
                            />
                          </div>
                        )} */}
                      </div>
                    )}
                    
                    <div className={styles.recallActions}>
                      {/* View Details / Show Less Button - always show */}
                      <Button 
                        size="small" 
                        variant="secondary"
                        onClick={() => handleToggleDetails(recall, cardId)}
                      >
                        {isExpanded ? 'Show Less' : 'View Details'}
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