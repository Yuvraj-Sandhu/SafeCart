import * as admin from 'firebase-admin';
import { FDARecall, FDAQueryOptions } from '../../types/fda.types';
import logger from '../../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const FDA_RECALLS_COLLECTION = 'fda_recalls';

export class FDAFirebaseService {
  /**
   * Get FDA recalls by state
   */
  async getRecallsByState(stateCode: string, options: FDAQueryOptions = {}): Promise<FDARecall[]> {
    try {
      const { limit = 5000, startDate, endDate } = options;
      
      // Get state-specific recalls
      let stateQuery = db.collection(FDA_RECALLS_COLLECTION)
        .where('affectedStatesArray', 'array-contains', stateCode)
        .orderBy('report_date', 'desc');

      // Apply date filters if provided
      if (startDate) {
        const startDateStr = this.formatDateToYYYYMMDD(startDate);
        stateQuery = stateQuery.where('report_date', '>=', startDateStr);
      }
      
      if (endDate) {
        const endDateStr = this.formatDateToYYYYMMDD(endDate);
        stateQuery = stateQuery.where('report_date', '<=', endDateStr);
      }

      stateQuery = stateQuery.limit(limit);
      const stateSnapshot = await stateQuery.get();

      // Get nationwide recalls (only if not already requesting "Nationwide")
      let nationwideSnapshot;
      if (stateCode.toLowerCase() !== 'nationwide') {
        let nationwideQuery = db.collection(FDA_RECALLS_COLLECTION)
          .where('affectedStatesArray', 'array-contains', 'Nationwide')
          .orderBy('report_date', 'desc');

        // Apply same date filters to nationwide query
        if (startDate) {
          const startDateStr = this.formatDateToYYYYMMDD(startDate);
          nationwideQuery = nationwideQuery.where('report_date', '>=', startDateStr);
        }
        
        if (endDate) {
          const endDateStr = this.formatDateToYYYYMMDD(endDate);
          nationwideQuery = nationwideQuery.where('report_date', '<=', endDateStr);
        }

        nationwideQuery = nationwideQuery.limit(limit);
        nationwideSnapshot = await nationwideQuery.get();
      }

      // Combine results
      const stateRecalls: FDARecall[] = [];
      stateSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        stateRecalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      const nationwideRecalls: FDARecall[] = [];
      if (nationwideSnapshot) {
        nationwideSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
          nationwideRecalls.push({
            id: doc.id,
            ...doc.data()
          } as FDARecall);
        });
      }

      // Merge and remove duplicates (in case a recall affects both the state and is marked nationwide)
      const allRecalls = [...stateRecalls, ...nationwideRecalls];
      const uniqueRecalls = allRecalls.filter((recall, index, self) => 
        index === self.findIndex(r => r.id === recall.id)
      );

      // Sort by date and limit results
      const sortedRecalls = uniqueRecalls
        .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
        .slice(0, limit);

      return sortedRecalls;
    } catch (error) {
      logger.error('Error fetching FDA recalls by state:', error);
      throw error;
    }
  }

  /**
   * Get all FDA recalls
   */
  async getAllRecalls(options: FDAQueryOptions = {}): Promise<FDARecall[]> {
    try {
      const { limit = 10000, startDate, endDate } = options;
      
      let query = db.collection(FDA_RECALLS_COLLECTION)
        .orderBy('report_date', 'desc');

      // Apply date filters if provided
      if (startDate) {
        const startDateStr = this.formatDateToYYYYMMDD(startDate);
        query = query.where('report_date', '>=', startDateStr);
      }
      
      if (endDate) {
        const endDateStr = this.formatDateToYYYYMMDD(endDate);
        query = query.where('report_date', '<=', endDateStr);
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      
      const recalls: FDARecall[] = [];
      snapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        recalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      return recalls;
    } catch (error) {
      logger.error('Error fetching all FDA recalls:', error);
      throw error;
    }
  }

  /**
   * Get a single FDA recall by ID
   */
  async getRecallById(recallId: string): Promise<FDARecall | null> {
    try {
      const doc = await db.collection(FDA_RECALLS_COLLECTION).doc(recallId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      } as FDARecall;
    } catch (error) {
      logger.error('Error fetching FDA recall by ID:', error);
      throw error;
    }
  }

  /**
   * Get FDA recalls by date range
   */
  async getRecallsByDateRange(startDate: Date, endDate: Date, limit: number = 5000): Promise<FDARecall[]> {
    try {
      const startDateStr = this.formatDateToYYYYMMDD(startDate);
      const endDateStr = this.formatDateToYYYYMMDD(endDate);
      
      const query = db.collection(FDA_RECALLS_COLLECTION)
        .where('report_date', '>=', startDateStr)
        .where('report_date', '<=', endDateStr)
        .orderBy('report_date', 'desc')
        .limit(limit);

      const snapshot = await query.get();
      
      const recalls: FDARecall[] = [];
      snapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        recalls.push({
          id: doc.id,
          ...doc.data()
        } as FDARecall);
      });

      return recalls;
    } catch (error) {
      logger.error('Error fetching FDA recalls by date range:', error);
      throw error;
    }
  }

  /**
   * Update FDA recall display data (for internal editing)
   */
  async updateRecallDisplay(recallId: string, displayData: any): Promise<void> {
    try {
      const updateData: any = {
        display: displayData,
        lastUpdated: new Date().toISOString()
      };

      if (displayData === undefined) {
        // Remove display field completely
        const FieldValue = require('firebase-admin').firestore.FieldValue;
        updateData.display = FieldValue.delete();
      }

      await db.collection(FDA_RECALLS_COLLECTION).doc(recallId).update(updateData);
      logger.info(`Updated FDA recall display data for ID: ${recallId}`);
    } catch (error) {
      logger.error('Error updating FDA recall display:', error);
      throw error;
    }
  }

  /**
   * Get database statistics for FDA recalls
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const snapshot = await db.collection(FDA_RECALLS_COLLECTION).get();
      const totalRecalls = snapshot.size;

      // Get date range
      const recalls: FDARecall[] = [];
      snapshot.forEach(doc => {
        recalls.push(doc.data() as FDARecall);
      });

      const dates = recalls
        .map(r => r.report_date)
        .filter(d => d)
        .sort();

      const stats = {
        collection: FDA_RECALLS_COLLECTION,
        totalRecalls,
        dateRange: {
          earliest: dates[0] || null,
          latest: dates[dates.length - 1] || null
        },
        lastUpdated: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      logger.error('Error getting FDA database stats:', error);
      throw error;
    }
  }

  /**
   * Format date to YYYYMMDD string for FDA date fields
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

// Export singleton instance
export const fdaFirebaseService = new FDAFirebaseService();