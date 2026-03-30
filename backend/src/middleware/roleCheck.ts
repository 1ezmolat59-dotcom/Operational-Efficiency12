import { Response, NextFunction } from 'express';
import { StaffRole } from '@prisma/client';
import { AuthRequest } from '../types';

export function requireRole(...roles: StaffRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required roles: ${roles.join(', ')}`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
