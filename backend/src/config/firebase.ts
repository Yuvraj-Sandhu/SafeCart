import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let isInitialized = false;

export function initializeFirebase() {
  if (isInitialized || admin.apps.length > 0) {
    return;
  }

  // Check required environment variables
  const requiredVars = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      throw new Error(`${key} is not set in environment variables`);
    }
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: requiredVars.FIREBASE_PROJECT_ID,
        clientEmail: requiredVars.FIREBASE_CLIENT_EMAIL,
        privateKey: requiredVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }),
      storageBucket: requiredVars.FIREBASE_STORAGE_BUCKET
    });

    isInitialized = true;
    console.log('Firebase initialized successfully with storage bucket:', requiredVars.FIREBASE_STORAGE_BUCKET);
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

// Initialize Firebase immediately when this module is imported
initializeFirebase();