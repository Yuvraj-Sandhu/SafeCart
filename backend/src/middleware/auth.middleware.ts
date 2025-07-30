import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { JWTPayload } from '../types/user.types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Verify JWT token middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    // Debug logging for token issues
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth middleware - Cookies:', Object.keys(req.cookies));
      console.log('Auth middleware - Token found:', !!token);
      if (!token) {
        console.log('Auth middleware - No token in cookies or headers');
      }
    }
    
    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }
    
    const payload = AuthService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth middleware - Token verification failed:', error);
    }
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Check if user is admin
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};

// Check if user is logged in (member or admin)
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  next();
};