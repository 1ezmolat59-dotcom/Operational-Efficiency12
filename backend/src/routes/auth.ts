import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest, JwtPayload } from '../types';

export const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

function generateTokens(payload: JwtPayload): { token: string; refreshToken: string } {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!secret || !refreshSecret) {
    throw new Error('JWT secrets are not configured');
  }

  const token = jwt.sign(payload, secret, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ userId: payload.userId }, refreshSecret, { expiresIn: '7d' });

  return { token, refreshToken };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      return;
    }

    const { email, password } = parsed.data;

    const staff = await prisma.staff.findUnique({
      where: { email: email.toLowerCase() },
      include: { wing: true },
    });

    if (!staff) {
      res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, staff.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const payload: JwtPayload = {
      userId: staff.id,
      role: staff.role,
      wingId: staff.wingId,
      email: staff.email,
      name: staff.name,
    };

    const { token, refreshToken } = generateTokens(payload);

    res.json({
      token,
      refreshToken,
      user: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        wingId: staff.wingId,
        email: staff.email,
        wing: staff.wing,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      return;
    }

    const { refreshToken } = parsed.data;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      res.status(500).json({ error: 'Server configuration error', code: 'SERVER_ERROR' });
      return;
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(refreshToken, refreshSecret) as { userId: string };
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { id: decoded.userId },
    });

    if (!staff) {
      res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Server configuration error', code: 'SERVER_ERROR' });
      return;
    }

    const payload: JwtPayload = {
      userId: staff.id,
      role: staff.role,
      wingId: staff.wingId,
      email: staff.email,
      name: staff.name,
    };

    const newToken = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({ token: newToken });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.user!.userId },
      include: { wing: true },
      omit: { passwordHash: true },
    });

    if (!staff) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    res.json({ user: staff });
  } catch (error) {
    console.error('[Auth] Me error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});
