import * as admin from 'firebase-admin';
import { FDARecall, FDAQueryOptions } from '../../types/fda.types';
import logger from '../../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const FDA_RECALLS_COLLECTION = 'fda_recalls';

export class FDAFirebaseService {
  /**
   * Get FDA recalls by state
   */
  async getRecallsByState(stateCode: string, options: FDAQueryOptions = {}): Promise<FDARecall[]> {
    try {
      const { limit = 5000, startDate, endDate } = options;
      
      // Get state-specific recalls
      let stateQuery = db.collection(FDA_RECALLS_COLLECTION)
        .where('affectedStatesArray', 'array-contains', stateCode)
        .orderBy('report_date', 'desc');

      // Apply date filters if provided
      if (startDate) {
        const startDateStr = this.formatDateToYYYYMMDD(startDate);
        stateQuery = stateQuery.where('report_date', '>=', startDateStr);
      }
      
      if (endDate) {
        const endDateStr = this.formatDateToYYYYMMDD(endDate);
        stateQuery = stateQuery.where('report_date', '<=', endDateStr);
      }

      stateQuery = stateQuery.limit(limit);
      const stateSnapshot = await stateQuery.get();

      // Get nationwide recalls (only if not already requesting "Nationwide")
      let nationwideSnapshot;
      if (stateCode.toLowerCase() !== 'nationwide') {
        let nationwideQuery = db.collection(FDA_RECALLS_COLLECTION)
          .where('affectedStatesArray', 'array-contains', 'Nationwide')
          .orderBy('report_date', 'desc');

        // Apply same date filters to nationwide query
        if (startDate) {
          const startDateStr = this.formatDateToYYYYMMDD(startDate);
          nationwideQuery = nationwideQuery.where('report_date', '>=', startDateStr);
        }
        
        if (endDate) {
          const endDateStr = this.formatDateToYYYYMMDD(endDate);
          nationwideQuery = nationwideQuery.where('report_date', '<=', endDateStr);
        }

        nationwideQuery = nationwideQuery.limit(limit);
        nationwideSnapshot = await nationwideQuery.get();
      }

      // Combine results
      const stateRecalls: FDARecall[] = [];
      stateSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        stateRecalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      const nationwideRecalls: FDARecall[] = [];
      if (nationwideSnapshot) {
        nationwideSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
          nationwideRecalls.push({
            id: doc.id,
            ...doc.data()
          } as FDARecall);
        });
      }

      // Merge and remove duplicates (in case a recall affects both the state and is marked nationwide)
      const allRecalls = [...stateRecalls, ...nationwideRecalls];
      const uniqueRecalls = allRecalls.filter((recall, index, self) => 
        index === self.findIndex(r => r.id === recall.id)
      );

      // Sort by date and limit results
      const sortedRecalls = uniqueRecalls
        .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
        .slice(0, limit);

      return sortedRecalls;
    } catch (error) {
      logger.error('Error fetching FDA recalls by state:', error);
      throw error;
    }
  }

  /**
   * Get all FDA recalls
   */
  async getAllRecalls(options: FDAQueryOptions = {}): Promise<FDARecall[]> {
    try {
      const { limit = 10000, startDate, endDate } = options;
      
      let query = db.collection(FDA_RECALLS_COLLECTION)
        .orderBy('report_date', 'desc');

      // Apply date filters if provided
      if (startDate) {
        const startDateStr = this.formatDateToYYYYMMDD(startDate);
        query = query.where('report_date', '>=', startDateStr);
      }
      
      if (endDate) {
        const endDateStr = this.formatDateToYYYYMMDD(endDate);
        query = query.where('report_date', '<=', endDateStr);
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      
      const recalls: FDARecall[] = [];
      snapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        recalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      return recalls;
    } catch (error) {
      logger.error('Error fetching all FDA recalls:', error);
      throw error;
    }
  }

  /**
   * Get a single FDA recall by ID
   */
  async getRecallById(recallId: string): Promise<FDARecall | null> {
    try {
      const doc = await db.collection(FDA_RECALLS_COLLECTION).doc(recallId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      } as FDARecall;
    } catch (error) {
      logger.error('Error fetching FDA recall by ID:', error);
      throw error;
    }
  }

  /**
   * Get FDA recalls by date range
   */
  async getRecallsByDateRange(startDate: Date, endDate: Date, limit: number = 5000): Promise<FDARecall[]> {
    try {
      const startDateStr = this.formatDateToYYYYMMDD(startDate);
      const endDateStr = this.formatDateToYYYYMMDD(endDate);
      
      const query = db.collection(FDA_RECALLS_COLLECTION)
        .where('report_date', '>=', startDateStr)
        .where('report_date', '<=', endDateStr)
        .orderBy('report_date', 'desc')
        .limit(limit);

      const snapshot = await query.get();
      
      const recalls: FDARecall[] = [];
      snapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        recalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      return recalls;
    } catch (error) {
      logger.error('Error fetching FDA recalls by date range:', error);
      throw error;
    }
  }

  /**
   * Update FDA recall display data (for internal editing)
   */
  async updateRecallDisplay(recallId: string, displayData: any): Promise<void> {
    try {
      const docRef = db.collection(FDA_RECALLS_COLLECTION).doc(recallId);
      
      // Get current display data to handle uploaded image cleanup
      const currentDoc = await docRef.get();
      const currentDisplay = currentDoc.data()?.display;
      const currentUploadedImages = currentDisplay?.uploadedImages || [];
      
      if (displayData === undefined || displayData === null) {
        // Remove the display field entirely - delete all uploaded images
        if (currentUploadedImages.length > 0) {
          await this.deleteFDAUploadedImages(recallId, currentUploadedImages);
        }
        
        const FieldValue = require('firebase-admin').firestore.FieldValue;
        await docRef.update({
          display: FieldValue.delete(),
          lastUpdated: new Date().toISOString()
        });
        logger.info(`Removed FDA display data for recall ${recallId}`);
      } else {
        // Check for removed uploaded images and delete them from storage
        const newUploadedImages = displayData.uploadedImages || [];
        const removedImages = currentUploadedImages.filter((current: any) => 
          !newUploadedImages.find((newImg: any) => newImg.filename === current.filename)
        );
        
        if (removedImages.length > 0) {
          await this.deleteFDAUploadedImages(recallId, removedImages);
          logger.info(`Deleted ${removedImages.length} removed FDA uploaded images from storage`);
        }
        
        // Update only the display field
        await docRef.update({
          display: displayData,
          lastUpdated: new Date().toISOString()
        });
        logger.info(`Updated FDA recall display data for ID: ${recallId}`);
      }
    } catch (error) {
      logger.error('Error updating FDA recall display:', error);
      throw error;
    }
  }

  /**
   * Get database statistics for FDA recalls
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const snapshot = await db.collection(FDA_RECALLS_COLLECTION).get();
      const totalRecalls = snapshot.size;

      // Get date range
      const recalls: FDARecall[] = [];
      snapshot.forEach(doc => {
        recalls.push(doc.data() as FDARecall);
      });

      const dates = recalls
        .map(r => r.report_date)
        .filter(d => d)
        .sort();

      const stats = {
        collection: FDA_RECALLS_COLLECTION,
        totalRecalls,
        dateRange: {
          earliest: dates[0] || null,
          latest: dates[dates.length - 1] || null
        },
        lastUpdated: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      logger.error('Error getting FDA database stats:', error);
      throw error;
    }
  }

  /**
   * Uploads images to Firebase Storage for FDA recalls and returns metadata
   * 
   * This method handles the upload of user-submitted images to Firebase Storage
   * and returns the metadata needed for the display array.
   * 
   * @param recallId - The FDA recall ID to associate images with
   * @param files - Array of multer files to upload
   * @param uploadedBy - Optional username of the person uploading the images
   * @returns Promise resolving to array of UploadedImage metadata
   */
  async uploadFDARecallImages(recallId: string, files: Express.Multer.File[], uploadedBy?: string): Promise<any[]> {
    try {
      const bucket = admin.storage().bucket();
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 11);
        const fileExtension = file.originalname.split('.').pop() || 'jpg';
        const filename = `uploaded_${timestamp}_${randomString}_${i}.${fileExtension}`;
        const storagePath = `fda-recall-images/${recallId}/${filename}`;

        // Create a file reference in Firebase Storage
        const fileRef = bucket.file(storagePath);

        // Upload the file buffer
        await fileRef.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedAt: new Date().toISOString(),
              recallId: recallId
            }
          }
        });

        // Make the file publicly readable
        await fileRef.makePublic();

        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        // Create the uploaded image metadata (excluding undefined fields)
        const uploadedImage: any = {
          filename: filename,
          originalName: file.originalname,
          type: 'uploaded-image' as const,
          storageUrl: publicUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploadedBy || 'unknown-user',
          size: file.size
        };

        uploadedImages.push(uploadedImage);
        logger.info(`Uploaded FDA image ${filename} for recall ${recallId}`);
      }

      return uploadedImages;
    } catch (error) {
      logger.error(`Error uploading FDA images for recall ${recallId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes uploaded images from Firebase Storage for FDA recalls
   * 
   * @param recallId - The FDA recall ID to help construct storage paths
   * @param uploadedImages - Array of uploaded images to delete
   */
  async deleteFDAUploadedImages(recallId: string, uploadedImages: any[]): Promise<void> {
    try {
      const bucket = admin.storage().bucket();

      for (const image of uploadedImages) {
        if (image.type === 'uploaded-image' && image.filename) {
          const storagePath = `fda-recall-images/${recallId}/${image.filename}`;
          
          try {
            const file = bucket.file(storagePath);
            await file.delete();
            logger.info(`Deleted FDA uploaded image from storage: ${storagePath}`);
          } catch (deleteError) {
            logger.error(`Failed to delete FDA image from storage: ${storagePath}`, deleteError);
            // Continue with other deletions even if one fails
          }
        }
      }
    } catch (error) {
      logger.error('Error deleting FDA uploaded images from storage:', error);
      throw error;
    }
  }

  /**
   * Format date to YYYYMMDD string for FDA date fields
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

// Export singleton instance
export const fdaFirebaseService = new FDAFirebaseService();