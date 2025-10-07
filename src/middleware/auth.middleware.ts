import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../utils/auth';
import { UnauthorizedError } from '../utils/errors';
import { UserRepository } from '../repositories';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        cuisine_preferences: string[];
        dietary_restrictions: any[];
        dosha: string | null;
        cultural_background: string;
        created_at: string;
        updated_at: string;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    const decoded = AuthService.verifyToken(token);

    // Fetch user from database to ensure user still exists
    const userRepo = new UserRepository();
    const user = await userRepo.findById(decoded.userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Attach user to request object (excluding password hash)
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      cuisine_preferences: user.cuisine_preferences,
      dietary_restrictions: user.dietary_restrictions,
      dosha: user.dosha,
      cultural_background: user.cultural_background,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    return next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(); // No auth header, continue without user
    }

    const token = AuthService.extractTokenFromHeader(authHeader);
    const decoded = AuthService.verifyToken(token);

    // Fetch user from database
    const userRepo = new UserRepository();
    const user = await userRepo.findById(decoded.userId);

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        cuisine_preferences: user.cuisine_preferences,
        dietary_restrictions: user.dietary_restrictions,
        dosha: user.dosha,
        cultural_background: user.cultural_background,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    }

    return next();
  } catch (error) {
    // For optional auth, don't fail the request if auth fails
    return next();
  }
};

export const requireOwnership = (resourceParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const resourceId = req.params[resourceParam];
    const userId = req.user.id.toString();

    if (resourceId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only access your own resources',
        code: 'FORBIDDEN'
      });
    }

    return next();
  };
};

export const validateAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // For now, only allow admin emails (in a real app, this would check user roles)
  const adminEmails = ['admin@culturaldiet.com', 'support@culturaldiet.com'];
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  return next();
};