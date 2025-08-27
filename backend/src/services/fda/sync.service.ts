import { FDAApiService } from './api.service';
import { FDARecall } from '../../types/fda.types';
import logger from '../../utils/logger';
import * as admin from 'firebase-admin';
import { openAIService } from '../openai.service';

/**
 * Service for synchronizing FDA recall data with Firebase
 * 
 * This service handles:
 * - Fetching recent FDA recalls (last 60 days by default)
 * - Merging with existing data while preserving custom fields
 * - Batch saving to Firebase
 */
export class FDASyncService {
  private fdaApiService: FDAApiService;
  private readonly FDA_RECALLS_COLLECTION = 'fda_recalls';
  private readonly BATCH_SIZE = 500; // Firestore batch limit
  
  constructor() {
    this.fdaApiService = new FDAApiService();
  }

  /**
   * Performs a sync of recent FDA recalls
   * 
   * This method:
   * 1. Fetches recalls from the last 60 days from FDA API
   * 2. Compares with existing data in Firebase
   * 3. Updates only API fields while preserving custom fields (display, etc.)
   * 
   * @param days - Number of days to fetch (default: 60)
   * @returns Promise that resolves when sync is complete
   */
  async performSync(days: number = 60): Promise<string[]> {
    try {
      // Fetch recent recalls from FDA API
      const recentRecalls = await this.fdaApiService.fetchRecentRecalls(days);
      logger.info(`Fetched ${recentRecalls.length} FDA recalls from API`);

      if (recentRecalls.length === 0) {
        logger.info('No FDA recalls found for the specified period');
        return [];
      }

      // Save to Firebase with custom field preservation
      const newRecallIds = await this.saveRecallsWithMerge(recentRecalls);
      return newRecallIds;
    } catch (error) {
      logger.error('FDA sync failed:', error);
      throw error;
    }
  }

  /**
   * Save FDA recalls to Firebase while preserving custom fields
   * 
   * This method:
   * - Creates document IDs using recall_number and event_id
   * - Fetches existing documents to preserve custom fields
   * - Updates only API fields, keeping display and other custom data intact
   * 
   * @param recalls - Array of FDA recalls from API
   * @returns Array of new recall IDs
   */
  private async saveRecallsWithMerge(recalls: Omit<FDARecall, 'id'>[]): Promise<string[]> {
    const db = admin.firestore();
    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    let newRecords = 0;
    let updatedRecords = 0;
    const newRecallIds: string[] = [];
    const newRecallsForLLM: Array<{ id: string, title: string }> = [];

    logger.info(`Processing ${recalls.length} FDA recalls for save/update...`);

    for (const recall of recalls) {
      // Create document ID from recall_number and event_id (same as fetch-fda-recalls.js)
      const recallNumber = this.sanitizeDocumentId(recall.recall_number || 'UNKNOWN');
      const eventId = this.sanitizeDocumentId(recall.event_id || 'UNKNOWN');
      const docId = `${recallNumber}_${eventId}`;
      
      const docRef = db.collection(this.FDA_RECALLS_COLLECTION).doc(docId);
      
      try {
        // Check if document exists
        const existingDoc = await docRef.get();
        
        if (existingDoc.exists) {
          // Document exists - merge only API fields, preserve custom fields
          const existingData = existingDoc.data() as FDARecall;
          
          // Create update object with only API fields (exclude custom fields)
          const updateData: any = {
            // Core FDA fields
            recall_number: recall.recall_number,
            event_id: recall.event_id,
            status: recall.status,
            classification: recall.classification,
            product_type: recall.product_type,
            
            // Company information
            recalling_firm: recall.recalling_firm,
            address_1: recall.address_1,
            address_2: recall.address_2,
            city: recall.city,
            state: recall.state,
            postal_code: recall.postal_code,
            country: recall.country,
            
            // Product information
            product_description: recall.product_description,
            product_quantity: recall.product_quantity,
            code_info: recall.code_info,
            more_code_info: recall.more_code_info,
            
            // Recall details
            reason_for_recall: recall.reason_for_recall,
            voluntary_mandated: recall.voluntary_mandated,
            initial_firm_notification: recall.initial_firm_notification,
            distribution_pattern: recall.distribution_pattern,
            
            // Dates
            recall_initiation_date: recall.recall_initiation_date,
            center_classification_date: recall.center_classification_date,
            termination_date: recall.termination_date,
            report_date: recall.report_date,
            
            // Metadata
            source: recall.source,
            api_version: recall.api_version,
            last_synced: admin.firestore.FieldValue.serverTimestamp(),
            
            // Searchable arrays
            affectedStatesArray: recall.affectedStatesArray,
            
            // OpenFDA data
            openfda: recall.openfda,
          };
          
          // Preserve existing display and other custom fields
          if (existingData.display) {
            updateData.display = existingData.display;
          }
          
          // Preserve llmTitle if it exists
          if (existingData.llmTitle) {
            updateData.llmTitle = existingData.llmTitle;
          } else {
            // Existing recall without llmTitle - add to LLM processing queue
            newRecallsForLLM.push({ 
              id: docId, 
              title: recall.product_description 
            });
          }
          
          // Preserve manual states override if it exists
          if (existingData.useManualStates) {
            updateData.manualStatesOverride = existingData.manualStatesOverride;
            updateData.useManualStates = existingData.useManualStates;
            updateData.manualStatesUpdatedBy = existingData.manualStatesUpdatedBy;
            updateData.manualStatesUpdatedAt = existingData.manualStatesUpdatedAt;
            
            // Don't update affectedStatesArray if using manual override
            delete updateData.affectedStatesArray;
            updateData.affectedStatesArray = existingData.affectedStatesArray;
          }
          
          currentBatch.update(docRef, updateData);
          updatedRecords++;
        } else {
          // New document - set all fields including imported_at
          currentBatch.set(docRef, {
            ...recall,
            imported_at: admin.firestore.FieldValue.serverTimestamp(),
            last_synced: admin.firestore.FieldValue.serverTimestamp(),
          });
          newRecords++;
          
          // Track new recall ID for queue integration
          newRecallIds.push(docId);
          
          // New recall - add to LLM processing queue
          newRecallsForLLM.push({ 
            id: docId, 
            title: recall.product_description 
          });
        }
        
        operationCount++;
        
        // Check if we need to start a new batch
        if (operationCount >= this.BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
        
      } catch (error) {
        logger.error(`Error processing FDA recall ${docId}:`, error);
        // Continue with other recalls
      }
    }

    // Add the last batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Execute all batches
    logger.info(`Committing ${batches.length} batch(es) to Firebase...`);
    logger.info(`New records: ${newRecords}, Updated records: ${updatedRecords}`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        logger.info(`Committed FDA batch ${i + 1}/${batches.length}`);
      } catch (error) {
        logger.error(`Failed to commit FDA batch ${i + 1}/${batches.length}:`, error);
        throw error;
      }
    }

    logger.info(`FDA sync complete: ${newRecords} new, ${updatedRecords} updated`);
    
    // Process LLM titles asynchronously (non-blocking) for recalls that need it
    if (newRecallsForLLM.length > 0) {
      this.processLLMTitlesForFDARecalls(newRecallsForLLM).catch(error => {
        logger.error('Error processing LLM titles for FDA recalls:', error);
      });
    }
    
    return newRecallIds;
  }

  /**
   * Processes FDA recall titles with OpenAI for specific recalls
   * This runs asynchronously to avoid blocking the sync process
   * 
   * @param recallsToProcess - Array of recalls with id and title to process
   * @private
   */
  private async processLLMTitlesForFDARecalls(recallsToProcess: Array<{ id: string, title: string }>): Promise<void> {
    if (!openAIService.isAvailable()) {
      logger.info('OpenAI service not available, skipping LLM title processing for FDA recalls');
      return;
    }

    const db = admin.firestore();

    try {
      logger.info(`Processing LLM titles for ${recallsToProcess.length} FDA recalls`);
      
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
            await db.collection(this.FDA_RECALLS_COLLECTION).doc(recall.id).update({
              llmTitle: enhancedTitle
            });
            processedCount++;
            logger.info(`LLM title processed for FDA recall ${recall.id}`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Failed to process LLM title for FDA recall ${recall.id}:`, error);
        }
      }

      logger.info(`FDA LLM title processing complete: ${processedCount} processed, ${errorCount} errors`);
    } catch (error) {
      logger.error('Error in processLLMTitlesForFDARecalls:', error);
    }
  }

  /**
   * Sanitize document ID to ensure it's valid for Firestore
   * (Same logic as fetch-fda-recalls.js)
   */
  private sanitizeDocumentId(id: string): string {
    if (!id || id.trim() === '') {
      return 'UNKNOWN';
    }
    
    return id
      .replace(/[\/\\\.\#\$\[\]]/g, '_') // Replace invalid characters
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .replace(/\s+/g, '_') // Replace spaces
      .replace(/_{2,}/g, '_') // Replace multiple underscores
      .substring(0, 1500) // Firestore document ID limit
      .trim() || 'UNKNOWN';
  }

  /**
   * Perform a historical sync for initial setup
   * 
   * @param days - Number of days to fetch (default: 365 for one year)
   */
  async performHistoricalSync(days: number = 365): Promise<void> {
    logger.info(`Starting FDA historical sync for ${days} days...`);
    
    try {
      await this.performSync(days);
      logger.info('FDA historical sync completed');
    } catch (error) {
      logger.error('FDA historical sync failed:', error);
      throw error;
    }
  }
}