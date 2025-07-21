'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { Recall, downloadAsJson, ProcessedImage } from '@/services/api';
import { ImageModal } from './ImageModal';
import styles from './RecallList.module.css';

interface RecallListProps {
  recalls: Recall[];
  loading: boolean;
  error: string | null;
}

export function RecallList({ recalls, loading, error }: RecallListProps) {
  const { currentTheme } = useTheme();
  const [selectedImageModal, setSelectedImageModal] = useState<{
    images: ProcessedImage[];
    currentIndex: number;
    recallTitle: string;
  } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

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

  // Create masonry columns with horizontal ordering
  const createMasonryColumns = (recalls: Recall[]) => {
    const columns: Recall[][] = Array(columnCount).fill(null).map(() => []);
    
    // Fill columns horizontally (round-robin)
    recalls.forEach((recall, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(recall);
    });
    
    return columns;
  };

  const handleViewDetails = (recall: Recall) => {
    if (recall.field_recall_url) {
      // Open USDA website in new tab
      window.open(recall.field_recall_url, '_blank', 'noopener,noreferrer');
    } else {
      // Toggle card expansion
      setExpandedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(recall.id)) {
          newSet.delete(recall.id);
        } else {
          newSet.add(recall.id);
        }
        return newSet;
      });
    }
  };

  const handleDownloadRecall = (recall: Recall) => {
    downloadAsJson(recall, `recall-${recall.field_recall_number}.json`);
  };

  const handleDownloadAll = () => {
    downloadAsJson(recalls, `recalls-${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleImageClick = (recall: Recall, imageIndex: number = 0) => {
    const validImages = recall.processedImages?.filter(img => 
      img.type !== 'error' && img.storageUrl
    ) || [];
    
    if (validImages.length > 0) {
      setSelectedImageModal({
        images: validImages,
        currentIndex: imageIndex,
        recallTitle: recall.field_title
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

  const masonryColumns = createMasonryColumns(recalls);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 style={{ color: currentTheme.text }}>
          Found {recalls.length} recall{recalls.length !== 1 ? 's' : ''}
        </h2>
        <Button size="small" onClick={handleDownloadAll}>
          Download All as JSON
        </Button>
      </div>
      
      <div ref={containerRef} className={styles.masonry}>
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {column.map((recall) => {
              const firstImage = recall.processedImages?.find(img => 
                img.type !== 'error' && img.storageUrl
              );
              const isExpanded = expandedCards.has(recall.id);
              
              return (
                <div
                  key={recall.id}
                  className={styles.recallCard}
                  style={{
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.cardBorder,
                  }}
                >
              {firstImage ? (
                <div 
                  className={styles.imageContainer}
                  onClick={() => handleImageClick(recall, 0)}
                  style={{ cursor: 'pointer' }}
                >
                  <img 
                    src={firstImage.storageUrl} 
                    alt={`${recall.field_title} label`}
                    className={styles.recallImage}
                    loading="lazy"
                  />
                  {recall.processedImages && recall.processedImages.length > 1 && (
                    <div 
                      className={styles.imageCount}
                      style={{ backgroundColor: currentTheme.primaryHover}}
                    >
                      +{recall.processedImages.length - 1}
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
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}
              
              <div className={styles.cardContent}>
                <div className={styles.recallHeader}>
                  <span 
                    className={styles.riskLevel}
                    style={{ 
                      color: getRiskLevelColor(recall.field_risk_level),
                      borderColor: getRiskLevelColor(recall.field_risk_level),
                    }}
                  >
                    {recall.field_risk_level}
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
                </div>
                
                <h3 
                  className={styles.recallTitle}
                  style={{ color: currentTheme.text }}
                >
                  {recall.field_title}
                </h3>
                
                <div className={styles.recallMeta}>
                  <span 
                    className={styles.metaItem}
                    style={{ color: currentTheme.textSecondary }}
                  >
                    {recall.field_establishment}
                  </span>
                  <span 
                    className={styles.metaItem}
                    style={{ color: currentTheme.textSecondary }}
                  >
                    {new Date(recall.field_recall_date).toLocaleDateString()}
                  </span>
                </div>
                
                <div className={styles.recallStates}>
                  <span style={{ color: currentTheme.text }}>
                    {recall.field_states.length > 50 
                      ? recall.field_states.substring(0, 50) + '...' 
                      : recall.field_states}
                  </span>
                </div>
                
                {isExpanded && (
                  <div className={styles.expandedDetails}>
                    {recall.field_recall_reason && (
                      <div className={styles.detailSection}>
                        <h4 style={{ color: currentTheme.text }}>Recall Reason</h4>
                        <p style={{ color: currentTheme.textSecondary }}>
                          {recall.field_recall_reason}
                        </p>
                      </div>
                    )}
                    
                    {recall.field_closed_date && (
                      <div className={styles.detailSection}>
                        <h4 style={{ color: currentTheme.text }}>Closed Date</h4>
                        <p style={{ color: currentTheme.textSecondary }}>
                          {new Date(recall.field_closed_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    
                    <div className={styles.detailSection}>
                      <h4 style={{ color: currentTheme.text }}>Product Details</h4>
                      <p style={{ color: currentTheme.textSecondary }}>
                        {recall.field_product_items}
                      </p>
                    </div>
                    
                    <div className={styles.detailSection}>
                      <h4 style={{ color: currentTheme.text }}>Summary</h4>
                      <div 
                        style={{ color: currentTheme.textSecondary }}
                        dangerouslySetInnerHTML={{ 
                          __html: recall.field_summary.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ') 
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div className={styles.recallActions}>
                  <Button 
                    size="small" 
                    variant="secondary"
                    onClick={() => handleViewDetails(recall)}
                  >
                    {recall.field_recall_url ? 'Visit USDA Page' : (isExpanded ? 'Show Less' : 'View Details')}
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