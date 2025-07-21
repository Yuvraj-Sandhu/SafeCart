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
      // When modal opens, ensure we start from a valid index
      const validIndex = Math.max(0, Math.min(currentIndex, images.filter(img => img.type !== 'error' && img.storageUrl).length - 1));
      setCurrentImageIndex(validIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, currentIndex, images]);

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

    // Prevent background touch scrolling on mobile - but only outside modal
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as Element;
      const modal = document.querySelector('[data-modal="true"]');
      const thumbnails = document.querySelector('[data-thumbnails="true"]');
      
      // Allow scrolling within thumbnails
      if (thumbnails && thumbnails.contains(target)) {
        return;
      }
      
      // Only prevent if the touch is outside the modal
      if (modal && !modal.contains(target)) {
        e.preventDefault();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchmove', handleTouchMove);
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
      const dragSensitivity = 0.7;
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

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const dragSensitivity = 0.5;
      const deltaX = (touch.clientX - dragStart.x) * dragSensitivity;
      const deltaY = (touch.clientY - dragStart.y) * dragSensitivity;
      
      setPosition({
        x: deltaX,
        y: deltaY
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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
      style={{ backgroundColor: currentTheme.shadow }}
      onClick={onClose}
    >
      <div 
        className={styles.modal}
        data-modal="true"
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            cursor: isDragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'zoom-in'),
            touchAction: zoom > 1 ? 'none' : 'auto'
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                  <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button
                onClick={goToNext}
                className={styles.navButton}
                style={{ 
                  backgroundColor: currentTheme.primary,
                  color: 'white'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
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
            data-thumbnails="true"
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