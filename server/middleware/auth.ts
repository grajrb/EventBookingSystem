import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthUser } from '../services/auth';
import { storage } from '../storage';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token) as AuthUser;
    // Validate tokenVersion against current DB to allow global invalidation
    storage.getUser(payload.id).then(user => {
      if (!user) return res.status(401).json({ message: 'Invalid token user' });
      const currentVersion = (user as any).tokenVersion ?? 0;
      if (currentVersion !== payload.tokenVersion) {
        return res.status(401).json({ message: 'Token no longer valid (version mismatch)' });
      }
      req.user = payload;
      next();
    }).catch(()=> res.status(500).json({ message: 'Auth verification failed' }));
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};
