import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
  return error;
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    error = createError(`Validation Error: ${message}`, 400);
  }

  // Database constraint errors
  if (err.code === '23505') { // PostgreSQL unique violation
    error = createError('Duplicate field value entered', 400);
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    error = createError('Referenced record not found', 400);
  }

  // Default error
  const statusCode = error.statusCode || 500;
  let message;
  if (error.statusCode === 401) {
    message = 'Invalid credentials';
  } else if (error.statusCode === 400 && error.message && error.message.toLowerCase().includes('user already exists')) {
    message = 'User already exists';
  } else {
    message = error.message || 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};
