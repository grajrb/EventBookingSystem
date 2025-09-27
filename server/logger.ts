import pino from 'pino';

// Create a singleton pino logger. In production we prefer JSON; in development pretty print.
const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: !isProd ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined,
  base: undefined, // omit pid/hostname for cleaner logs (platform may add its own metadata)
});

export function requestLog(fields: Record<string, any>) {
  logger.info(fields, 'request');
}
