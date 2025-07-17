# Firebase Firestore Index Creation Guide

## Required Indexes for SafeCart

Based on our query patterns, you need to create these composite indexes in Firebase Console:

### 1. State-based Queries with Date Ordering
**Collection:** `recalls`
**Fields:**
- `affectedStatesArray` (Array-contains)
- `field_recall_date` (Descending)

### 2. Recent Recalls with Date Filtering
**Collection:** `recalls`
**Fields:**
- `field_recall_date` (Ascending)

### 3. Risk Level Filtering
**Collection:** `recalls`
**Fields:**
- `riskLevelCategory` (Ascending)
- `field_recall_date` (Descending)

### 4. Duplicate Detection (Recall Number + Language)
**Collection:** `recalls`
**Fields:**
- `field_recall_number` (Ascending)
- `langcode` (Ascending)
**Purpose:** Ensures both English and Spanish versions of recalls can be stored without conflict

## How to Create Indexes

### Method 1: Using Error Links (Recommended)
When you get an index error, Firebase provides a direct link to create the index. Click the link in the error message.

### Method 2: Manual Creation
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: safecart-930e5
3. Go to Firestore Database → Indexes
4. Click "Create Index"
5. Enter the collection name and fields as specified above

### Method 3: Using Firebase CLI (Advanced)
```bash
firebase deploy --only firestore:indexes
```

## Index Status

After creating indexes, they take a few minutes to build. You can monitor progress in the Firebase Console.

## Expected Results

Once indexes are created:
- State-based queries will work (California, Texas, etc.)
- Recent recalls queries will be faster
- Risk level filtering will work efficiently
- All database consistency tests should pass

## Notes

- Indexes are automatically created for single-field queries
- Composite indexes are needed for multi-field queries with ordering
- Each index increases storage costs slightly but improves query performance significantly