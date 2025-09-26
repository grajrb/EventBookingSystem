import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@shared/schema';

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

export interface AuthUser {
  id: number;
  email: string;
  isAdmin: boolean;
}
