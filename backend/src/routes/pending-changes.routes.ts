import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { PendingChangesService } from '../services/pending-changes.service';
import { CreatePendingChangeRequest } from '../types/pending-changes.types';
import logger from '../utils/logger';

const router = Router();

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