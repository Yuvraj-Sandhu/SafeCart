/**
 * Admin Email Routes
 * 
 * API endpoints for managing email queues, digests, and history.
 * Admin-only routes for the email dashboard functionality.
 * 
 * @author Yuvraj
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { emailQueueService } from '../services/email/queue.service';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/admin/queues
 * Get both queue statuses (USDA and FDA)
 */
router.get('/queues', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const queues = await emailQueueService.getQueues();
    res.json({
      success: true,
      data: queues
    });
  } catch (error) {
    logger.error('Error fetching queues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queues'
    });
  }
});

/**
 * GET /api/admin/queues/:type/preview
 * Get queue preview with full recall details
 */
router.get('/queues/:type/preview', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (type !== 'USDA_DAILY' && type !== 'FDA_WEEKLY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue type'
      });
    }

    const preview = await emailQueueService.getQueuePreview(type);
    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    logger.error('Error fetching queue preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue preview'
    });
  }
});

/**
 * GET /api/admin/queues/:type/email-preview
 * Generate email HTML preview for queue
 */
router.get('/queues/:type/email-preview', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (type !== 'USDA_DAILY' && type !== 'FDA_WEEKLY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue type'
      });
    }

    // Get queue preview data
    const preview = await emailQueueService.getQueuePreview(type);
    
    // Generate email HTML with ALL recalls (no state filtering for admin preview)
    const digestData = {
      user: {
        name: 'Admin Preview',
        email: 'admin@safecart.app',
        unsubscribeToken: 'admin-preview-token'
      },
      state: 'ALL', // Show all recalls regardless of state
      recalls: preview.recalls, // All recalls in queue
      digestDate: new Date().toISOString(),
      isTest: true,
      isAdminPreview: true // Flag to indicate this is admin preview
    };

    const { EmailRenderService } = require('../services/email/render.service');
    const emailOptions = await EmailRenderService.renderRecallDigest(digestData);
    
    // Create digest object compatible with EmailPreviewModal
    const digestPreview = {
      id: `preview_${Date.now()}`,
      type: type === 'USDA_DAILY' ? 'usda_daily' : 'fda_weekly',
      sentAt: new Date(),
      sentBy: 'Admin Preview (All States)',
      recallCount: preview.recalls.length,
      totalRecipients: 0, // Preview only - shows all recalls regardless of state
      recalls: preview.recalls.map((r: any) => ({
        id: r.id,
        title: r.title,
        source: r.source
      })),
      emailHtml: emailOptions.html
    };

    res.json({
      success: true,
      data: digestPreview
    });
  } catch (error) {
    logger.error('Error generating email preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate email preview'
    });
  }
});

/**
 * PUT /api/admin/queues/:type
 * Update queue (remove recalls)
 */
router.put('/queues/:type', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { recallIds } = req.body;
    
    if (type !== 'USDA_DAILY' && type !== 'FDA_WEEKLY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue type'
      });
    }

    if (!Array.isArray(recallIds)) {
      return res.status(400).json({
        success: false,
        message: 'recallIds must be an array'
      });
    }

    await emailQueueService.updateQueue(type, recallIds);
    res.json({
      success: true,
      message: 'Queue updated successfully'
    });
  } catch (error) {
    logger.error('Error updating queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update queue'
    });
  }
});

/**
 * POST /api/admin/queues/:type/send
 * Send queue manually
 */
router.post('/queues/:type/send', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { testMode } = req.body;
    const sentBy = (req as any).user?.email || 'admin';
    
    if (type !== 'USDA_DAILY' && type !== 'FDA_WEEKLY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue type'
      });
    }

    if (testMode) {
      // TODO: Implement test mode sending
      return res.status(501).json({
        success: false,
        message: 'Test mode not implemented yet'
      });
    }

    const digestRecord = await emailQueueService.sendQueue(type, sentBy);
    res.json({
      success: true,
      message: 'Queue sent successfully',
      data: digestRecord
    });
  } catch (error) {
    logger.error('Error sending queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send queue'
    });
  }
});

/**
 * DELETE /api/admin/queues/:type
 * Cancel/delete queue
 */
router.delete('/queues/:type', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (type !== 'USDA_DAILY' && type !== 'FDA_WEEKLY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid queue type'
      });
    }

    await emailQueueService.cancelQueue(type);
    res.json({
      success: true,
      message: 'Queue cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel queue'
    });
  }
});

/**
 * POST /api/admin/digest/test
 * Send test email to admin
 */
router.post('/digest/test', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { recallIds } = req.body;
    const adminEmail = (req as any).user?.email;
    
    if (!Array.isArray(recallIds) || recallIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recallIds must be a non-empty array'
      });
    }

    // TODO: Implement test email sending to admin only
    res.status(501).json({
      success: false,
      message: 'Test email sending not implemented yet'
    });
  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

/**
 * POST /api/admin/digest/send
 * Send manual digest to all subscribers
 */
router.post('/digest/send', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { recallIds } = req.body;
    const sentBy = (req as any).user?.email || 'admin';
    
    if (!Array.isArray(recallIds) || recallIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recallIds must be a non-empty array'
      });
    }

    const digestRecord = await emailQueueService.sendManualDigest(recallIds, sentBy);
    res.json({
      success: true,
      message: 'Manual digest sent successfully',
      data: digestRecord
    });
  } catch (error) {
    logger.error('Error sending manual digest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send manual digest'
    });
  }
});

/**
 * GET /api/admin/email-history
 * Get paginated email history
 */
router.get('/email-history', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    const history = await emailQueueService.getEmailHistory(page, limit);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error fetching email history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email history'
    });
  }
});

/**
 * POST /api/admin/queues/:type/auto-send
 * Automatic sending endpoint for Cloud Scheduler (USDA only)
 */
router.post('/queues/:type/auto-send', async (req: Request, res: Response) => {
  try {
    // Verify this is from Cloud Scheduler (optional - add authentication if needed)
    const { type } = req.params;
    
    if (type !== 'USDA_DAILY') {
      return res.status(400).json({
        success: false,
        message: 'Auto-send only available for USDA_DAILY'
      });
    }

    const digestRecord = await emailQueueService.sendQueue(type, 'system');
    res.json({
      success: true,
      message: 'USDA daily digest sent automatically',
      data: digestRecord
    });
  } catch (error) {
    logger.error('Error in auto-send:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-send USDA daily digest'
    });
  }
});

export default router;