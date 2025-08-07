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

// Helper function to recursively remove undefined values
function removeUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = removeUndefinedValues(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  return obj;
}

export class PendingChangesService {
  // Get all pending recall IDs for filtering
  static async getPendingRecallIds(): Promise<Set<string>> {
    const pendingSnapshot = await db.collection(PENDING_CHANGES_COLLECTION)
      .where('status', '==', 'pending')
      .select('recallId', 'recallSource')
      .get();

    const pendingIds = new Set<string>();
    pendingSnapshot.forEach(doc => {
      const data = doc.data();
      // Create a composite key of recallId and source for unique identification
      pendingIds.add(`${data.recallId}_${data.recallSource}`);
    });

    return pendingIds;
  }

  // Create or update a pending change (overwrites existing pending change for same recall from any user)
  static async createPendingChange(
    data: CreatePendingChangeRequest,
    proposedBy: UserInfo
  ): Promise<PendingChange> {
    // Check if there's already a pending change for this recall from any user
    const existingSnapshot = await db.collection(PENDING_CHANGES_COLLECTION)
      .where('recallId', '==', data.recallId)
      .where('recallSource', '==', data.recallSource)
      .where('status', '==', 'pending')
      .get();
    
    let pendingChangeRef;
    let pendingChangeId;
    
    if (!existingSnapshot.empty) {
      // Update existing pending change
      const existingDoc = existingSnapshot.docs[0];
      pendingChangeRef = existingDoc.ref;
      pendingChangeId = existingDoc.id;
      
      // Clean up old uploaded images that are not in the new proposed display
      const existingData = existingDoc.data() as PendingChange;
      const oldUploadedImages = existingData.proposedDisplay?.uploadedImages || [];
      const newUploadedImages = data.proposedDisplay?.uploadedImages || [];
      
      // Find images that were removed
      const imagesToDelete = oldUploadedImages.filter(oldImg => 
        !newUploadedImages.some(newImg => newImg.filename === oldImg.filename)
      );
      
      // Delete removed images from storage
      if (imagesToDelete.length > 0) {
        const deletePromises = imagesToDelete.map(async (img) => {
          try {
            const path = data.recallSource === 'USDA' 
              ? `recall-images/${data.recallId}/${img.filename}`
              : `fda-recall-images/${data.recallId}/${img.filename}`;
            
            const bucket = storage.bucket();
            const file = bucket.file(path);
            await file.delete();
          } catch (error) {
            console.error(`Failed to delete old image ${img.filename}:`, error);
          }
        });
        
        await Promise.all(deletePromises);
      }
    } else {
      // Create new pending change
      pendingChangeRef = db.collection(PENDING_CHANGES_COLLECTION).doc();
      pendingChangeId = pendingChangeRef.id;
    }
    
    let pendingChange: any;
    
    if (!existingSnapshot.empty) {
      // Update existing pending change - overwrite with new user's changes
      const existingData = existingSnapshot.docs[0].data() as PendingChange;
      
      // Log when overwriting changes from a different user
      if (existingData.proposedBy.uid !== proposedBy.uid) {
        console.log(`Overwriting pending change for recall ${data.recallId} from ${existingData.proposedBy.username} with changes from ${proposedBy.username}`);
      }
      
      pendingChange = {
        ...existingData, // Keep existing data
        id: pendingChangeId,
        proposedBy, // Update to the new user who made the changes
        proposedAt: new Date().toISOString(), // Update timestamp
        proposedDisplay: data.proposedDisplay // Update only the proposed display
        // DON'T update originalRecall - keep the existing one
      };
    } else {
      // Create new pending change with full data
      pendingChange = {
        id: pendingChangeId,
        recallId: data.recallId,
        recallSource: data.recallSource,
        proposedBy,
        proposedAt: new Date().toISOString(),
        status: 'pending',
        originalRecall: data.originalRecall, // Store full recall data
        proposedDisplay: data.proposedDisplay
      };
    }
    
    // Remove all undefined values recursively before saving to Firestore
    const cleanedPendingChange = removeUndefinedValues(pendingChange);
    
    await pendingChangeRef.set(cleanedPendingChange);
    
    return cleanedPendingChange;
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
    _rejectedBy: UserInfo
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

  // Withdraw a pending change (members can withdraw their own changes)
  static async withdrawPendingChange(
    changeId: string,
    withdrawnBy: UserInfo
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
    
    // Check if the user is the original proposer (members can only withdraw their own changes)
    if (pendingChange.proposedBy.uid !== withdrawnBy.uid) {
      throw new Error('You can only withdraw your own pending changes');
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