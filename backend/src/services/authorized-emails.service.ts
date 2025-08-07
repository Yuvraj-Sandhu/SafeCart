import * as admin from 'firebase-admin';
import logger from '../utils/logger';

const AUTHORIZED_EMAILS_COLLECTION = 'authorized_emails';

export interface AuthorizedEmail {
  email: string;
  role: 'member' | 'admin';
  addedBy?: string;
  addedAt?: any; // Firestore timestamp
  isActive: boolean;
}

export class AuthorizedEmailsService {
  private db = admin.firestore();

  /**
   * Check if an email is authorized and get its role
   */
  async checkAuthorization(email: string): Promise<{ authorized: boolean; role?: 'member' | 'admin' }> {
    try {
      const doc = await this.db
        .collection(AUTHORIZED_EMAILS_COLLECTION)
        .doc(email.toLowerCase())
        .get();

      if (!doc.exists) {
        return { authorized: false };
      }

      const data = doc.data() as AuthorizedEmail;
      
      if (!data.isActive) {
        return { authorized: false };
      }

      return {
        authorized: true,
        role: data.role
      };
    } catch (error) {
      logger.error('Error checking email authorization:', error);
      throw error;
    }
  }

  /**
   * Add an authorized email (admin only)
   */
  async addAuthorizedEmail(
    email: string, 
    role: 'member' | 'admin', 
    addedBy: string
  ): Promise<void> {
    try {
      await this.db
        .collection(AUTHORIZED_EMAILS_COLLECTION)
        .doc(email.toLowerCase())
        .set({
          email: email.toLowerCase(),
          role,
          addedBy,
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true
        });

      logger.info(`Authorized email added: ${email} with role ${role}`);
    } catch (error) {
      logger.error('Error adding authorized email:', error);
      throw error;
    }
  }

  /**
   * Remove authorization for an email (admin only)
   */
  async removeAuthorizedEmail(email: string): Promise<void> {
    try {
      await this.db
        .collection(AUTHORIZED_EMAILS_COLLECTION)
        .doc(email.toLowerCase())
        .update({
          isActive: false
        });

      logger.info(`Authorization removed for email: ${email}`);
    } catch (error) {
      logger.error('Error removing authorized email:', error);
      throw error;
    }
  }

  /**
   * Get all authorized emails (admin only)
   */
  async getAllAuthorizedEmails(): Promise<AuthorizedEmail[]> {
    try {
      const snapshot = await this.db
        .collection(AUTHORIZED_EMAILS_COLLECTION)
        .where('isActive', '==', true)
        .get();

      const emails: AuthorizedEmail[] = [];
      snapshot.forEach(doc => {
        emails.push(doc.data() as AuthorizedEmail);
      });

      return emails;
    } catch (error) {
      logger.error('Error getting authorized emails:', error);
      throw error;
    }
  }
}

export const authorizedEmailsService = new AuthorizedEmailsService();