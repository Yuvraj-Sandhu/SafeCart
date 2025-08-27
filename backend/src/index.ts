/**
 * SafeCart Backend Server
 * 
 * This is the main entry point for the SafeCart backend application.
 * It sets up:
 * - Express server with CORS and JSON parsing
 * - API routes for recall data
 * - Automatic data synchronization
 * - Error handling and logging
 * - Health check endpoint
 * 
 * The server automatically starts data synchronization on startup in production mode.
 * 
 * Environment Variables:
 * - PORT: Server port (default: 3001)
 * - NODE_ENV: Environment (development/production)
 * - ENABLE_AUTO_SYNC: Enable/disable automatic syncing
 * - SYNC_INTERVAL_HOURS: Hours between sync runs
 * - Firebase configuration variables
 * 
 * @author Yuvraj
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import recallRoutes from './routes/recall.routes';
import fdaRecallRoutes from './routes/fda-recall.routes';
import authRoutes from './routes/auth.routes';
import pendingChangesRoutes from './routes/pending-changes.routes';
import userAuthRoutes from './routes/user-auth.routes';
import userEmailPreferencesRoutes from './routes/user-email-preferences.routes';
import adminEmailRoutes from './routes/admin-email.routes';
import webhookRoutes from './routes/webhook.routes';
import { SyncService } from './services/sync.service';
import logger from './utils/logger';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
const allowedOrigins = [
  'https://localhost:3000',             // Local development
  'https://safecart.vercel.app',        // Vercel production
  process.env.FRONTEND_URL              // Additional custom URL from env
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies
})); // Enable CORS for multiple origins
app.use(cookieParser()); // Parse cookies
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies with increased limit for batch operations
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded request bodies

/**
 * Health check endpoint
 * 
 * Returns basic server status information.
 * Useful for load balancers and monitoring systems.
 * 
 * @route GET /health
 * @returns {object} Server status information
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Mount API routes under /api prefix
app.use('/api/auth', authRoutes);     // Internal auth: /api/auth/*
app.use('/api/user/auth', userAuthRoutes); // Public user auth: /api/user/auth/*
app.use('/api/user', userEmailPreferencesRoutes); // User preferences: /api/user/*
app.use('/api/pending-changes', pendingChangesRoutes); // Pending changes: /api/pending-changes/*
app.use('/api/admin', adminEmailRoutes); // Admin email routes: /api/admin/*
app.use('/api/webhooks', webhookRoutes); // Webhook endpoints: /api/webhooks/*
app.use('/api', recallRoutes);        // USDA recalls: /api/recalls/*
app.use('/api/fda', fdaRecallRoutes); // FDA recalls: /api/fda/recalls/*

/**
 * Global error handling middleware
 * 
 * Catches any unhandled errors and returns a consistent error response.
 * Logs the full error details for debugging while returning a safe message to clients.
 */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

/**
 * Start the Express server
 * 
 * Initializes the server and sets up data synchronization.
 */
app.listen(PORT, () => {
  logger.info(`SafeCart Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API base URL: http://localhost:${PORT}/api`);
  
  // Initialize and start automatic synchronization
  const syncService = new SyncService();
  syncService.startAutoSync();
  syncService.startFDAAutoSync();
  syncService.startUsdaEmailAutoSend();
  
  // Initial sync disabled to avoid startup delays in production
  logger.info('Initial sync disabled - use manual sync endpoints if needed');
});

/**
 * Graceful shutdown handlers
 * 
 * Handles SIGTERM and SIGINT signals to ensure clean shutdown.
 * Important for containerized deployments and development.
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});