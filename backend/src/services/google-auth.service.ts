import { OAuth2Client } from 'google-auth-library';
import * as admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { authorizedEmailsService } from './authorized-emails.service';
import logger from '../utils/logger';

const USERS_COLLECTION = 'users';

export interface GoogleUser {
  email: string;
  name: string;
  googleId: string;
}

export class GoogleAuthService {
  private client: OAuth2Client;
  private db = admin.firestore();

  constructor() {
    // Initialize with Google Client ID from environment
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Verify Google ID token and extract user information
   */
  async verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      
      if (!payload) {
        return null;
      }

      return {
        email: payload.email!,
        name: payload.name!,
        googleId: payload.sub, // Google's unique user ID
      };
    } catch (error) {
      logger.error('Error verifying Google token:', error);
      return null;
    }
  }

  /**
   * Authenticate user with Google
   */
  async authenticateWithGoogle(idToken: string): Promise<{
    success: boolean;
    user?: any;
    token?: string;
    message?: string;
  }> {
    try {
      // Verify the Google token
      const googleUser = await this.verifyGoogleToken(idToken);
      
      if (!googleUser) {
        return {
          success: false,
          message: 'Invalid Google token'
        };
      }

      // Check if email is authorized
      const { authorized, role } = await authorizedEmailsService.checkAuthorization(googleUser.email);
      
      if (!authorized) {
        return {
          success: false,
          message: 'Email not authorized. Please contact an administrator.'
        };
      }

      // Check if user exists
      const userQuery = await this.db
        .collection(USERS_COLLECTION)
        .where('email', '==', googleUser.email)
        .limit(1)
        .get();

      let userId: string;
      let userData: any;

      if (!userQuery.empty) {
        // User exists - update their Google ID and last login
        const existingUser = userQuery.docs[0];
        userId = existingUser.id;
        
        await existingUser.ref.update({
          googleId: googleUser.googleId,
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
          username: googleUser.name, // Update name in case it changed
          role: role!, // Update role from authorized_emails (in case it changed)
        });

        userData = {
          uid: userId,
          ...existingUser.data(),
          googleId: googleUser.googleId,
          username: googleUser.name,
          role: role!, // Use updated role from authorized_emails
        };
      } else {
        // Create new user
        const newUserRef = await this.db.collection(USERS_COLLECTION).add({
          email: googleUser.email,
          username: googleUser.name,
          googleId: googleUser.googleId,
          role: role!,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
          authMethod: 'google'
        });

        userId = newUserRef.id;
        userData = {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          googleId: googleUser.googleId,
          role: role!,
          authMethod: 'google'
        };
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          role: userData.role
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );

      logger.info(`User ${googleUser.email} authenticated via Google`);

      return {
        success: true,
        user: {
          uid: userId,
          email: googleUser.email,
          username: googleUser.name,
          role: userData.role
        },
        token
      };
    } catch (error) {
      logger.error('Error authenticating with Google:', error);
      return {
        success: false,
        message: 'Authentication failed'
      };
    }
  }
}

export const googleAuthService = new GoogleAuthService();