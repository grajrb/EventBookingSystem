import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../services/redis';

// Basic rate limiter for all routes
export const baseLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
});

// Stricter limiter for authentication routes
export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
});

// Limiter for event booking routes
export const bookingLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 booking requests per windowMs
  message: 'Too many booking attempts, please try again later',
});
