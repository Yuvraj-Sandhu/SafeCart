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
import { USDAApiService } from '../services/usda-api.service';
import { FirebaseService } from '../services/firebase.service';
import { SyncService } from '../services/sync.service';
import logger from '../utils/logger';

const router = Router();
const usdaService = new USDAApiService();
const firebaseService = new FirebaseService();
const syncService = new SyncService();

/**
 * GET /api/recalls/state/:stateCode
 * 
 * Retrieves recalls affecting a specific state from Firebase
 * 
 * @param stateCode - State name or abbreviation (e.g., "California", "CA")
 * @query limit - Maximum number of results (default: 100)
 * 
 * @returns JSON response with recalls array
 * 
 * @example
 * GET /api/recalls/state/California?limit=50
 */
router.get('/recalls/state/:stateCode', async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const recalls = await firebaseService.getRecallsByState(stateCode, limit);
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
 * Retrieves all recalls from Firebase without any filtering
 * 
 * @query limit - Maximum number of results (default: 5000)
 * 
 * @returns JSON response with all recalls in database
 * 
 * @example
 * GET /api/recalls/all?limit=10000
 */
router.get('/recalls/all', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5000;
    
    // Get all recalls without any filtering
    const recalls = await firebaseService.getAllRecalls(limit);
    
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
router.post('/sync/trigger', async (req: Request, res: Response) => {
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
router.post('/sync/historical', async (req: Request, res: Response) => {
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
router.put('/recalls/:id/display', async (req: Request, res: Response) => {
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
    
    // Update display data
    await firebaseService.updateRecallDisplay(id, display);
    
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

export default router;