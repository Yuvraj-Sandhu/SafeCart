import { Router, Request, Response } from 'express';
import { fdaFirebaseService } from '../services/fda/firebase.service';
import { FDARecallResponse } from '../types/fda.types';
import logger from '../utils/logger';

const router = Router();

/**
 * Get FDA recalls by state
 * GET /api/fda/recalls/state/:stateCode
 */
router.get('/recalls/state/:stateCode', async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const limit = parseInt(req.query.limit as string) || 500;
    
    // Parse date filters if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const recalls = await fdaFirebaseService.getRecallsByState(stateCode, {
      limit,
      startDate,
      endDate
    });
    
    const response: FDARecallResponse = {
      success: true,
      data: recalls,
      total: recalls.length,
      source: 'FDA'
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error in FDA recalls by state endpoint:', error);
    const response: FDARecallResponse = {
      success: false,
      data: [],
      source: 'FDA',
      error: error instanceof Error ? error.message : 'Failed to fetch FDA recalls'
    };
    res.status(500).json(response);
  }
});

/**
 * Get all FDA recalls
 * GET /api/fda/recalls/all
 */
router.get('/recalls/all', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 500;
    
    // Parse date filters if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const recalls = await fdaFirebaseService.getAllRecalls({
      limit,
      startDate,
      endDate
    });
    
    const response: FDARecallResponse = {
      success: true,
      data: recalls,
      total: recalls.length,
      source: 'FDA'
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error in FDA all recalls endpoint:', error);
    const response: FDARecallResponse = {
      success: false,
      data: [],
      source: 'FDA',
      error: error instanceof Error ? error.message : 'Failed to fetch FDA recalls'
    };
    res.status(500).json(response);
  }
});

/**
 * Get single FDA recall by ID
 * GET /api/fda/recalls/:id
 */
router.get('/recalls/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const recall = await fdaFirebaseService.getRecallById(id);
    
    if (!recall) {
      res.status(404).json({
        success: false,
        data: [],
        source: 'FDA',
        error: 'FDA recall not found'
      });
      return;
    }
    
    const response: FDARecallResponse = {
      success: true,
      data: [recall],
      total: 1,
      source: 'FDA'
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error in FDA recall by ID endpoint:', error);
    const response: FDARecallResponse = {
      success: false,
      data: [],
      source: 'FDA',
      error: error instanceof Error ? error.message : 'Failed to fetch FDA recall'
    };
    res.status(500).json(response);
  }
});

/**
 * Update FDA recall display data
 * PUT /api/fda/recalls/:id/display
 */
router.put('/recalls/:id/display', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const displayData = req.body.display;
    
    await fdaFirebaseService.updateRecallDisplay(id, displayData);
    
    res.json({
      success: true,
      message: 'FDA recall display data updated successfully'
    });
  } catch (error) {
    logger.error('Error updating FDA recall display:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update FDA recall display'
    });
  }
});

/**
 * Get FDA database statistics
 * GET /api/fda/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await fdaFirebaseService.getDatabaseStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting FDA stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get FDA statistics'
    });
  }
});

export default router;