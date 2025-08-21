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
    // Extract webhook signature for validation - Mailchimp uses X-Mandrill-Signature header
    const signature = req.headers['x-mandrill-signature'] as string;
    
    // Log webhook received (but not the full payload for privacy)
    logger.info('Mailchimp webhook received', {
      hasSignature: !!signature,
      headers: Object.keys(req.headers), // Log all headers to debug
      bodyKeys: Object.keys(req.body || {})
    });

    // Mandrill sends events in a 'mandrill_events' parameter as a JSON string
    const eventsParam = req.body?.mandrill_events;
    if (!eventsParam) {
      logger.warn('No mandrill_events parameter in webhook payload');
      // This might be a validation request from Mailchimp
      return res.status(200).send('OK');
    }

    // Validate Mandrill signature if provided
    if (signature) {
      // Construct the full webhook URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers.host || 'safecart-backend-984543935964.europe-west1.run.app';
      const webhookUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
      
      // Validate signature using the raw POST parameters
      const isValid = emailWebhookService.validateMandrillSignature(
        webhookUrl,
        req.body,
        signature
      );

      if (!isValid) {
        logger.warn('Invalid Mandrill webhook signature');
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    }

    // Parse the events JSON string
    let events: any[];
    try {
      events = typeof eventsParam === 'string' ? JSON.parse(eventsParam) : eventsParam;
    } catch (parseError) {
      logger.error('Failed to parse mandrill_events:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid events format'
      });
    }

    logger.info(`Processing ${events.length} Mandrill events`);

    // Process each event
    let processedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      // Log event structure for debugging
      logger.info('Processing Mandrill event:', {
        event: event.event,
        email: event.msg?.email || event.email,
        ts: event.ts,
        _id: event._id
      });

      const payload = {
        type: event.event,
        fired_at: new Date(event.ts * 1000).toISOString(), // Convert Unix timestamp
        data: {
          id: event._id,
          email: event.msg?.email || event.email,
          email_address: event.msg?.email || event.email,
          ...event.msg
        }
      } as MailchimpWebhookPayload;

      // Don't pass signature to processWebhook since we already validated
      const result = await emailWebhookService.processWebhook(payload);
      
      if (result.success && result.processed) {
        processedCount++;
      } else {
        failedCount++;
        logger.warn('Failed to process event:', { event: event.event, error: result.error });
      }
    }

    logger.info(`Processed ${processedCount} events, ${failedCount} failed`);

    // Send success response
    res.json({
      success: true,
      processed: processedCount,
      failed: failedCount
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