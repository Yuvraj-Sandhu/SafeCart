import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { PendingChange, CreatePendingChangeRequest } from '../types/pending-changes.types';
import { DisplayData } from '../types/display.types';
import { UserInfo } from '../types/user.types';
import { FirebaseService } from './firebase.service';
import { FDAFirebaseService } from './fda/firebase.service';

// Load environment variables
dotenv.config();

// Initialize Firebase if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
const storage = admin.storage();

const PENDING_CHANGES_COLLECTION = 'pending_changes';

export class PendingChangesService {
  // Create a new pending change
  static async createPendingChange(
    data: CreatePendingChangeRequest,
    proposedBy: UserInfo
  ): Promise<PendingChange> {
    const pendingChangeRef = db.collection(PENDING_CHANGES_COLLECTION).doc();
    
    const pendingChange: PendingChange = {
      id: pendingChangeRef.id,
      recallId: data.recallId,
      recallSource: data.recallSource,
      proposedBy,
      proposedAt: new Date().toISOString(),
      status: 'pending',
      currentDisplay: data.currentDisplay,
      proposedDisplay: data.proposedDisplay
    };
    
    await pendingChangeRef.set(pendingChange);
    
    return pendingChange;
  }

  // Get pending changes for a specific recall
  static async getPendingChangesByRecall(
    recallId: string,
    recallSource: 'USDA' | 'FDA'
  ): Promise<PendingChange[]> {
    const snapshot = await db.collection(PENDING_CHANGES_COLLECTION)
      .where('recallId', '==', recallId)
      .where('recallSource', '==', recallSource)
      .where('status', '==', 'pending')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as PendingChange);
  }

  // Get all pending changes (for admin)
  static async getAllPendingChanges(): Promise<PendingChange[]> {
    const snapshot = await db.collection(PENDING_CHANGES_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('proposedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as PendingChange);
  }

  // Get pending changes by user
  static async getPendingChangesByUser(userId: string): Promise<PendingChange[]> {
    const snapshot = await db.collection(PENDING_CHANGES_COLLECTION)
      .where('proposedBy.uid', '==', userId)
      .orderBy('proposedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as PendingChange);
  }

  // Approve a pending change
  static async approvePendingChange(
    changeId: string,
    approvedBy: UserInfo
  ): Promise<void> {
    // Get the pending change
    const pendingChangeDoc = await db.collection(PENDING_CHANGES_COLLECTION)
      .doc(changeId)
      .get();
    
    if (!pendingChangeDoc.exists) {
      throw new Error('Pending change not found');
    }
    
    const pendingChange = pendingChangeDoc.data() as PendingChange;
    
    if (pendingChange.status !== 'pending') {
      throw new Error('Change is not pending');
    }
    
    // Add audit information to the display data
    const approvedDisplay: DisplayData = {
      ...pendingChange.proposedDisplay,
      proposedBy: pendingChange.proposedBy,
      proposedAt: pendingChange.proposedAt,
      approvedBy,
      approvedAt: new Date().toISOString()
    };
    
    // Update the recall with approved display
    if (pendingChange.recallSource === 'USDA') {
      const firebaseService = new FirebaseService();
      await firebaseService.updateRecallDisplay(pendingChange.recallId, approvedDisplay);
    } else {
      const fdaFirebaseService = new FDAFirebaseService();
      await fdaFirebaseService.updateRecallDisplay(pendingChange.recallId, approvedDisplay);
    }
    
    // Delete the pending change
    await db.collection(PENDING_CHANGES_COLLECTION).doc(changeId).delete();
  }

  // Reject a pending change
  static async rejectPendingChange(
    changeId: string,
    _rejectedBy: UserInfo,
    _reason: string
  ): Promise<void> {
    // Get the pending change
    const pendingChangeDoc = await db.collection(PENDING_CHANGES_COLLECTION)
      .doc(changeId)
      .get();
    
    if (!pendingChangeDoc.exists) {
      throw new Error('Pending change not found');
    }
    
    const pendingChange = pendingChangeDoc.data() as PendingChange;
    
    if (pendingChange.status !== 'pending') {
      throw new Error('Change is not pending');
    }
    
    // Delete uploaded images if any
    if (pendingChange.proposedDisplay?.uploadedImages) {
      const deletePromises = pendingChange.proposedDisplay.uploadedImages.map(async (img) => {
        try {
          const path = pendingChange.recallSource === 'USDA' 
            ? `recall-images/${pendingChange.recallId}/${img.filename}`
            : `fda-recall-images/${pendingChange.recallId}/${img.filename}`;
          
          const bucket = storage.bucket();
          const file = bucket.file(path);
          await file.delete();
        } catch (error) {
          console.error(`Failed to delete image ${img.filename}:`, error);
        }
      });
      
      await Promise.all(deletePromises);
    }
    
    // Delete the pending change
    await db.collection(PENDING_CHANGES_COLLECTION).doc(changeId).delete();
  }

  // Get a single pending change
  static async getPendingChange(changeId: string): Promise<PendingChange | null> {
    const doc = await db.collection(PENDING_CHANGES_COLLECTION).doc(changeId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as PendingChange;
  }
}