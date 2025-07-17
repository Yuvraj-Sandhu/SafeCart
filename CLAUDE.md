# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
SafeCart is designed to help U.S. consumers proactively protect themselves and their families from foodborne illnesses by improving the way food recall information is surfaced, personalized, and delivered.

## Technical Stack
- **Frontend**: Next.js
- **Backend**: Node.js
- **Database**: Firebase
- **Primary Data Source**: USDA FSIS Recall API (confirmed working via api.py test)

## Key Commands

### Current Development (Python API Testing)
```bash
python api.py
pip install requests
```

### Future Development Commands (to be implemented)
```bash
# Frontend (Next.js)
npm run dev
npm run build
npm run lint

# Backend (Node.js)
npm start
npm run dev
```

## Architecture & Engineering Phases

### Phase 1: Foundation - API Access and Data Ingestion
- **Status**: USDA API confirmed working (api.py demonstrates successful access)
- **Key Deliverables**:
  - Build proof-of-concept queries (e.g., California recalls for specific months)
  - Store data and images in Firebase
  - Validate data completeness and stability

### Phase 2: MVP v1 - Internal Web Interface
- Filter capabilities: By State, Date Range, Presets (This Month, Last Month, YTD)
- Historical data backfill: 2+ years of past recalls
- Automation: API sync every 12-24 hours

### Phase 3: MVP v2 - Consumer Notification Testing
- State-level daily recall email summaries
- Include metadata and product photos
- Measure engagement and feedback

### Phase 4: MVP v3 - Zip Code & Store-Level Localization
- Infer store-level exposure using manufacturer/distributor data
- ZIP code matching for regional relevance
- Optional store preferences (e.g., Whole Foods)

### Phase 5: MVP v4 - Personalized Recall Matching
- Tech-savvy users: Amazon/Instacart purchase history integration
- Non-tech users: Receipt photo upload with OCR processing

## API Integration Details

### Base Information
- **USDA API Endpoint**: `https://www.fsis.usda.gov/fsis/api/recall/v/1`
- **Response Format**: JSON array of recall objects
- **Authentication**: None required
- **Headers**: Requires browser-like user-agent to avoid blocking

### Available Query Parameters

| Parameter | Type | Description | Example Value |
|-----------|------|-------------|---------------|
| `field_states_id` | Selection | Filter by affected states | 29 (California), 557 (Nationwide) |
| `field_archive_recall` | Selection | Filter archived recalls | 0 (FALSE), 1 (TRUE), All |
| `field_closed_date_value` | Text | Filter by closed date | YYYY-MM-DD (e.g., 2023-07-18) |
| `field_closed_year_id` | Selection | Filter by closed year | 445 (2023), 444 (2022), etc. |
| `field_risk_level_id` | Selection | Filter by health risk level | 9 (High-Class I), 7 (Low-Class II) |
| `field_processing_id` | Selection | Filter by processing category | 159 (Fully Cooked), 154 (Raw-Intact) |
| `field_product_items_value` | Text | Search in product items | Text search (not exact match) |
| `field_recall_classification_id` | Selection | Filter by classification | 10 (Class I), 11 (Class II) |
| `field_recall_number` | Text | Search by recall number | DDD-YYYY (e.g., 021-2023) |
| `field_recall_reason_id` | Selection | Filter by recall reason | 16 (Product Contamination), 14 (Unreported Allergens) |
| `field_recall_type_id` | Selection | Filter by recall type | 22 (Public Health Alert), 23 (Active Recall) |
| `field_related_to_outbreak` | Selection | Filter outbreak-related | 0 (FALSE), 1 (TRUE) |
| `field_summary_value` | Text | Search in summary text | Text search (not exact match) |
| `field_year_id` | Selection | Filter by issue year | 606 (2024), 445 (2023), etc. |
| `field_translation_language` | Selection | Filter by language | en (English), es (Spanish) |

### Response Object Fields

Each recall object contains:
- `field_title`: Recall title/headline
- `field_active_notice`: Active status ("True"/"False")
- `field_states`: Affected states (comma-separated)
- `field_archive_recall`: Archive status ("True"/"False")
- `field_closed_date`: Date recall was closed (YYYY-MM-DD)
- `field_company_media_contact`: Company contact information
- `field_establishment`: Company/establishment name
- `field_labels`: PDF filename for product labels
- `field_media_contact`: USDA media contact
- `field_risk_level`: Risk classification (e.g., "High -Class I")
- `field_processing`: Processing category
- `field_product_items`: Detailed product descriptions
- `field_recall_classification`: Classification (Class I, II, III)
- `field_recall_date`: Date of recall (YYYY-MM-DD)
- `field_recall_number`: Recall identifier (DDD-YYYY format)
- `field_recall_reason`: Reason for recall
- `field_recall_type`: Type of recall
- `field_related_to_outbreak`: Outbreak relation ("True"/"False")
- `field_summary`: HTML-encoded summary text
- `field_year`: Year of recall
- `langcode`: Language ("English"/"Spanish")
- `field_has_spanish`: Spanish version availability

### Key State IDs for Development
- California: 29
- Texas: 68
- Florida: 33
- New York: 57
- Nationwide: 557

### Example API Calls
```bash
# California recalls for 2023
https://www.fsis.usda.gov/fsis/api/recall/v/1?field_states_id=29&field_year_id=445

# All high-risk recalls
https://www.fsis.usda.gov/fsis/api/recall/v/1?field_risk_level_id=9

# Search for "chicken" in product items
https://www.fsis.usda.gov/fsis/api/recall/v/1?field_product_items_value=chicken
```

## Development Guidelines
- **Incremental Development**: Each milestone validates the next
- **Data-Centric Approach**: Focus on structured, extensible data pipelines
- **User Privacy**: Handle purchase history and personal data securely
- **Error Handling**: Implement robust error handling for API timeouts/failures
- **No Emojis**: Never use emojis in any code files, comments, documentation, or communication

## Completed Features

### Backend Infrastructure
- USDA API integration working (api.py confirmed)
- Firebase data storage configured
- Historical data backfill (1,963+ records)
- Auto-sync every 12 hours configured (now includes image processing)
- Batch processing for large datasets (100 records per batch)
- Duplicate detection with language support (English/Spanish)
- API endpoints: /api/recalls/state, /api/recalls/all, /api/debug/stats, /api/recalls/batch
- Route order fixed for proper endpoint matching
- Express body parser configured for large payloads (50mb limit)
- Field-selective updates to preserve custom data during syncs

### Image Processing System (Implemented)
- Script: `download-recall-images-robust.js` - Downloads and processes recall label images
- Service: `image-processing.service.ts` - TypeScript service for automated image processing
- PDF to PNG conversion using ImageMagick (direct command method)
- Image optimization with Sharp library (resizing, compression)
- Firebase Storage integration for image hosting
- Batch processing with progress tracking
- Windows-compatible cleanup with delayed process
- Supports resuming interrupted processing
- Command: `node download-recall-images-robust.js --limit 2000`
- Automated integration: Every 12-hour sync now processes images for recent recalls
- Deployment considerations: Railway recommended for ImageMagick support

### Frontend Application
- Next.js project with TypeScript and App Router
- Theme system with light/dark mode switching
- Custom color variables defined in theme.ts
- State selection dropdown (all US states + Nationwide)
- Date range picker with presets (This Month, Last Month, YTD, Last 30 Days)
- Recall search and display functionality
- JSON download for individual recalls and bulk export
- Responsive design for mobile/desktop
- API integration with backend health checking
- Centered branding with letter spacing
- Error handling for server connectivity
- Loading states and empty state handling

## Remaining Tasks

### Internal Web Interface Enhancements
- Performance optimization for large result sets
- Additional filter options (risk level, company, recall reason)
- Pagination for large result sets
- Search functionality within results
- Sort options (date, risk level, company)
- Filter by language (English/Spanish)
- Export options (CSV, PDF formats)

### Consumer Notification System
- State-level daily recall email summaries
- Email template design and implementation
- Subscription management system
- Engagement tracking and metrics
- Automated email scheduling

### Zip Code & Store-Level Localization
- ZIP code matching for regional relevance
- Store preference system (Whole Foods, etc.)
- Manufacturer/distributor data integration
- Regional exposure inference system

### Personalized Recall Matching
- Amazon/Instacart purchase history integration
- Receipt photo upload with OCR processing
- Purchase history matching algorithms
- User account and preference management

## Technical Architecture

### Frontend Stack
- Framework: Next.js 14 with App Router
- Language: TypeScript
- Styling: CSS Modules (no Tailwind CSS)
- Theme: Custom theme system with CSS variables
- State Management: React hooks
- API Client: Fetch API with custom service layer

### Backend Stack
- Runtime: Node.js with TypeScript
- Framework: Express.js
- Database: Firebase Firestore
- Authentication: Firebase Admin SDK
- API Source: USDA FSIS Recall API
- Scheduling: node-cron for auto-sync
- Logging: Winston logger
- Image Processing: Sharp (optimization) + ImageMagick (PDF conversion)
- Storage: Firebase Storage for processed images

### Database Schema
- recalls collection (metadata, images, dates, states, language)
  - processedImages: Array of image objects with Firebase Storage URLs
  - imagesProcessedAt: Timestamp when images were processed
  - totalImageCount: Number of successfully stored images
  - hasErrors: Boolean indicating if any image processing failed
  - extractedUrls: Array of original label URLs found in summary
- Compound indexes: field_recall_number + langcode
- State-based queries: affectedStatesArray array-contains
- Date range queries: field_recall_date filtering

## Development Notes

### Known Issues Resolved
- Route order issue causing 404 on /api/recalls/all
- Duplicate detection not considering language (English/Spanish)
- Firebase batch size limits causing timeouts
- USDA API returning duplicate entries for some states
- Express body parser size limits for large payloads
- Windows file locking issues with PDF processing (solved with delayed cleanup)
- EPIPE errors in pdf2pic library (switched to direct ImageMagick commands)
- Sync operations overwriting custom fields like images (fixed with selective field updates)
- Image processing not integrated with auto-sync (now processes recent recalls automatically)

### Theme Customization
- Colors defined in src/styles/theme.ts
- Green-based color scheme with cream/warm backgrounds
- Dark mode with proper contrast ratios
- CSS variables auto-generated for consistent theming

### API Endpoints
- GET /api/recalls/state/:stateCode?limit=N - Get recalls by state
- GET /api/recalls/all?limit=N - Get all recalls
- GET /api/debug/stats - Database statistics
- POST /api/recalls/batch - Batch import recalls
- GET /health - Server health check

## Development Commands

### Backend
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run typecheck    # Type checking
node batch-historical-sync.js  # Manual data sync
node download-recall-images-robust.js --limit 2000  # Process all recall images
node download-recall-images-robust.js --reprocess --limit 100  # Reprocess first 100
```

### Dependencies
```bash
npm install sharp pdf-lib  # Image processing dependencies
```

### Frontend
```bash
cd frontend
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
```

### Testing
```bash
cd backend
node test-api.js     # Run API consistency tests
node diagnose-california-discrepancy.js  # Debug state data
```

## Firebase Schema Considerations
- Recalls collection (metadata, images, dates, states, language)
  - Core USDA fields (field_title, field_recall_number, etc.)
  - Processed fields (affectedStatesArray, isActive, etc.)
  - Image processing fields (processedImages, imagesProcessedAt, etc.)
- Users collection (preferences, subscriptions)
- Notifications collection (sent alerts, engagement tracking)
- Purchase history/receipts (future implementation)
- Firebase Storage structure: recall-images/{recallId}/{filename}

## Auto-Sync Architecture
- Every 12 hours: Fetch recent recalls (last 30 days) from USDA API
- Save/update recall data to Firestore (preserves existing image data)
- Process images for recent recalls that need image processing
- Automatic cleanup of temporary files
- Logging and error handling for production deployment