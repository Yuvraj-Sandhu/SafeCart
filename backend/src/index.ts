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
import dotenv from 'dotenv';
import recallRoutes from './routes/recall.routes';
import fdaRecallRoutes from './routes/fda-recall.routes';
import { SyncService } from './services/sync.service';
import logger from './utils/logger';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(cors()); // Enable CORS for all routes
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
 * In production mode, performs an initial sync on startup.
 */
app.listen(PORT, () => {
  logger.info(`SafeCart Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API base URL: http://localhost:${PORT}/api`);
  
  // Initialize and start automatic synchronization
  const syncService = new SyncService();
  syncService.startAutoSync();
  
  // Perform initial sync in production to ensure fresh data
  if (process.env.NODE_ENV === 'production') {
    logger.info('Performing initial sync...');
    syncService.performSync().catch(error => {
      logger.error('Initial sync failed:', error);
    });
  } else {
    logger.info('Development mode - skipping initial sync');
  }
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