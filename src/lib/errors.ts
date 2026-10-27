import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/** Typed application error — always serialized to the documented shape. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Convenience helpers */
export const notFound = (msg: string) => new AppError(404, 'NOT_FOUND', msg);
export const callClosed = () =>
  new AppError(409, 'CALL_CLOSED', 'This call has already been closed.');
export const validationError = (msg: string) =>
  new AppError(400, 'VALIDATION_ERROR', msg);

/** Standard error response body */
function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

/** Express error-handling middleware — must be the last middleware registered. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    res.status(400).json(errorBody('VALIDATION_ERROR', message));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }

  // Unknown errors — log safely (no secrets, no stack in response)
  console.error('[error]', err instanceof Error ? err.message : String(err));
  res.status(500).json(errorBody('INTERNAL', 'An unexpected error occurred.'));
}
