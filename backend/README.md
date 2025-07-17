# SafeCart Backend

Backend service for SafeCart - USDA food recall data ingestion and API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase:
   - Create a Firebase project
   - Enable Firestore Database
   - Enable Storage
   - Generate a service account key
   - Copy `.env.example` to `.env` and fill in your Firebase credentials

3. Configure environment variables in `.env`:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="your-private-key"
PORT=3001
```

## Development

```bash
npm run dev
```

## API Endpoints

### Get Recalls by State
```
GET /api/recalls/state/:stateCode?limit=100
```

### Get Recent Recalls
```
GET /api/recalls/recent?days=30&limit=100
```

### Get Recall by ID
```
GET /api/recalls/:id
```

### Trigger Manual Sync
```
POST /api/sync/trigger
```

### Trigger Historical Sync
```
POST /api/sync/historical
Body: { "years": 2 }
```

### Test USDA API Connection
```
GET /api/test/usda
```

## Building for Production

```bash
npm run build
npm start
```