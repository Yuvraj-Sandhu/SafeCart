/**
 * Winston logger configuration for SafeCart Backend
 * 
 * This logger provides structured logging with:
 * - Different log levels (debug, info, warn, error)
 * - JSON format for production parsing
 * - Colorized console output for development
 * - File logging for error tracking
 * - Timestamp and error stack traces
 * 
 * Log Levels:
 * - debug: Detailed debug information (development only)
 * - info: General application flow information
 * - warn: Warning conditions that don't halt execution
 * - error: Error conditions that need attention
 * 
 * File Outputs:
 * - logs/error.log: Error level and above
 * - logs/combined.log: All log levels
 * 
 * @example
 * ```typescript
 * import logger from './utils/logger';
 * 
 * logger.info('Application started');
 * logger.error('Database connection failed', { error: err });
 * ```
 */

import winston from 'winston';

const logger = winston.createLogger({
  // Set log level based on environment
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Log format configuration
  format: winston.format.combine(
    winston.format.timestamp(), // Add timestamp to all logs
    winston.format.errors({ stack: true }), // Include stack traces for errors
    winston.format.json() // JSON format for structured logging
  ),
  transports: [
    // Console output with colors for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colors for readability
        winston.format.simple() // Simple format for console
      )
    }),
    // File logging for errors only
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    // File logging for all levels
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

export default logger;