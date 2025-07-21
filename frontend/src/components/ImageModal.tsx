'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ProcessedImage } from '@/services/api';
import styles from './ImageModal.module.css';

interface ImageModalProps {
  isOpen: boolean;
  images: ProcessedImage[];
  currentIndex: number;
  onClose: () => void;
  recallTitle: string;
}

export function ImageModal({ isOpen, images, currentIndex, onClose, recallTitle }: ImageModalProps) {
  const { currentTheme } = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentImageIndex]);

  // Reset all state when modal closes or opens with new data
  useEffect(() => {
    if (!isOpen) {
      // Reset everything when modal closes
      setCurrentImageIndex(0);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    } else {
      // When modal opens, set to the passed currentIndex and reset zoom/position
      setCurrentImageIndex(currentIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, currentIndex]);

  // Close on escape key and prevent background scrolling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent background scrolling
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !images.length) return null;

  const validImages = images.filter(img => img.type !== 'error' && img.storageUrl);
  const currentImage = validImages[currentImageIndex];

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault(); // Prevent text selection
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      // Reduce drag speed by applying a multiplier (0.7 = 70% of original speed)
      const dragSensitivity = 0.5;
      const deltaX = (e.clientX - dragStart.x) * dragSensitivity;
      const deltaY = (e.clientY - dragStart.y) * dragSensitivity;
      
      setPosition({
        x: deltaX,
        y: deltaY
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  const goToPrevious = () => {
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : validImages.length - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex(prev => 
      prev < validImages.length - 1 ? prev + 1 : 0
    );
  };

  return (
    <div 
      className={styles.overlay}
      style={{ backgroundColor: `${currentTheme.text}CC` }}
      onClick={onClose}
    >
      <div 
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className={styles.header}
          style={{ backgroundColor: currentTheme.cardBackground }}
        >
          <div>
            <h3 style={{ color: currentTheme.text }}>{recallTitle}</h3>
            <p style={{ color: currentTheme.textSecondary }}>
              Image {currentImageIndex + 1} of {validImages.length}
            </p>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            style={{ color: currentTheme.textSecondary }}
          >
            ×
          </button>
        </div>

        {/* Image Container */}
        <div 
          ref={containerRef}
          className={styles.imageContainer}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ 
            cursor: isDragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'zoom-in')
          }}
        >
          <img
            ref={imageRef}
            src={currentImage?.storageUrl}
            alt={`${recallTitle} - Image ${currentImageIndex + 1}`}
            className={styles.image}
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (zoom === 1) {
                handleZoomIn();
              }
            }}
          />
        </div>

        {/* Controls */}
        <div 
          className={styles.controls}
          style={{ backgroundColor: currentTheme.cardBackground }}
        >
          {/* Navigation */}
          {validImages.length > 1 && (
            <div className={styles.navigation}>
              <button
                onClick={goToPrevious}
                className={styles.navButton}
                style={{ 
                  backgroundColor: currentTheme.primary,
                  color: 'white'
                }}
              >
                ← Previous
              </button>
              <button
                onClick={goToNext}
                className={styles.navButton}
                style={{ 
                  backgroundColor: currentTheme.primary,
                  color: 'white'
                }}
              >
                Next →
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className={styles.zoomControls}>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className={styles.zoomButton}
              style={{ 
                backgroundColor: currentTheme.backgroundSecondary,
                color: currentTheme.text
              }}
            >
              -
            </button>
            <span 
              className={styles.zoomLevel}
              style={{ color: currentTheme.text }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 5}
              className={styles.zoomButton}
              style={{ 
                backgroundColor: currentTheme.backgroundSecondary,
                color: currentTheme.text
              }}
            >
              +
            </button>
            <button
              onClick={handleResetZoom}
              className={styles.resetButton}
              style={{ 
                backgroundColor: currentTheme.backgroundSecondary,
                color: currentTheme.text
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Image Thumbnails */}
        {validImages.length > 1 && (
          <div 
            className={styles.thumbnails}
            style={{ backgroundColor: currentTheme.cardBackground }}
          >
            {validImages.map((image, index) => (
              <div
                key={index}
                className={`${styles.thumbnail} ${index === currentImageIndex ? styles.activeThumbnail : ''}`}
                style={{ 
                  borderColor: index === currentImageIndex ? currentTheme.primary : 'transparent'
                }}
                onClick={() => setCurrentImageIndex(index)}
              >
                <img 
                  src={image.storageUrl} 
                  alt={`Thumbnail ${index + 1}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}