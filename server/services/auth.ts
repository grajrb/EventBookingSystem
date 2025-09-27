import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, refreshTokens } from '@shared/schema';
import { db } from '../db';
import crypto from 'crypto';

// Enforce strong JWT secret at module load so a misconfiguration fails fast.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error('JWT_SECRET environment variable is required and must be set to a strong random value.');
}
if (rawSecret.length < 32) {
  // 256 bits (32 chars min if using full entropy) recommended; length check is a heuristic.
  throw new Error('JWT_SECRET is too short. Use at least 32 characters of high-entropy secret material.');
}
const JWT_SECRET = rawSecret;
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Refresh token (persisted) helpers
const REFRESH_TTL_DAYS = 14;

export const createRefreshToken = async (userId: number) => {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokens).values({ userId, token, expiresAt });
  return { token, expiresAt };
};

export const rotateRefreshToken = async (oldToken: string) => {
  const { sql } = await import('drizzle-orm');
  // Delete old & issue new (simple rotation)
  await db.execute(sql`DELETE FROM refresh_tokens WHERE token = ${oldToken}` as any);
};

export const verifyRefreshToken = async (token: string) => {
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token));
  if (!rows.length) return null;
  const row: any = rows[0];
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row;
};

export interface AuthUser {
  id: number;
  email: string;
  isAdmin: boolean;
}
