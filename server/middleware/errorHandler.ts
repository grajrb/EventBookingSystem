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
  const isZod = err instanceof ZodError;
  const statusCode = err.statusCode || (isZod ? 400 : 500);

  let code: string | undefined = err.code;
  const details: any[] = [];
  let message = err.message || 'Internal Server Error';

  if (isZod) {
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    for (const issue of err.errors) {
      details.push({ path: issue.path, message: issue.message });
    }
  }

  if (err.code === '23505') {
    code = 'UNIQUE_VIOLATION';
    message = 'Duplicate field value entered';
  }
  if (err.code === '23503') {
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Referenced record not found';
  }
  if (statusCode === 401 && !isZod) {
    message = 'Invalid credentials';
    code = code || 'UNAUTHORIZED';
  }
  if (statusCode === 404 && !isZod) {
    code = code || 'NOT_FOUND';
  }
  if (statusCode === 400 && /user already exists/i.test(message)) {
    code = code || 'USER_EXISTS';
    message = 'User already exists';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: code || 'ERROR',
      details: details.length ? details : undefined,
    },
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};
