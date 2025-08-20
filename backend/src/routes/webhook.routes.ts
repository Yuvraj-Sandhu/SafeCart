/**
 * Webhook Routes
 * 
 * Handles incoming webhooks from external services like Mailchimp
 * 
 * @author Yuvraj
 */

import { Router, Request, Response } from 'express';
import { emailWebhookService } from '../services/email/webhook.service';
import { MailchimpWebhookPayload } from '../types/email-analytics.types';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/webhooks/mailchimp
 * 
 * Processes Mailchimp webhook events for email analytics tracking
 * 
 * This endpoint receives webhook events from Mailchimp when email
 * events occur (delivered, opened, clicked, bounced, etc.)
 */
router.post('/mailchimp', async (req: Request, res: Response) => {
  try {
    // Extract webhook signature for validation
    const signature = req.headers['x-mailchimp-signature'] as string;
    
    // Log webhook received (but not the full payload for privacy)
    logger.info('Mailchimp webhook received', {
      type: req.body.type,
      timestamp: req.body.fired_at,
      hasSignature: !!signature
    });

    // Validate payload structure
    if (!req.body || typeof req.body !== 'object') {
      logger.warn('Invalid webhook payload received');
      return res.status(400).json({
        success: false,
        error: 'Invalid payload'
      });
    }

    const payload = req.body as MailchimpWebhookPayload;

    // Process the webhook
    const result = await emailWebhookService.processWebhook(payload, signature);

    if (!result.success) {
      logger.error('Webhook processing failed:', result.error);
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Send success response
    res.json({
      success: true,
      processed: result.processed
    });

  } catch (error) {
    logger.error('Error in Mailchimp webhook handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/webhooks/mailchimp/test
 * 
 * Test endpoint to verify webhook configuration
 * Mailchimp may send GET requests to verify the webhook URL is valid
 */
router.get('/mailchimp/test', (req: Request, res: Response) => {
  logger.info('Mailchimp webhook test request received');
  res.json({
    success: true,
    message: 'SafeCart webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/webhooks/mailchimp/analytics/:digestId
 * 
 * Get analytics for a specific digest (admin only)
 */
router.get('/mailchimp/analytics/:digestId', async (req: Request, res: Response) => {
  try {
    const { digestId } = req.params;

    if (!digestId) {
      return res.status(400).json({
        success: false,
        error: 'Digest ID is required'
      });
    }

    const analytics = await emailWebhookService.getDigestAnalytics(digestId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No analytics found for this digest'
      });
    }

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error fetching digest analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

export default router;