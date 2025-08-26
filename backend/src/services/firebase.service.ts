import * as admin from 'firebase-admin';
import { ProcessedRecall, Recall } from '../models/recall.model';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import { openAIService } from './openai.service';

// Load environment variables
dotenv.config();

/**
 * Service class for managing recall data in Firebase Firestore
 * 
 * This service handles:
 * - Saving and updating recall documents in Firestore
 * - Processing raw recall data into enhanced format
 * - Querying recalls by various criteria
 * - Managing product images in Firebase Storage (future implementation)
 * 
 * The service uses a single 'recalls' collection with the following structure:
 * - Document ID: Auto-generated Firestore ID
 * - Document data: ProcessedRecall object
 * - Indexes: field_recall_number, field_recall_date, affectedStatesArray
 * 
 * @example
 * ```typescript
 * const firebaseService = new FirebaseService();
 * await firebaseService.saveRecall(recallData);
 * const recentRecalls = await firebaseService.getRecentRecalls(30);
 * ```
 */
export class FirebaseService {
  private db: admin.firestore.Firestore;
  private storage: admin.storage.Storage;
  private recallsCollection: admin.firestore.CollectionReference;

  /**
   * Initializes Firebase Admin SDK and sets up Firestore references
   * 
   * Note: The private key often contains \n characters that need to be
   * properly formatted for the Firebase SDK
   */
  constructor() {
    if (!admin.apps.length) {
      // Debug: Check environment variables
      if (!process.env.FIREBASE_PROJECT_ID) {
        throw new Error('FIREBASE_PROJECT_ID is not set in environment variables');
      }
      if (!process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error('FIREBASE_CLIENT_EMAIL is not set in environment variables');
      }
      if (!process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('FIREBASE_PRIVATE_KEY is not set in environment variables');
      }
      if (!process.env.FIREBASE_STORAGE_BUCKET) {
        throw new Error('FIREBASE_STORAGE_BUCKET is not set in environment variables');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }

    this.db = admin.firestore();
    this.storage = admin.storage();
    this.recallsCollection = this.db.collection('recalls');
  }

  /**
   * Saves or updates a recall document in Firestore
   * 
   * Uses the recall number as a unique identifier to prevent duplicates.
   * If a recall with the same number exists, it updates the existing document.
   * 
   * @param recall - Raw recall data from USDA API
   * @returns Promise resolving to the Firestore document ID
   * @throws Error if save operation fails
   */
  async saveRecall(recall: Recall): Promise<string> {
    try {
      const processedRecall = this.processRecall(recall);
      
      const existingDoc = await this.recallsCollection
        .where('field_recall_number', '==', recall.field_recall_number)
        .where('langcode', '==', recall.langcode)
        .limit(1)
        .get();

      let docRef;
      if (!existingDoc.empty) {
        docRef = existingDoc.docs[0].ref;
        const updateData = this.buildUpdateData(processedRecall);
        await docRef.update(updateData);
        logger.info(`Updated recall ${recall.field_recall_number}`);
      } else {
        docRef = await this.recallsCollection.add({
          ...processedRecall,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Created new recall ${recall.field_recall_number}`);
      }

      return docRef.id;
    } catch (error) {
      logger.error('Error saving recall to Firestore:', error);
      throw error;
    }
  }

  /**
   * Batch saves multiple recalls to Firestore
   * 
   * Uses Firestore batch operations for better performance.
   * Processes recalls in sub-batches of 500 (Firestore limit).
   * Failed saves are logged but don't stop the batch process.
   * 
   * @param recalls - Array of raw recall data from USDA API
   * @returns Promise that resolves with array of new recall IDs
   */
  async saveRecalls(recalls: Recall[]): Promise<string[]> {
    const FIRESTORE_BATCH_LIMIT = 500;
    let savedCount = 0;
    let failedCount = 0;
    const newRecallIds: string[] = [];
    const newRecallsForLLM: Array<{ id: string, title: string }> = [];

    // Process in chunks of 500 (Firestore batch limit)
    for (let i = 0; i < recalls.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = recalls.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const batch = this.db.batch();
      const processedRecalls: Array<{ ref: admin.firestore.DocumentReference, data: any }> = [];

      // Prepare batch operations
      for (const recall of chunk) {
        try {
          const processedRecall = this.processRecall(recall);
          
          // Check if recall already exists (considering both recall number and language)
          const existingDoc = await this.recallsCollection
            .where('field_recall_number', '==', recall.field_recall_number)
            .where('langcode', '==', recall.langcode)
            .limit(1)
            .get();

          let docRef;
          if (!existingDoc.empty) {
            // Update existing document
            docRef = existingDoc.docs[0].ref;
            const existingData = existingDoc.docs[0].data();
            const updateData = this.buildUpdateData(processedRecall);
            
            // Preserve custom fields that shouldn't be overwritten
            if (existingData.display) {
              updateData.display = existingData.display;
            }
            if (existingData.llmTitle) {
              updateData.llmTitle = existingData.llmTitle;
            } else {
              // Existing recall without llmTitle - add to LLM processing queue
              newRecallsForLLM.push({ 
                id: docRef.id, 
                title: recall.field_title 
              });
            }
            
            batch.update(docRef, updateData);
          } else {
            // Create new document
            docRef = this.recallsCollection.doc();
            batch.set(docRef, {
              ...processedRecall,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Track new recall ID for queue integration
            newRecallIds.push(docRef.id);
            
            // New recall - add to LLM processing queue
            newRecallsForLLM.push({ 
              id: docRef.id, 
              title: recall.field_title 
            });
          }
          
          processedRecalls.push({ ref: docRef, data: recall });
        } catch (error) {
          logger.error(`Failed to prepare recall ${recall.field_recall_number}:`, error);
          failedCount++;
        }
      }

      // Commit the batch
      try {
        await batch.commit();
        savedCount += processedRecalls.length;
        logger.info(`Batch saved: ${processedRecalls.length} recalls (${i + chunk.length}/${recalls.length} total)`);
      } catch (error) {
        logger.error(`Batch commit failed:`, error);
        failedCount += processedRecalls.length;
      }
    }

    logger.info(`Batch save complete: ${savedCount} saved, ${failedCount} failed out of ${recalls.length} total`);
    logger.info(`New recalls created: ${newRecallIds.length}`);
    
    // Process LLM titles asynchronously (non-blocking) for recalls that need it
    if (newRecallsForLLM.length > 0) {
      this.processLLMTitlesForRecalls(newRecallsForLLM).catch(error => {
        logger.error('Error processing LLM titles:', error);
      });
    }
    
    return newRecallIds;
  }

  /**
   * Processes recall titles with OpenAI for specific recalls
   * This runs asynchronously to avoid blocking the sync process
   * 
   * @param recallsToProcess - Array of recalls with id and title to process
   * @private
   */
  private async processLLMTitlesForRecalls(recallsToProcess: Array<{ id: string, title: string }>): Promise<void> {
    if (!openAIService.isAvailable()) {
      logger.info('OpenAI service not available, skipping LLM title processing');
      return;
    }

    try {
      logger.info(`Processing LLM titles for ${recallsToProcess.length} USDA recalls`);
      
      let processedCount = 0;
      let errorCount = 0;

      // Limit to 500 recalls per sync to avoid overloading OpenAI API
      const recallsToProcessLimited = recallsToProcess.slice(0, 500);

      for (const recall of recallsToProcessLimited) {
        try {
          if (!recall.title) {
            continue;
          }

          // Get enhanced title from OpenAI
          const enhancedTitle = await openAIService.enhanceRecallTitle(recall.title);
          
          if (enhancedTitle) {
            // Update the recall with the enhanced title
            await this.recallsCollection.doc(recall.id).update({
              llmTitle: enhancedTitle
            });
            processedCount++;
            logger.info(`LLM title processed for recall ${recall.id}`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Failed to process LLM title for recall ${recall.id}:`, error);
        }
      }

      logger.info(`LLM title processing complete: ${processedCount} processed, ${errorCount} errors`);
    } catch (error) {
      logger.error('Error in processLLMTitlesForRecalls:', error);
    }
  }

  async getRecallById(id: string): Promise<ProcessedRecall | null> {
    try {
      const doc = await this.recallsCollection.doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as ProcessedRecall;
      }
      return null;
    } catch (error) {
      logger.error('Error fetching recall:', error);
      throw error;
    }
  }

  /**
   * Queries recalls affecting a specific state (includes both state-specific and nationwide recalls)
   * 
   * Uses Firestore's array-contains query on the processed affectedStatesArray field
   * 
   * @param stateCode - State name or abbreviation (e.g., "California", "CA")
   * @param limit - Maximum number of results to return (default: 100)
   * @returns Promise resolving to array of recalls affecting the specified state
   */
  async getRecallsByState(stateCode: string, limit: number = 100): Promise<ProcessedRecall[]> {
    try {
      // Get state-specific recalls
      const stateSnapshot = await this.recallsCollection
        .where('affectedStatesArray', 'array-contains', stateCode)
        .orderBy('field_recall_date', 'desc')
        .limit(limit)
        .get();

      // Get nationwide recalls (only if not already requesting "Nationwide")
      let nationwideSnapshot;
      if (stateCode.toLowerCase() !== 'nationwide') {
        nationwideSnapshot = await this.recallsCollection
          .where('affectedStatesArray', 'array-contains', 'Nationwide')
          .orderBy('field_recall_date', 'desc')
          .limit(limit)
          .get();
      }

      // Combine results
      const stateRecalls = stateSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProcessedRecall));

      const nationwideRecalls = nationwideSnapshot ? nationwideSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProcessedRecall)) : [];

      // Merge and remove duplicates (in case a recall affects both the state and is marked nationwide)
      const allRecalls = [...stateRecalls, ...nationwideRecalls];
      const uniqueRecalls = allRecalls.filter((recall, index, self) => 
        index === self.findIndex(r => r.id === recall.id)
      );

      // Sort by date and limit results
      const sortedRecalls = uniqueRecalls
        .sort((a, b) => new Date(b.field_recall_date).getTime() - new Date(a.field_recall_date).getTime())
        .slice(0, limit);

      return sortedRecalls;
    } catch (error) {
      logger.error('Error fetching recalls by state:', error);
      throw error;
    }
  }

  /**
   * Queries recalls from the last N days
   * 
   * @param days - Number of days to look back (default: 30)
   * @param limit - Maximum number of results to return (default: 100)
   * @returns Promise resolving to recent recalls ordered by date descending
   */
  async getRecentRecalls(days: number = 30, limit: number = 100): Promise<ProcessedRecall[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const snapshot = await this.recallsCollection
        .where('field_recall_date', '>=', cutoffDate.toISOString().split('T')[0])
        .orderBy('field_recall_date', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProcessedRecall));
    } catch (error) {
      logger.error('Error fetching recent recalls:', error);
      throw error;
    }
  }

  /**
   * Get all recalls from the database without any filtering
   * 
   * @param limit - Maximum number of results to return (default: 5000)
   * @returns Promise resolving to array of all recalls in database
   */
  async getAllRecalls(limit: number = 5000): Promise<ProcessedRecall[]> {
    try {
      const snapshot = await this.recallsCollection
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProcessedRecall));
    } catch (error) {
      logger.error('Error fetching all recalls:', error);
      throw error;
    }
  }

  /**
   * Builds update data object with only USDA fields and processed fields
   * Preserves custom fields like images that may have been added later
   * 
   * @param processedRecall - Processed recall data
   * @returns Update data object for Firestore
   * @private
   */
  private buildUpdateData(processedRecall: Omit<ProcessedRecall, 'id'>): any {
    const updateData: any = {};
    
    // Copy only the fields that come from USDA API
    const usdaFields = [
      'field_title', 'field_active_notice', 'field_states', 'field_archive_recall',
      'field_closed_date', 'field_closed_year', 'field_company_media_contact',
      'field_establishment', 'field_labels', 'field_media_contact', 'field_year',
      'field_risk_level', 'field_processing', 'field_product_items',
      'field_recall_classification', 'field_recall_date', 'field_recall_number',
      'field_recall_reason', 'field_recall_type', 'field_related_to_outbreak',
      'field_summary', 'field_translation_language', 'field_has_spanish', 'langcode'
    ];
    
    usdaFields.forEach(field => {
      if (field in processedRecall) {
        updateData[field] = (processedRecall as any)[field];
      }
    });
    
    // Add processed fields
    updateData.fetchedAt = processedRecall.fetchedAt;
    updateData.affectedStatesArray = processedRecall.affectedStatesArray;
    updateData.isActive = processedRecall.isActive;
    updateData.isArchived = processedRecall.isArchived;
    updateData.isOutbreakRelated = processedRecall.isOutbreakRelated;
    updateData.hasSpanishVersion = processedRecall.hasSpanishVersion;
    updateData.riskLevelCategory = processedRecall.riskLevelCategory;
    updateData.processedSummary = processedRecall.processedSummary;
    updateData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    
    return updateData;
  }

  /**
   * Processes raw recall data into enhanced format
   * 
   * This method:
   * - Parses comma-separated states into an array
   * - Converts string boolean fields to actual booleans
   * - Categorizes risk levels for easier filtering
   * - Cleans HTML content from summary text
   * 
   * @param recall - Raw recall data from USDA API
   * @returns Processed recall object ready for Firestore
   * @private
   */
  private processRecall(recall: Recall): Omit<ProcessedRecall, 'id'> {
    const affectedStatesArray = recall.field_states
      .split(',')
      .map(state => state.trim())
      .filter(state => state.length > 0);

    const riskLevelCategory = this.categorizeRiskLevel(recall.field_risk_level);

    return {
      ...recall,
      fetchedAt: new Date(),
      affectedStatesArray,
      isActive: recall.field_active_notice === 'True',
      isArchived: recall.field_archive_recall === 'True',
      isOutbreakRelated: recall.field_related_to_outbreak === 'True',
      hasSpanishVersion: recall.field_has_spanish === 'True',
      riskLevelCategory,
      processedSummary: this.cleanHtmlContent(recall.field_summary)
    };
  }

  /**
   * Categorizes USDA risk levels into simplified categories
   * 
   * USDA Risk Levels:
   * - Class I (High): Dangerous products that could cause serious health problems or death
   * - Class II (Low): Products that might cause temporary health problems
   * - Class III (Marginal): Products unlikely to cause health problems
   * 
   * @param riskLevel - Raw risk level string from USDA
   * @returns Simplified risk category
   * @private
   */
  private categorizeRiskLevel(riskLevel: string): 'high' | 'medium' | 'low' | 'unknown' {
    const lowerRisk = riskLevel.toLowerCase();
    if (lowerRisk.includes('high') || lowerRisk.includes('class i')) return 'high';
    if (lowerRisk.includes('medium')) return 'medium';
    if (lowerRisk.includes('low') || lowerRisk.includes('class ii')) return 'low';
    return 'unknown';
  }

  /**
   * Updates only the display data for a recall
   * 
   * This method allows customization of how a recall is displayed without
   * modifying any of the original USDA data. It only updates the 'display'
   * field in the Firestore document.
   * 
   * If display is undefined, it removes the display field entirely,
   * effectively resetting the recall to its original state.
   * 
   * @param recallId - Firestore document ID of the recall
   * @param displayData - Display customization object or undefined to reset
   * @returns Promise that resolves when update is complete
   * @throws Error if update operation fails
   */
  async updateRecallDisplay(recallId: string, displayData: any): Promise<void> {
    try {
      const docRef = this.recallsCollection.doc(recallId);
      
      // Get current display data to handle uploaded image cleanup
      const currentDoc = await docRef.get();
      const currentDisplay = currentDoc.data()?.display;
      const currentUploadedImages = currentDisplay?.uploadedImages || [];
      
      if (displayData === undefined || displayData === null) {
        // Remove the display field entirely - delete all uploaded images
        if (currentUploadedImages.length > 0) {
          await this.deleteUploadedImages(recallId, currentUploadedImages);
        }
        
        await docRef.update({
          display: admin.firestore.FieldValue.delete(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Removed display data for recall ${recallId}`);
      } else {
        // Check for removed uploaded images and delete them from storage
        const newUploadedImages = displayData.uploadedImages || [];
        const removedImages = currentUploadedImages.filter((current: any) => 
          !newUploadedImages.find((newImg: any) => newImg.filename === current.filename)
        );
        
        if (removedImages.length > 0) {
          await this.deleteUploadedImages(recallId, removedImages);
          logger.info(`Deleted ${removedImages.length} removed uploaded images from storage`);
        }
        
        // Update only the display field
        await docRef.update({
          display: displayData,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Updated display data for recall ${recallId}`);
      }
    } catch (error) {
      logger.error(`Error updating display data for recall ${recallId}:`, error);
      throw error;
    }
  }

  /**
   * Uploads images to Firebase Storage and returns metadata
   * 
   * This method handles the upload of user-submitted images to Firebase Storage
   * and returns the metadata needed for the display array.
   * 
   * @param recallId - The recall ID to associate images with
   * @param files - Array of multer files to upload
   * @param uploadedBy - Optional username of the person uploading the images
   * @returns Promise resolving to array of UploadedImage metadata
   */
  async uploadRecallImages(recallId: string, files: Express.Multer.File[], uploadedBy?: string): Promise<any[]> {
    try {
      const bucket = admin.storage().bucket();
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 11);
        const fileExtension = file.originalname.split('.').pop() || 'jpg';
        const filename = `uploaded_${timestamp}_${randomString}_${i}.${fileExtension}`;
        const storagePath = `recall-images/${recallId}/${filename}`;

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

        // Only add dimensions if we have them (avoid undefined values in Firestore)
        // Could be determined using Sharp if needed in the future

        uploadedImages.push(uploadedImage);
        logger.info(`Uploaded image ${filename} for recall ${recallId}`);
      }

      return uploadedImages;
    } catch (error) {
      logger.error(`Error uploading images for recall ${recallId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes uploaded images from Firebase Storage
   * 
   * @param recallId - The recall ID to help construct storage paths
   * @param uploadedImages - Array of uploaded images to delete
   */
  async deleteUploadedImages(recallId: string, uploadedImages: any[]): Promise<void> {
    try {
      const bucket = admin.storage().bucket();

      for (const image of uploadedImages) {
        if (image.type === 'uploaded-image' && image.filename) {
          const storagePath = `recall-images/${recallId}/${image.filename}`;
          
          try {
            const file = bucket.file(storagePath);
            await file.delete();
            logger.info(`Deleted uploaded image from storage: ${storagePath}`);
          } catch (deleteError) {
            logger.error(`Failed to delete image from storage: ${storagePath}`, deleteError);
            // Continue with other deletions even if one fails
          }
        }
      }
    } catch (error) {
      logger.error('Error deleting uploaded images from storage:', error);
      throw error;
    }
  }

  /**
   * Strips HTML tags and decodes Unicode escape sequences
   * 
   * The USDA API returns HTML-encoded content with Unicode escapes.
   * This method cleans the content for plain text display.
   * 
   * @param html - HTML-encoded string with potential Unicode escapes
   * @returns Clean plain text string
   * @private
   */
  private cleanHtmlContent(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\\u[\dA-F]{4}/gi, match => // Decode Unicode escapes
        String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
      )
      .trim();
  }
}