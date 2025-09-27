export interface ServerErrorPayload {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Array<any>;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any[];
  raw?: any;
  constructor(message: string, code: string, status: number, details?: any[], raw?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.raw = raw;
  }
}

export function parseErrorResponse(status: number, bodyText: string): ApiError {
  try {
    const json = JSON.parse(bodyText) as Partial<ServerErrorPayload>;
    if (json && json.error) {
      return new ApiError(
        json.error.message || 'Request failed',
        json.error.code || 'ERROR',
        status,
        json.error.details,
        json
      );
    }
  } catch (_) {
    // ignore JSON parse failure
  }
  return new ApiError(bodyText || 'Request failed', inferCodeFromStatus(status), status);
}

export function inferCodeFromStatus(status: number): string {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'SERVER_ERROR';
  return 'ERROR';
}

// Map server error codes to user‑friendly messages
export function mapApiError(err: ApiError): { title: string; description?: string; variant?: 'destructive' | 'default' } {
  switch (err.code) {
    case 'UNAUTHORIZED':
      return { title: 'Authentication Failed', description: 'Email or password is incorrect.', variant: 'destructive' };
    case 'USER_EXISTS':
      return { title: 'Account Already Exists', description: 'Use a different email or sign in instead.' };
    case 'VALIDATION_ERROR':
      return { title: 'Validation Error', description: firstDetail(err) };
    case 'UNIQUE_VIOLATION':
      return { title: 'Duplicate Value', description: 'That value is already in use.' };
    case 'FOREIGN_KEY_VIOLATION':
      return { title: 'Related Record Missing', description: 'A related item was not found.' };
    case 'NOT_FOUND':
      return { title: 'Not Found', description: 'The requested resource was not found.' };
    case 'RATE_LIMITED':
    case 'TOO_MANY_REQUESTS':
      return { title: 'Slow Down', description: 'Too many requests. Please try again shortly.' };
    default:
      if (err.status >= 500) {
        return { title: 'Server Error', description: 'Something went wrong. Please try again.' , variant: 'destructive'};
      }
      return { title: 'Request Failed', description: err.message || 'Unknown error' };
  }
}

function firstDetail(err: ApiError): string | undefined {
  if (!err.details || !Array.isArray(err.details) || err.details.length === 0) return undefined;
  const d = err.details[0];
  if (typeof d === 'string') return d;
  if (d.message) return d.message;
  return undefined;
}

export function showApiError(toast: (cfg: any)=>void, err: unknown, fallback?: string) {
  if (err instanceof ApiError) {
    const mapped = mapApiError(err);
    toast({ title: mapped.title, description: mapped.description, variant: mapped.variant || (err.status >=500? 'destructive': 'default') });
    return;
  }
  const msg = (err as any)?.message || fallback || 'Error performing request';
  toast({ title: 'Error', description: msg, variant: 'destructive' });
}
