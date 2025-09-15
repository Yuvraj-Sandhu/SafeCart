'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { ProcessedImage } from '@/services/api';
import { UnifiedRecall } from '@/types/recall.types';
import { ImageModal } from './ui/ImageModal';
import { getUnifiedRecallImages } from '@/utils/imageUtils';
import { formatRecallDate } from '@/utils/dateUtils';
import { getRelativeTime } from '@/utils/relativeTime';
import styles from './RecallList.module.css';

interface RecallListProps {
  recalls: UnifiedRecall[];
  loading: boolean;
  error: string | null;
  hideSearch?: boolean;
  hideScrollTop?: boolean;
  hideEndIndicator?: boolean;
  hideBottomSpacer?: boolean;
}

export function RecallList({ 
  recalls, 
  loading, 
  error, 
  hideSearch = false,
  hideScrollTop = false,
  hideEndIndicator = false,
  hideBottomSpacer = false
}: RecallListProps) {
  const { currentTheme } = useTheme();
  const [selectedImageModal, setSelectedImageModal] = useState<{
    images: ProcessedImage[];
    currentIndex: number;
    recallTitle: string;
  } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedRecalls, setDisplayedRecalls] = useState<UnifiedRecall[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchNumbers, setBatchNumbers] = useState<Map<string, number>>(new Map());
  const currentBatchRef = useRef(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollDirection = useRef<'up' | 'down' | null>(null);

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

  // Calculate items per batch based on column count
  const getItemsPerBatch = useCallback(() => {
    switch (columnCount) {
      case 4: return 40;
      case 3: return 30;
      case 2: return 20;
      default: return 10;
    }
  }, [columnCount]);

  // Filter recalls by search term (only if search is not hidden)
  const filteredRecalls = hideSearch ? recalls : recalls.filter(recall =>
    recall.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recall.recallingFirm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize displayed recalls
  useEffect(() => {
    const itemsPerBatch = getItemsPerBatch();
    const initialRecalls = filteredRecalls.slice(0, itemsPerBatch);
    setDisplayedRecalls(initialRecalls);
    
    // Reset batch numbers and assign batch 0 to initial recalls
    currentBatchRef.current = 0;
    const newBatchNumbers = new Map<string, number>();
    initialRecalls.forEach(recall => {
      newBatchNumbers.set(recall.id, 0);
    });
    setBatchNumbers(newBatchNumbers);
  }, [filteredRecalls.length, columnCount, getItemsPerBatch]);

  // Load more recalls when scrolling near bottom
  const handleScroll = useCallback(() => {
    if (loadingMore || displayedRecalls.length >= filteredRecalls.length) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Trigger when user scrolls past the content into the blank space
    if (scrollY + windowHeight >= documentHeight - (windowHeight / 3) && displayedRecalls.length < filteredRecalls.length) {
      setLoadingMore(true);
      
      // Simulate loading delay for smooth UX
      setTimeout(() => {
        const currentLength = displayedRecalls.length;
        const itemsPerBatch = getItemsPerBatch();
        const nextRecalls = filteredRecalls.slice(currentLength, currentLength + itemsPerBatch);
        
        // Increment batch number for new recalls
        currentBatchRef.current += 1;
        const currentBatch = currentBatchRef.current;
        
        // Update batch numbers for new recalls
        setBatchNumbers(prev => {
          const newMap = new Map(prev);
          nextRecalls.forEach(recall => {
            newMap.set(recall.id, currentBatch);
          });
          return newMap;
        });
        
        setDisplayedRecalls(prev => [...prev, ...nextRecalls]);
        setLoadingMore(false);
      }, 500);
    }
  }, [displayedRecalls.length, filteredRecalls.length, loadingMore, getItemsPerBatch]);

  // Add scroll event listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Handle scroll direction detection
  useEffect(() => {
    const handleScrollDirection = () => {
      const currentScrollY = window.scrollY;
      
      // Only show button if we've scrolled down at least 200px
      if (currentScrollY > 200) {
        if (currentScrollY > lastScrollY.current) {
          // Scrolling down
          setShowScrollTop(true);
          lastScrollDirection.current = 'down';
        } else if (currentScrollY < lastScrollY.current) {
          // Scrolling up
          setShowScrollTop(false);
          lastScrollDirection.current = 'up';
        }
      } else {
        // At the top
        setShowScrollTop(false);
        lastScrollDirection.current = null;
      }
      
      lastScrollY.current = currentScrollY;
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set timeout to show button when user stops scrolling
      // Only show if last direction was down
      scrollTimeoutRef.current = setTimeout(() => {
        if (currentScrollY > 200 && lastScrollDirection.current === 'down') {
          setShowScrollTop(true);
        }
      }, 150);
    };
    
    window.addEventListener('scroll', handleScrollDirection);
    
    return () => {
      window.removeEventListener('scroll', handleScrollDirection);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Create masonry columns with horizontal ordering (including split cards)
  const createMasonryColumns = (recalls: UnifiedRecall[]) => {
    // Expand recalls that have display splits
    const expandedRecalls: Array<{ recall: UnifiedRecall, splitIndex: number, uniqueKey: string }> = [];
    
    recalls.forEach((recall, recallIndex) => {
      const display = (recall as any).display;
      if (display?.cardSplits && display.cardSplits.length > 0) {
        // Add main card
        expandedRecalls.push({ 
          recall, 
          splitIndex: -1, 
          uniqueKey: `${recall.id}-main-${recallIndex}` 
        });
        // Add split cards
        display.cardSplits.forEach((_: any, index: number) => {
          expandedRecalls.push({ 
            recall, 
            splitIndex: index,
            uniqueKey: `${recall.id}-split-${index}-${recallIndex}`
          });
        });
      } else {
        // No splits, just add the single card
        expandedRecalls.push({ 
          recall, 
          splitIndex: -1,
          uniqueKey: `${recall.id}-single-${recallIndex}`
        });
      }
    });
    
    const columns: Array<Array<{ recall: UnifiedRecall, splitIndex: number, uniqueKey: string }>> = Array(columnCount).fill(null).map(() => []);
    
    // Fill columns horizontally (round-robin) with expanded recalls
    expandedRecalls.forEach((expandedRecall, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(expandedRecall);
    });
    
    return columns;
  };

  const handleViewDetails = (recall: UnifiedRecall, cardId?: string) => {
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


  const handleImageClick = (images: any[], title: string, imageIndex: number = 0) => {
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
        {!hideSearch && (
          <>
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
          </>
        )}
        <div 
          className={styles.empty}
          style={{ color: currentTheme.textSecondary }}
        >
          <p>No recalls found matching "{searchTerm}". Try a different search term.</p>
        </div>
      </div>
    );
  }

  // Use displayedRecalls instead of filteredRecalls for masonry
  const masonryColumns = createMasonryColumns(displayedRecalls);

  return (
    <div className={styles.container}>
      {/* Scroll to top button */}
      {!hideScrollTop && (
        <button
          className={`${styles.scrollToTop} ${showScrollTop ? styles.scrollToTopVisible : ''}`}
          onClick={scrollToTop}
          aria-label="Scroll to top"
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
          }}
        >
          <svg 
            viewBox="0 0 46 40" 
            style={{
              width: '40px',
              height: '35px',
              fill: currentTheme.primary,
              transform: 'rotate(-90deg)',
              scale: '0.5',
            }}
          >
            <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
          </svg>
        </button>
      )}
      {!hideSearch && (
        <>
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
        </>
      )}
      
      <div 
        ref={containerRef} 
        className={styles.masonry}
        style={{ '--masonry-columns': columnCount } as React.CSSProperties}
      >
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {column.map((expandedRecall, cardIndex) => {
              const { recall, splitIndex, uniqueKey } = expandedRecall;
              const cardId = splitIndex === -1 ? recall.id : `${recall.id}-${splitIndex}`;
              
              // Get display data
              const display = (recall as any).display;
              
              // Get batch number for this recall
              const batchNumber = batchNumbers.get(recall.id) ?? 0;
              
              // Calculate item index within the batch for staggered animation
              const recallsInBatch = displayedRecalls.filter(r => batchNumbers.get(r.id) === batchNumber);
              const itemIndexInBatch = recallsInBatch.findIndex(r => r.id === recall.id);
              
              // Get combined images (processed + uploaded)
              const allImages = getUnifiedRecallImages(recall);
              
              // Get card-specific images
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
                  key={uniqueKey}
                  className={`${styles.recallCard} ${styles.batchAnimation} ${styles[`batch${batchNumber % 10}`]}`}
                  style={{
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.cardBorder,
                    '--item-index': itemIndexInBatch,
                  } as React.CSSProperties}
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
                </div>
              )}
              
              <div className={styles.cardContent}>
                
                {/* <div className={styles.recallHeader}> */}

                  {/* Tags can be used if required */}

                  {/* <span 
                    className={styles.sourceTag}
                    style={{ 
                      color: getSourceColor(recall.source),
                      borderColor: getSourceColor(recall.source),
                    }}
                  >
                    {recall.source}
                  </span> */}

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
                {/* </div> */}
                
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
                  <Button 
                    size="small" 
                    variant="secondary"
                    onClick={() => handleViewDetails(recall, cardId)}
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

      {/* Loading more indicator */}
      {loadingMore && displayedRecalls.length < filteredRecalls.length && (
        <div className={styles.loadingMore}>
          <div className={styles.spinner} />
          <p style={{ color: currentTheme.textSecondary, marginTop: '0.5rem' }}>Loading more recalls...</p>
        </div>
      )}

      {/* End of list indicator */}
      {!hideEndIndicator && !loadingMore && displayedRecalls.length > 0 && displayedRecalls.length >= filteredRecalls.length && (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          color: currentTheme.textSecondary,
          fontSize: '0.875rem'
        }}>
          Showing all {filteredRecalls.length} recall{filteredRecalls.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Spacer to allow scrolling past the bottom */}
      {!hideBottomSpacer && <div style={{ height: 'calc(100vh / 2)' }} />}

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