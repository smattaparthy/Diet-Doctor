import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle known application errors
  if (error instanceof AppError) {
    const response: any = {
      success: false,
      error: error.message,
      code: error.code
    };

    if (error instanceof ValidationError) {
      response.details = error.details;
    }

    return res.status(error.statusCode).json(response);
  }

  // Handle validation errors (e.g., from express-validator)
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Handle database errors
  if (error.name === 'SqliteError') {
    console.error('Database error:', error);
    return res.status(500).json({
      success: false,
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    });
  }

  // Handle SyntaxError (JSON parsing errors)
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }

  // Log unexpected errors for debugging
  console.error('Unexpected error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Generic server error for unknown issues
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND'
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};