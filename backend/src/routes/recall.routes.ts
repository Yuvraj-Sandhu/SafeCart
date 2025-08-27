/**
 * Express router for recall-related API endpoints
 * 
 * This module defines RESTful endpoints for:
 * - Querying recall data from Firebase
 * - Triggering manual data synchronization
 * - Testing API connections
 * 
 * All endpoints return JSON responses with a consistent structure:
 * {
 *   success: boolean,
 *   data?: any,
 *   error?: string,
 *   count?: number,
 *   message?: string
 * }
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { USDAApiService } from '../services/usda-api.service';
import { FirebaseService } from '../services/firebase.service';
import { FDAFirebaseService } from '../services/fda/firebase.service';
import { SyncService } from '../services/sync.service';
import { PendingChangesService } from '../services/pending-changes.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();
const usdaService = new USDAApiService();
const firebaseService = new FirebaseService();
const fdaFirebaseService = new FDAFirebaseService();
const syncService = new SyncService();


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * GET /api/public/recall/:id
 * 
 * Public endpoint to fetch a specific recall by ID
 * No authentication required - for email links and sharing
 * 
 * @param id - The Firestore document ID of the recall
 * @returns JSON response with recall details
 */
router.get('/public/recall/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Try to find in USDA recalls first
    const usdaRecall = await firebaseService.getRecallById(id);
    
    if (usdaRecall) {
      return res.json({
        success: true,
        recall: usdaRecall,
        source: 'USDA'
      });
    }
    
    // Try to find in FDA recalls
    const fdaRecall = await fdaFirebaseService.getRecallById(id);
    
    if (fdaRecall) {
      return res.json({
        success: true,
        recall: fdaRecall,
        source: 'FDA'
      });
    }
    
    // Recall not found
    res.status(404).json({
      success: false,
      error: 'Recall not found'
    });
    
  } catch (error) {
    logger.error('Error fetching public recall:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recall details'
    });
  }
});

/**
 * GET /api/recalls/state/:stateCode
 * 
 * Retrieves recalls affecting a specific state from Firebase
 * 
 * @param stateCode - State name or abbreviation (e.g., "California", "CA")
 * @query limit - Maximum number of results (default: 100)
 * @query startDate - Start date for filtering (ISO format)
 * @query endDate - End date for filtering (ISO format)
 * 
 * @returns JSON response with recalls array
 * 
 * @example
 * GET /api/recalls/state/California?limit=50&startDate=2024-01-01&endDate=2024-12-31
 */
router.get('/recalls/state/:stateCode', async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const excludePending = req.query.excludePending === 'true';
    
    let recalls = await firebaseService.getRecallsByState(stateCode, limit);
    
    // Apply date filtering if provided
    if (startDate || endDate) {
      recalls = recalls.filter(recall => {
        const recallDate = new Date(recall.field_recall_date);
        if (startDate && recallDate < new Date(startDate)) return false;
        if (endDate && recallDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // Filter out recalls with pending changes if requested
    if (excludePending) {
      const pendingIds = await PendingChangesService.getPendingRecallIds();
      recalls = recalls.filter(recall => {
        const compositeId = `${recall.id}_USDA`;
        return !pendingIds.has(compositeId);
      });
    }
    
    res.json({
      success: true,
      count: recalls.length,
      data: recalls
    });
  } catch (error) {
    logger.error('Error fetching recalls by state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls'
    });
  }
});

/**
 * GET /api/recalls/recent
 * 
 * Retrieves recent recalls from Firebase ordered by date
 * 
 * @query days - Number of days to look back (default: 30)
 * @query limit - Maximum number of results (default: 100)
 * 
 * @returns JSON response with recent recalls array
 * 
 * @example
 * GET /api/recalls/recent?days=7&limit=25
 */
router.get('/recalls/recent', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const recalls = await firebaseService.getRecentRecalls(days, limit);
    res.json({
      success: true,
      count: recalls.length,
      data: recalls
    });
  } catch (error) {
    logger.error('Error fetching recent recalls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls'
    });
  }
});

/**
 * GET /api/recalls/all
 * 
 * Retrieves all recalls from Firebase with optional date filtering
 * 
 * @query limit - Maximum number of results (default: 5000)
 * @query startDate - Start date for filtering (ISO format)
 * @query endDate - End date for filtering (ISO format)
 * 
 * @returns JSON response with all recalls in database
 * 
 * @example
 * GET /api/recalls/all?limit=10000&startDate=2024-01-01&endDate=2024-12-31
 */
router.get('/recalls/all', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5000;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const excludePending = req.query.excludePending === 'true';
    
    // Get all recalls
    let recalls = await firebaseService.getAllRecalls(limit);
    
    // Apply date filtering if provided
    if (startDate || endDate) {
      recalls = recalls.filter(recall => {
        const recallDate = new Date(recall.field_recall_date);
        if (startDate && recallDate < new Date(startDate)) return false;
        if (endDate && recallDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // Filter out recalls with pending changes if requested
    if (excludePending) {
      const pendingIds = await PendingChangesService.getPendingRecallIds();
      recalls = recalls.filter(recall => {
        const compositeId = `${recall.id}_USDA`;
        return !pendingIds.has(compositeId);
      });
    }
    
    res.json({
      success: true,
      count: recalls.length,
      data: recalls
    });
  } catch (error) {
    logger.error('Error fetching all recalls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all recalls'
    });
  }
});

/**
 * GET /api/recalls/:id
 * 
 * Retrieves a specific recall by its Firestore document ID
 * 
 * @param id - Firestore document ID
 * 
 * @returns JSON response with recall data or 404 if not found
 * 
 * @example
 * GET /api/recalls/abc123def456
 */
router.get('/recalls/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recall = await firebaseService.getRecallById(id);
    
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: 'Recall not found'
      });
    }
    
    res.json({
      success: true,
      data: recall
    });
  } catch (error) {
    logger.error('Error fetching recall:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recall'
    });
  }
});

/**
 * POST /api/sync/trigger
 * 
 * Manually triggers a data synchronization with USDA API
 * 
 * The sync runs in the background and the endpoint returns immediately.
 * Check server logs for sync progress and results.
 * 
 * @returns JSON response confirming sync has started
 * 
 * @example
 * POST /api/sync/trigger
 */
router.post('/sync/trigger', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Sync started in background'
    });
    
    // Run sync in background
    syncService.performSync().catch(error => {
      logger.error('Background sync failed:', error);
    });
  } catch (error) {
    logger.error('Error triggering sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start sync'
    });
  }
});

/**
 * POST /api/sync/historical
 * 
 * Triggers historical data backfill for initial database setup
 * 
 * This is typically run once when setting up SafeCart to populate
 * the database with historical recall data.
 * 
 * @body years - Number of years to backfill (default: 2)
 * 
 * @returns JSON response confirming historical sync has started
 * 
 * @example
 * POST /api/sync/historical
 * Content-Type: application/json
 * { "years": 3 }
 */
router.post('/sync/historical', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const years = parseInt(req.body.years) || 2;
    
    res.json({
      success: true,
      message: `Historical sync for ${years} years started in background`
    });
    
    // Run sync in background
    syncService.performHistoricalSync(years).catch(error => {
      logger.error('Background historical sync failed:', error);
    });
  } catch (error) {
    logger.error('Error triggering historical sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start historical sync'
    });
  }
});

/**
 * POST /api/sync/fda/trigger
 * 
 * Triggers FDA data sync manually
 * 
 * Fetches FDA recall data from the last 60 days and updates Firebase
 * while preserving custom fields like display data.
 * 
 * @body days - Number of days to sync (default: 60)
 * 
 * @returns JSON response confirming FDA sync has started
 * 
 * @example
 * POST /api/sync/fda/trigger
 * Content-Type: application/json
 * { "days": 30 }
 */
router.post('/sync/fda/trigger', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 60 } = req.body;
    
    res.json({
      success: true,
      message: `FDA sync started for last ${days} days`
    });
    
    // Run FDA sync in background
    syncService.performFDASync(days).catch(error => {
      logger.error('Background FDA sync failed:', error);
    });
  } catch (error) {
    logger.error('Error triggering FDA sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start FDA sync'
    });
  }
});

/**
 * POST /api/sync/fda/historical
 * 
 * Triggers FDA historical data sync
 * 
 * This is typically run once when setting up SafeCart to populate
 * the database with historical FDA recall data.
 * 
 * @body days - Number of days to backfill (default: 365)
 * 
 * @returns JSON response confirming FDA historical sync has started
 * 
 * @example
 * POST /api/sync/fda/historical
 * Content-Type: application/json
 * { "days": 730 }
 */
router.post('/sync/fda/historical', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 365 } = req.body;
    
    res.json({
      success: true,
      message: `FDA historical sync started for ${days} days`
    });
    
    // Run FDA historical sync in background
    syncService.performFDAHistoricalSync(days).catch(error => {
      logger.error('Background FDA historical sync failed:', error);
    });
  } catch (error) {
    logger.error('Error triggering FDA historical sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start FDA historical sync'
    });
  }
});

/**
 * GET /api/test/usda
 * 
 * Tests the connection to USDA API by fetching sample data
 * 
 * This endpoint is useful for:
 * - Verifying API connectivity during development
 * - Testing Phase 1 milestone: "California recalls for June 2024"
 * - Diagnosing API timeout issues
 * 
 * @returns JSON response with sample recall data and success status
 * 
 * @example
 * GET /api/test/usda
 */
router.get('/test/usda', async (req: Request, res: Response) => {
  try {
    // Test the Phase 1 milestone: California recalls for June 2024
    const recalls = await usdaService.fetchCaliforniaRecalls(2024, 6);
    res.json({
      success: true,
      message: 'USDA API is working',
      count: recalls.length,
      sampleData: recalls.slice(0, 3) // Return first 3 for testing
    });
  } catch (error) {
    logger.error('USDA API test failed:', error);
    res.status(500).json({
      success: false,
      error: 'USDA API test failed'
    });
  }
});

/**
 * GET /api/debug/stats
 * 
 * Retrieves database statistics for debugging
 * 
 * @returns JSON response with database statistics
 */
router.get('/debug/stats', async (req: Request, res: Response) => {
  try {
    // Get total count
    const allRecalls = await firebaseService.getAllRecalls(10000);
    
    // Count by state
    const stateCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};
    
    allRecalls.forEach(recall => {
      // Count states
      if (recall.affectedStatesArray) {
        recall.affectedStatesArray.forEach((state: string) => {
          stateCounts[state] = (stateCounts[state] || 0) + 1;
        });
      }
      
      // Count years
      if (recall.field_year) {
        yearCounts[recall.field_year] = (yearCounts[recall.field_year] || 0) + 1;
      }
    });
    
    res.json({
      success: true,
      totalRecalls: allRecalls.length,
      stateCounts,
      yearCounts,
      sampleRecord: allRecalls[0] || null
    });
  } catch (error) {
    logger.error('Error fetching debug stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch debug stats'
    });
  }
});

/**
 * POST /api/recalls/batch
 * 
 * Saves a batch of recalls to Firebase
 * 
 * This endpoint is used by the batch historical sync script to save
 * recalls in chunks to avoid timeout issues.
 * 
 * @body recalls - Array of recall objects from USDA API
 * 
 * @returns JSON response with success status and saved count
 * 
 * @example
 * POST /api/recalls/batch
 * Content-Type: application/json
 * { "recalls": [...] }
 */
router.post('/recalls/batch', async (req: Request, res: Response) => {
  try {
    const { recalls } = req.body;
    
    if (!recalls || !Array.isArray(recalls)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: recalls array required'
      });
    }
    
    logger.info(`Processing batch of ${recalls.length} recalls`);
    
    // Save the batch
    await firebaseService.saveRecalls(recalls);
    
    res.json({
      success: true,
      message: `Batch of ${recalls.length} recalls processed`,
      count: recalls.length
    });
  } catch (error) {
    logger.error('Error processing recall batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process recall batch'
    });
  }
});

/**
 * PUT /api/recalls/:id/display
 * 
 * Updates the display data for a specific recall
 * 
 * This endpoint allows internal team members to customize how a recall
 * is displayed without modifying the original USDA data.
 * 
 * @param id - Firestore document ID
 * @body display - Display customization object or undefined to reset
 * 
 * @returns JSON response with success status
 * 
 * @example
 * PUT /api/recalls/abc123def456/display
 * Content-Type: application/json
 * {
 *   "display": {
 *     "primaryImageIndex": 2,
 *     "previewTitle": "Custom Title",
 *     "cardSplits": [...],
 *     "lastEditedAt": "2024-01-20T...",
 *     "lastEditedBy": "user@example.com"
 *   }
 * }
 */
router.put('/recalls/:id/display', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { display } = req.body;
    
    // Validate that recall exists
    const recall = await firebaseService.getRecallById(id);
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: 'Recall not found'
      });
    }
    
    // Add audit information to display data if display data is provided
    let auditedDisplay = display;
    if (display && req.user) {
      auditedDisplay = {
        ...display,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: req.user.username
      };
    }
    
    // If display is explicitly undefined or null, ensure we pass that through
    if (display === undefined || display === null) {
      auditedDisplay = undefined;
    }
    
    // Update display data
    await firebaseService.updateRecallDisplay(id, auditedDisplay);
    
    logger.info(`Updated display data for recall ${id}`);
    
    res.json({
      success: true,
      message: 'Display data updated successfully'
    });
  } catch (error) {
    logger.error('Error updating recall display:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update display data'
    });
  }
});

/**
 * POST /api/recalls/:id/upload-images
 * 
 * Uploads images for a specific recall and updates display data
 * 
 * This endpoint handles image uploads to Firebase Storage and updates
 * the recall's display data with the uploaded image metadata.
 * 
 * @param id - Firestore document ID
 * @files images - Array of image files to upload
 * @body displayData - Updated display data including other changes
 * 
 * @returns JSON response with success status and uploaded image data
 * 
 * Example:
 * POST /api/recalls/abc123def456/upload-images
 * Content-Type: multipart/form-data
 * files: [image1.jpg, image2.png]
 * displayData: {"primaryImageIndex": 0, "previewTitle": "Custom Title"}
 */
router.post('/recalls/:id/upload-images', authenticate, requireAdmin, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images provided'
      });
    }
    
    // Validate that recall exists
    const recall = await firebaseService.getRecallById(id);
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: 'Recall not found'
      });
    }
    
    // Parse display data from form data
    let displayData;
    try {
      displayData = req.body.displayData ? JSON.parse(req.body.displayData) : {};
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid display data format'
      });
    }
    
    logger.info(`Uploading ${files.length} images for recall ${id}`);
    
    // Upload images to Firebase Storage and get metadata
    const uploadedImages = await firebaseService.uploadRecallImages(id, files, req.user?.username);
    
    // Update display data with uploaded images
    const updatedDisplayData = {
      ...displayData,
      uploadedImages: [
        ...(displayData.uploadedImages || []),
        ...uploadedImages
      ],
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: req.user?.username || 'unknown-user'
    };
    
    // Save updated display data to Firestore
    await firebaseService.updateRecallDisplay(id, updatedDisplayData);
    
    logger.info(`Successfully uploaded ${uploadedImages.length} images for recall ${id}`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedImages.length} images`,
      data: {
        uploadedImages,
        displayData: updatedDisplayData
      }
    });
    
  } catch (error) {
    logger.error('Error uploading images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload images'
    });
  }
});

export default router;