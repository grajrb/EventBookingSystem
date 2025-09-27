import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient as redis } from '../services/redis';

/**
 * Helper - create a limiter that prefers Redis but gracefully falls back to in-memory
 */
function createHybridLimiter(options: { windowMs: number; max: number; message: string }): RateLimitRequestHandler {
  const useRedis = !!process.env.REDIS_URL && redis && typeof redis.call === 'function';
  if (useRedis) {
    try {
      return rateLimit({
        store: new (RedisStore as any)({
          sendCommand: (...args: string[]) => redis.call(args),
        }),
        ...options,
        standardHeaders: true,
        legacyHeaders: false,
      });
    } catch (e) {
      // fall through to memory store
    }
  }
  // In-memory fallback (per-instance). Good enough for dev or when Redis absent.
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// Basic rate limiter for all routes
export const baseLimiter = createHybridLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
});

// Stricter limiter for authentication routes
export const authLimiter = createHybridLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later',
});

// Limiter for event booking routes
export const bookingLimiter = createHybridLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Too many booking attempts, please try again later',
});
