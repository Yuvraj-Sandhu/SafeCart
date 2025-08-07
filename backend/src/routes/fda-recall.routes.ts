import { Router, Request, Response } from 'express';
import multer from 'multer';
import { fdaFirebaseService } from '../services/fda/firebase.service';
import { FDARecallResponse } from '../types/fda.types';
import { PendingChangesService } from '../services/pending-changes.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

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
 * Get FDA recalls by state
 * GET /api/fda/recalls/state/:stateCode
 */
router.get('/recalls/state/:stateCode', async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const limit = parseInt(req.query.limit as string) || 500;
    const excludePending = req.query.excludePending === 'true';
    
    // Parse date filters if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    let recalls = await fdaFirebaseService.getRecallsByState(stateCode, {
      limit,
      startDate,
      endDate
    });
    
    // Filter out recalls with pending changes if requested
    if (excludePending) {
      const pendingIds = await PendingChangesService.getPendingRecallIds();
      recalls = recalls.filter(recall => {
        const compositeId = `${recall.id}_FDA`;
        return !pendingIds.has(compositeId);
      });
    }
    
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
    const excludePending = req.query.excludePending === 'true';
    
    // Parse date filters if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    let recalls = await fdaFirebaseService.getAllRecalls({
      limit,
      startDate,
      endDate
    });
    
    // Filter out recalls with pending changes if requested
    if (excludePending) {
      const pendingIds = await PendingChangesService.getPendingRecallIds();
      recalls = recalls.filter(recall => {
        const compositeId = `${recall.id}_FDA`;
        return !pendingIds.has(compositeId);
      });
    }
    
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
router.put('/recalls/:id/display', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const displayData = req.body.display;
    
    // Add audit information to display data if display data is provided
    let auditedDisplay = displayData;
    if (displayData && req.user) {
      auditedDisplay = {
        ...displayData,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: req.user.username
      };
    }
    
    // If display is explicitly undefined or null, ensure we pass that through
    if (displayData === undefined || displayData === null) {
      auditedDisplay = undefined;
    }
    
    await fdaFirebaseService.updateRecallDisplay(id, auditedDisplay);
    
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
 * Update manual states override for FDA recall
 * PUT /api/fda/recalls/:id/manual-states
 * Admin only
 */
router.put('/recalls/:id/manual-states', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const { id } = req.params;
    const { states, useManualStates } = req.body;
    
    // Validate input
    if (!Array.isArray(states)) {
      return res.status(400).json({
        success: false,
        error: 'States must be an array'
      });
    }
    
    // Validate that recall exists
    const recall = await fdaFirebaseService.getRecallById(id);
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: 'FDA recall not found'
      });
    }
    
    // Update manual states override
    const updateData = {
      manualStatesOverride: states,
      useManualStates: useManualStates !== false, // Default to true
      manualStatesUpdatedBy: req.user.username,
      manualStatesUpdatedAt: new Date().toISOString()
    };
    
    await fdaFirebaseService.updateManualStates(id, updateData);
    
    logger.info(`Admin ${req.user.username} updated manual states for FDA recall ${id}`);
    
    res.json({
      success: true,
      message: 'Manual states override updated successfully',
      data: updateData
    });
  } catch (error) {
    logger.error('Error updating manual states:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update manual states'
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

/**
 * POST /api/fda/recalls/:id/upload-images
 * 
 * Uploads images for a specific FDA recall and updates display data
 * 
 * This endpoint handles image uploads to Firebase Storage and updates
 * the FDA recall's display data with the uploaded image metadata.
 * 
 * @param id - FDA recall document ID
 * @files images - Array of image files to upload
 * @body displayData - Updated display data including other changes
 * 
 * @returns JSON response with success status and uploaded image data
 * 
 * Example:
 * POST /api/fda/recalls/abc123def456/upload-images
 * Content-Type: multipart/form-data
 * files: [image1.jpg, image2.png]
 * displayData: {"primaryImageIndex": 0, "previewTitle": "Custom Title"}
 */
router.post('/recalls/:id/upload-images', authenticate, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images provided'
      });
    }
    
    // Validate that FDA recall exists
    const recall = await fdaFirebaseService.getRecallById(id);
    if (!recall) {
      return res.status(404).json({
        success: false,
        error: 'FDA recall not found'
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
    
    logger.info(`Uploading ${files.length} images for FDA recall ${id}`);
    
    // Upload images to Firebase Storage and get metadata
    const uploadedImages = await fdaFirebaseService.uploadFDARecallImages(id, files, req.user?.username);
    
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
    await fdaFirebaseService.updateRecallDisplay(id, updatedDisplayData);
    
    logger.info(`Successfully uploaded ${uploadedImages.length} images for FDA recall ${id}`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedImages.length} images`,
      data: {
        uploadedImages,
        displayData: updatedDisplayData
      }
    });
    
  } catch (error) {
    logger.error('Error uploading FDA images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload images'
    });
  }
});

export default router;