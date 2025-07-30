import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

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
import { User } from '../types/user.types';
import { AuthService } from './auth.service';

const USERS_COLLECTION = 'users';

export class UserService {
  // Create a new user
  static async createUser(userData: Omit<User, 'uid'> & { password: string }): Promise<User> {
    const { password, ...userWithoutPassword } = userData;
    
    // Hash the password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Create the user document
    const userRef = db.collection(USERS_COLLECTION).doc();
    const user: User = {
      uid: userRef.id,
      username: userWithoutPassword.username,
      email: userWithoutPassword.email,
      role: userWithoutPassword.role || 'member',
      passwordHash
    };
    
    await userRef.set(user);
    
    return user;
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as User;
  }

  // Get user by ID
  static async getUserById(uid: string): Promise<User | null> {
    const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as User;
  }

  // Update user
  static async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(uid).update(updates);
  }

  // List all users (admin only)
  static async listUsers(): Promise<User[]> {
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data() as User);
  }
}