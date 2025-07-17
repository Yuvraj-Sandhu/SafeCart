# SafeCart Backend Architecture

## Overview

The SafeCart backend is a Node.js/TypeScript application designed to ingest, process, and serve USDA food recall data. It follows a service-oriented architecture with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USDA API      │    │  SafeCart API   │    │   Frontend      │
│                 │    │                 │    │   (Future)      │
│ fsis.usda.gov   │◄──►│   Express.js    │◄──►│   Next.js       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Firebase      │
                       │                 │
                       │   Firestore     │
                       │   + Storage     │
                       │                 │
                       └─────────────────┘
```

## Directory Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── models/           # Data models and schemas
│   │   └── recall.model.ts
│   ├── services/         # Business logic services
│   │   ├── usda-api.service.ts
│   │   ├── firebase.service.ts
│   │   └── sync.service.ts
│   ├── routes/           # API route definitions
│   │   └── recall.routes.ts
│   ├── utils/            # Utility functions
│   │   └── logger.ts
│   └── index.ts          # Application entry point
├── logs/                 # Log files
├── .env                  # Environment variables
└── package.json          # Dependencies and scripts
```

## Core Components

### 1. Data Models (`models/recall.model.ts`)

**Purpose**: Define TypeScript interfaces and Zod schemas for type safety and validation.

**Key Types**:
- `Recall`: Raw data from USDA API
- `ProcessedRecall`: Enhanced data with computed fields
- `RecallSchema`: Zod validation schema

**Features**:
- Runtime validation of API responses
- Type safety throughout the application
- Automatic TypeScript type generation

### 2. USDA API Service (`services/usda-api.service.ts`)

**Purpose**: Handle all interactions with the USDA Food Safety and Inspection Service API.

**Key Features**:
- Axios client with proper headers to avoid blocking
- Request/response logging and error handling
- Data validation using Zod schemas
- Specialized query methods for common use cases

**Important Methods**:
- `fetchRecalls()`: Generic recall fetching with filters
- `fetchCaliforniaRecalls()`: Targeted California data
- `fetchHighRiskRecalls()`: Class I recalls only
- `fetchRecentRecalls()`: Time-based filtering

### 3. Firebase Service (`services/firebase.service.ts`)

**Purpose**: Manage recall data persistence in Firebase Firestore.

**Key Features**:
- Document upsert logic (prevents duplicates)
- Data processing and normalization
- Efficient querying with indexes
- Batch operations for performance

**Data Processing**:
- Parses comma-separated states into arrays
- Converts string booleans to actual booleans
- Categorizes risk levels for easier filtering
- Strips HTML from summary text

### 4. Sync Service (`services/sync.service.ts`)

**Purpose**: Orchestrate data synchronization between USDA API and Firebase.

**Key Features**:
- Scheduled automatic syncing (cron-based)
- Manual sync triggering
- Historical data backfill
- Rate limiting to respect API usage

**Sync Strategy**:
- Recent recalls (last 60 days) for regular updates
- High-risk recalls separately to ensure coverage
- Historical backfill for major states
- Error handling with partial failure recovery

### 5. API Routes (`routes/recall.routes.ts`)

**Purpose**: Define RESTful endpoints for accessing recall data.

**Available Endpoints**:
- `GET /api/recalls/state/:stateCode` - Recalls by state
- `GET /api/recalls/recent` - Recent recalls
- `GET /api/recalls/:id` - Single recall by ID
- `POST /api/sync/trigger` - Manual sync
- `POST /api/sync/historical` - Historical backfill
- `GET /api/test/usda` - API connectivity test

### 6. Logger (`utils/logger.ts`)

**Purpose**: Centralized logging with Winston.

**Features**:
- Environment-based log levels
- File and console output
- Structured JSON logging
- Error stack traces

## Data Flow

### 1. Initial Setup (Historical Sync)
```
Manual Trigger → Sync Service → USDA API → Firebase
                      ↓
              (Years of data for key states)
```

### 2. Regular Sync (Every 12 hours)
```
Cron Schedule → Sync Service → USDA API → Firebase
                     ↓
              (Recent + High-risk recalls)
```

### 3. API Queries
```
Client Request → Express Routes → Firebase Service → Firestore
                      ↓
              (Filtered recall data)
```

## Environment Configuration

### Required Environment Variables

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="your-private-key"

# Server Configuration
PORT=3001
NODE_ENV=development

# USDA API Configuration
USDA_API_BASE_URL=https://www.fsis.usda.gov/fsis/api/recall/v/1
API_REQUEST_TIMEOUT=30000

# Sync Configuration
SYNC_INTERVAL_HOURS=12
ENABLE_AUTO_SYNC=true
```

## Database Schema (Firestore)

### Collection: `recalls`

**Document Structure**:
```typescript
{
  // Original USDA fields
  field_title: string;
  field_recall_number: string;
  field_recall_date: string;
  field_states: string;
  field_risk_level: string;
  // ... other USDA fields
  
  // Processed fields
  id: string;
  fetchedAt: Date;
  affectedStatesArray: string[];
  isActive: boolean;
  riskLevelCategory: 'high' | 'medium' | 'low';
  processedSummary: string;
  
  // Firestore metadata
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}
```

**Indexes**:
- `field_recall_number` (for deduplication)
- `field_recall_date` (for time-based queries)
- `affectedStatesArray` (for state filtering)
- `riskLevelCategory` (for risk filtering)

## Error Handling Strategy

### 1. Service Level
- Try-catch blocks in all async methods
- Specific error types for different failure modes
- Graceful degradation (partial failures don't stop batch operations)

### 2. API Level
- Global error middleware
- Consistent error response format
- HTTP status codes matching error types

### 3. Data Level
- Zod validation for all external data
- Type guards for runtime safety
- Fallback values for optional fields

## Performance Considerations

### 1. API Efficiency
- Request timeouts to prevent hanging
- Rate limiting to respect USDA API
- Batch operations for multiple records

### 2. Database Optimization
- Composite indexes for common queries
- Document size limits (Firestore 1MB limit)
- Efficient upsert operations

### 3. Memory Management
- Streaming for large datasets
- Proper error cleanup
- Connection pooling

## Security Considerations

### 1. Environment Variables
- Sensitive data in `.env` files
- No hardcoded credentials
- Firebase private key proper formatting

### 2. Input Validation
- Zod schemas for all external input
- Parameter sanitization
- Rate limiting on endpoints

### 3. Access Control
- Firebase security rules (future)
- API key authentication (future)
- CORS configuration

## Monitoring and Logging

### 1. Application Logs
- Structured JSON logging
- Error stack traces
- Performance metrics

### 2. Sync Monitoring
- Success/failure rates
- Data freshness tracking
- API response times

### 3. Health Checks
- `/health` endpoint
- Database connectivity
- External API status

## Future Enhancements

### 1. Image Processing
- Download product images from USDA
- Store in Firebase Storage
- Generate thumbnails

### 2. Data Enrichment
- Geocoding for store locations
- Product categorization
- Sentiment analysis of recalls

### 3. Performance Optimization
- Caching layer (Redis)
- Database indexing optimization
- API response compression

## Testing Strategy

### 1. Unit Tests
- Service method testing
- Data transformation logic
- Error handling scenarios

### 2. Integration Tests
- USDA API connectivity
- Firebase operations
- End-to-end data flow

### 3. Performance Tests
- Load testing for sync operations
- API response time benchmarks
- Database query optimization

## Deployment

### 1. Development
```bash
npm run dev  # Watch mode with hot reload
```

### 2. Production
```bash
npm run build  # TypeScript compilation
npm start      # Production server
```

### 3. Environment Setup
- Firebase project creation
- Environment variable configuration
- Log directory creation

This architecture provides a solid foundation for Phase 1 of SafeCart while being extensible for future phases involving user notifications, store localization, and purchase history integration.