import Joi from 'joi';
import { UserRole } from '../types';

/**
 * Validation schemas for role management endpoints
 */

export const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': `Role must be one of: ${Object.values(UserRole).join(', ')}`,
      'any.required': 'Role is required'
    })
});

export const checkPermissionSchema = Joi.object({
  resource: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Resource name cannot be empty',
      'string.max': 'Resource name must be less than 50 characters',
      'any.required': 'Resource is required'
    }),
  action: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Action name cannot be empty',
      'string.max': 'Action name must be less than 50 characters',
      'any.required': 'Action is required'
    })
});

export const validateRoleAssignmentSchema = Joi.object({
  targetRole: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': `Target role must be one of: ${Object.values(UserRole).join(', ')}`,
      'any.required': 'Target role is required'
    }),
  currentRole: Joi.string()
    .valid(...Object.values(UserRole))
    .optional()
    .messages({
      'any.only': `Current role must be one of: ${Object.values(UserRole).join(', ')}`
    })
});

export const roleParamSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': `Role must be one of: ${Object.values(UserRole).join(', ')}`,
      'any.required': 'Role parameter is required'
    })
});

export const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'User ID must be a valid UUID',
      'any.required': 'User ID parameter is required'
    })
});

/**
 * Validation middleware for route parameters
 */
export const validateRoleParam = (req: any, res: any, next: any) => {
  const { error } = roleParamSchema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role parameter',
      message: error.details[0].message
    });
  }
  
  next();
};

export const validateUserIdParam = (req: any, res: any, next: any) => {
  const { error } = userIdParamSchema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid user ID parameter',
      message: error.details[0].message
    });
  }
  
  next();
};