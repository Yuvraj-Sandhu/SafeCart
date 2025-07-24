import { ProcessedImage } from '@/services/api';
import { UploadedImage, RecallWithDisplay } from '@/types/display';

/**
 * Combines processed images and uploaded images into a single array
 * Processed images come first, followed by uploaded images
 * Uploaded images are converted to ProcessedImage format for compatibility
 */
export function combineImages(
  processedImages: ProcessedImage[] = [],
  uploadedImages: UploadedImage[] = []
): ProcessedImage[] {
  // Convert uploaded images to ProcessedImage format
  const convertedUploadedImages: ProcessedImage[] = uploadedImages.map(uploaded => ({
    originalFilename: uploaded.originalName,
    type: 'image' as const, // Treat uploaded images as regular images
    sourceUrl: uploaded.filename, // Use filename as source reference
    storageUrl: uploaded.storageUrl,
    size: uploaded.size,
    processedAt: uploaded.uploadedAt
  }));

  // Combine arrays with processed images first
  return [...processedImages, ...convertedUploadedImages];
}

/**
 * Gets combined images from a recall, handling display data
 */
export function getRecallImages(recall: RecallWithDisplay): ProcessedImage[] {
  const processedImages = recall.processedImages || [];
  const uploadedImages = recall.display?.uploadedImages || [];
  return combineImages(processedImages, uploadedImages);
}

/**
 * Adjusts image index to account for combined images
 * Returns -1 if the index is invalid
 */
export function adjustImageIndex(
  index: number,
  processedImagesCount: number,
  isForUploadedImage: boolean = false
): number {
  if (index < 0) return -1;
  
  if (isForUploadedImage) {
    // For uploaded images, add the processed images count
    return processedImagesCount + index;
  }
  
  return index;
}