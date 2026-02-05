/**
 * API Middleware - Request validation and error handling
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ErrorCodes } from '../core/types';

/**
 * Validate that userId is present in request body
 */
export function validateUserId(req: Request, res: Response, next: NextFunction): void {
  const { userId } = req.body;

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    const response: ApiResponse = {
      success: false,
      message: 'userId is required',
      error: ErrorCodes.INVALID_REQUEST,
    };
    res.status(400).json(response);
    return;
  }

  // Normalize userId
  req.body.userId = userId.trim();
  next();
}

/**
 * Validate transaction parameters
 */
export function validateTxParams(req: Request, res: Response, next: NextFunction): void {
  const { txParams } = req.body;

  if (!txParams || typeof txParams !== 'object') {
    const response: ApiResponse = {
      success: false,
      message: 'txParams is required',
      error: ErrorCodes.INVALID_REQUEST,
    };
    res.status(400).json(response);
    return;
  }

  const { to, value } = txParams;

  if (!to || typeof to !== 'string') {
    const response: ApiResponse = {
      success: false,
      message: 'txParams.to is required and must be a valid address',
      error: ErrorCodes.INVALID_REQUEST,
    };
    res.status(400).json(response);
    return;
  }

  if (value === undefined || value === null) {
    const response: ApiResponse = {
      success: false,
      message: 'txParams.value is required',
      error: ErrorCodes.INVALID_REQUEST,
    };
    res.status(400).json(response);
    return;
  }

  next();
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API Error]', err);

  const response: ApiResponse = {
    success: false,
    message: 'An internal error occurred',
    error: ErrorCodes.INTERNAL_ERROR,
  };

  res.status(500).json(response);
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  console.log(`[API] ${req.method} ${req.path}`, {
    body: req.body,
    params: req.params,
  });
  next();
}
