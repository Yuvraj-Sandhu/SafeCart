import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { PendingChangesService } from '../services/pending-changes.service';
import { FirebaseService } from '../services/firebase.service';
import { FDAFirebaseService } from '../services/fda/firebase.service';
import { CreatePendingChangeRequest } from '../types/pending-changes.types';
import logger from '../utils/logger';

const router = Router();

// Initialize Firebase services for image uploads
const firebaseService = new FirebaseService();
const fdaFirebaseService = new FDAFirebaseService();

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

// All routes require authentication
router.use(authenticate);

// Create a new pending change (members and admins)
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const data: CreatePendingChangeRequest = req.body;
    
    // Validate request
    if (!data.recallId || !data.recallSource || !data.proposedDisplay) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const userInfo = {
      uid: req.user.uid,
      username: req.user.username,
      email: req.user.email
    };
    
    const pendingChange = await PendingChangesService.createPendingChange(data, userInfo);
    
    res.json({
      success: true,
      data: pendingChange
    });
  } catch (error) {
    logger.error('Error creating pending change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pending change'
    });
  }
});

/**
 * POST /api/pending-changes/:id/upload-images
 * 
 * Upload images for a pending change WITHOUT modifying the live recall
 * This ensures members can upload images that only become live after admin approval
 */
router.post('/:id/upload-images', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { id: pendingChangeId } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    // Get the pending change
    const pendingChange = await PendingChangesService.getPendingChange(pendingChangeId);
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Pending change not found'
      });
    }

    // Ensure user owns this pending change (members can only edit their own)
    if (req.user.role === 'member' && pendingChange.proposedBy.uid !== req.user.uid) {
      return res.status(403).json({
        success: false,  
        message: 'You can only upload images to your own pending changes'
      });
    }

    logger.info(`Uploading ${files.length} images for pending change ${pendingChangeId}`);
    
    // Upload images to Firebase Storage (same storage location as live recalls)
    let uploadedImages;
    if (pendingChange.recallSource === 'USDA') {
      uploadedImages = await firebaseService.uploadRecallImages(pendingChange.recallId, files);
    } else {
      uploadedImages = await fdaFirebaseService.uploadFDARecallImages(pendingChange.recallId, files);
    }

    // Parse display data from form data
    let displayData;
    try {
      displayData = req.body.displayData ? JSON.parse(req.body.displayData) : {};
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display data format'
      });
    }

    // Update PENDING CHANGE with uploaded images (NOT the live recall)
    const updatedProposedDisplay = {
      ...displayData,
      uploadedImages: [
        ...(displayData.uploadedImages || []),
        ...uploadedImages
      ],
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: req.user.username
    };

    // Update only the pending change document
    const updatedPendingChange = await PendingChangesService.createPendingChange(
      {
        recallId: pendingChange.recallId,
        recallSource: pendingChange.recallSource,
        originalRecall: pendingChange.originalRecall, // Keep existing original recall
        proposedDisplay: updatedProposedDisplay
      },
      {
        uid: req.user.uid,
        username: req.user.username,
        email: req.user.email
      }
    );

    logger.info(`Successfully uploaded ${uploadedImages.length} images for pending change ${pendingChangeId}`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedImages.length} images to pending change`,
      data: {
        uploadedImages,
        pendingChange: updatedPendingChange
      }
    });
  } catch (error) {
    logger.error('Error uploading images to pending change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images'
    });
  }
});

// Get all pending changes (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const pendingChanges = await PendingChangesService.getAllPendingChanges();
    
    res.json({
      success: true,
      data: pendingChanges,
      total: pendingChanges.length
    });
  } catch (error) {
    logger.error('Error fetching pending changes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending changes'
    });
  }
});

// Get pending changes for current user (members and admins)
router.get('/my', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const pendingChanges = await PendingChangesService.getPendingChangesByUser(req.user.uid);
    
    res.json({
      success: true,
      data: pendingChanges,
      total: pendingChanges.length
    });
  } catch (error) {
    logger.error('Error fetching user pending changes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending changes'
    });
  }
});

// Get pending changes for a specific recall
router.get('/recall/:recallId/:source', async (req, res) => {
  try {
    const { recallId, source } = req.params;
    
    if (source !== 'USDA' && source !== 'FDA') {
      return res.status(400).json({
        success: false,
        message: 'Invalid recall source'
      });
    }
    
    const pendingChanges = await PendingChangesService.getPendingChangesByRecall(
      recallId,
      source as 'USDA' | 'FDA'
    );
    
    res.json({
      success: true,
      data: pendingChanges,
      total: pendingChanges.length
    });
  } catch (error) {
    logger.error('Error fetching recall pending changes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending changes'
    });
  }
});

// Get a single pending change
router.get('/:id', async (req, res) => {
  try {
    const pendingChange = await PendingChangesService.getPendingChange(req.params.id);
    
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Pending change not found'
      });
    }
    
    res.json({
      success: true,
      data: pendingChange
    });
  } catch (error) {
    logger.error('Error fetching pending change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending change'
    });
  }
});

// Approve a pending change (admin only)
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const userInfo = {
      uid: req.user.uid,
      username: req.user.username,
      email: req.user.email
    };
    
    await PendingChangesService.approvePendingChange(req.params.id, userInfo);
    
    res.json({
      success: true,
      message: 'Change approved successfully'
    });
  } catch (error) {
    logger.error('Error approving pending change:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to approve change'
    });
  }
});

// Reject a pending change (admin only)
router.put('/:id/reject', requireAdmin, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    const userInfo = {
      uid: req.user.uid,
      username: req.user.username,
      email: req.user.email
    };
    
    await PendingChangesService.rejectPendingChange(req.params.id, userInfo, reason);
    
    res.json({
      success: true,
      message: 'Change rejected successfully'
    });
  } catch (error) {
    logger.error('Error rejecting pending change:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reject change'
    });
  }
});

export default router;