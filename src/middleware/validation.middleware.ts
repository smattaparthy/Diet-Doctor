import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../utils/errors';

export const validateRequest = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[property];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Replace request property with validated and sanitized data
    req[property] = value;
    return next();
  };
};

export const validateAsync = async (data: any, schema: Schema): Promise<any> => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    throw new ValidationError('Validation failed', validationErrors);
  }

  return value;
};

export const validateCulturalCompliance = (
  data: { ingredients?: string[], dietary_restrictions?: any[], cuisine_preferences?: string[] },
  isStrict: boolean = false
) => {
  // Basic cultural validation logic
  const errors: string[] = [];

  // Check for common red meat ingredients (Hindu dietary restriction)
  const redMeatIngredients = ['beef', 'pork', 'veal', 'lamb', 'mutton', 'ham', 'bacon'];

  if (data.ingredients) {
    for (const ingredient of data.ingredients) {
      const lowerIngredient = ingredient.toLowerCase();
      if (redMeatIngredients.some(meat => lowerIngredient.includes(meat))) {
        errors.push(`Red meat ingredient "${ingredient}" may violate dietary restrictions`);
      }
    }
  }

  // Validate against user's dietary restrictions
  if (data.dietary_restrictions && data.ingredients) {
    for (const restriction of data.dietary_restrictions) {
      if (restriction.severity === 'strict' && restriction.type === 'religious') {
        // Check for ingredients that violate religious restrictions
        if (restriction.restriction.toLowerCase().includes('hindu')) {
          const forbiddenIngredients = ['beef', 'pork'];
          for (const ingredient of data.ingredients) {
            if (forbiddenIngredients.some(forbidden => ingredient.toLowerCase().includes(forbidden))) {
              errors.push(`Ingredient "${ingredient}" violates Hindu dietary restrictions`);
            }
          }
        }
      }
    }
  }

  if (isStrict && errors.length > 0) {
    throw new ValidationError(`Cultural compliance validation failed: ${errors.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: errors
  };
};

export const sanitizeInput = (input: string): string => {
  if (!input) return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove potential JavaScript injection
    .replace(/on\w+=/gi, ''); // Remove potential event handlers
};

export const validatePagination = (page?: number, limit?: number) => {
  const validatedPage = Math.max(1, Math.min(1000, page || 1));
  const validatedLimit = Math.max(1, Math.min(100, limit || 20));
  const offset = (validatedPage - 1) * validatedLimit;

  return { page: validatedPage, limit: validatedLimit, offset };
};