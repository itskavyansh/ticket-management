import Joi from 'joi';
import { UserRole } from '../types';

// Enum validation schemas
const userRoleSchema = Joi.string().valid(...Object.values(UserRole));
const statusSchema = Joi.string().valid('available', 'busy', 'away', 'offline');

// Technician skill validation schema
const technicianSkillSchema = Joi.object({
  category: Joi.string().required().max(100).trim(),
  proficiencyLevel: Joi.number().integer().min(1).max(10).required(),
  certifications: Joi.array().items(Joi.string().max(100)).optional().default([]),
  yearsExperience: Joi.number().min(0).max(50).required()
});

// Availability schedule validation schema
const workingHoursSchema = Joi.object({
  start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(), // HH:mm format
  end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),   // HH:mm format
  available: Joi.boolean().required()
});

const availabilityScheduleSchema = Joi.object({
  timezone: Joi.string().required().max(50),
  workingHours: Joi.object({
    monday: workingHoursSchema.required(),
    tuesday: workingHoursSchema.required(),
    wednesday: workingHoursSchema.required(),
    thursday: workingHoursSchema.required(),
    friday: workingHoursSchema.required(),
    saturday: workingHoursSchema.required(),
    sunday: workingHoursSchema.required()
  }).required(),
  holidays: Joi.array().items(Joi.date()).optional().default([]),
  timeOff: Joi.array().items(Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required()
  })).optional().default([])
});

// Technician preferences validation schema
const technicianPreferencesSchema = Joi.object({
  preferredCategories: Joi.array().items(Joi.string().max(100)).optional().default([]),
  maxConcurrentTickets: Joi.number().integer().min(1).max(50).required(),
  notificationChannels: Joi.array().items(Joi.string().max(50)).optional().default([]),
  workloadThreshold: Joi.number().min(0).max(100).required() // percentage
});

// Create technician validation schema
export const createTechnicianSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  role: userRoleSchema.required(),
  department: Joi.string().required().min(2).max(100).trim(),
  timezone: Joi.string().required().max(50),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).optional(),
  manager: Joi.string().uuid().optional(),
  hireDate: Joi.date().max('now').optional().default(() => new Date()),
  skills: Joi.array().items(technicianSkillSchema).optional().default([]),
  maxCapacity: Joi.number().integer().min(1).max(50).optional().default(10),
  location: Joi.string().max(100).trim().optional(),
  externalId: Joi.string().max(100).optional()
});

// Update technician validation schema
export const updateTechnicianSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  email: Joi.string().email().optional(),
  role: userRoleSchema.optional(),
  department: Joi.string().min(2).max(100).trim().optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).allow(null).optional(),
  manager: Joi.string().uuid().allow(null).optional(),
  skills: Joi.array().items(technicianSkillSchema).optional(),
  maxCapacity: Joi.number().integer().min(1).max(50).optional(),
  availability: availabilityScheduleSchema.optional(),
  preferences: technicianPreferencesSchema.optional(),
  currentStatus: statusSchema.optional(),
  statusMessage: Joi.string().max(200).trim().allow('').optional(),
  location: Joi.string().max(100).trim().allow('').optional(),
  isActive: Joi.boolean().optional()
});

// Technician filter validation schema
export const technicianFilterSchema = Joi.object({
  role: Joi.array().items(userRoleSchema).optional(),
  department: Joi.array().items(Joi.string().max(100)).optional(),
  skills: Joi.array().items(Joi.string().max(100)).optional(),
  isActive: Joi.boolean().optional(),
  currentStatus: Joi.array().items(statusSchema).optional(),
  availabilityStatus: Joi.string().valid('available', 'overloaded', 'unavailable').optional(),
  location: Joi.array().items(Joi.string().max(100)).optional()
});

// Technician assignment validation schema
export const technicianAssignmentSchema = Joi.object({
  technicianId: Joi.string().uuid().required(),
  ticketId: Joi.string().uuid().required(),
  assignedBy: Joi.string().uuid().required(),
  estimatedEffort: Joi.number().integer().min(1).required(), // in minutes
  skillMatch: Joi.number().min(0).max(100).optional(), // percentage
  workloadImpact: Joi.number().min(0).max(100).optional() // percentage
});

// Skill assessment validation schema
export const skillAssessmentSchema = Joi.object({
  technicianId: Joi.string().uuid().required(),
  skill: Joi.string().required().max(100).trim(),
  currentLevel: Joi.number().integer().min(1).max(10).required(),
  targetLevel: Joi.number().integer().min(1).max(10).required(),
  assessedBy: Joi.string().uuid().required(),
  improvementPlan: Joi.array().items(Joi.string().max(200)).optional().default([]),
  certificationRequired: Joi.array().items(Joi.string().max(100)).optional().default([])
});

// Validation helper functions
export const validateCreateTechnician = (data: any) => {
  return createTechnicianSchema.validate(data, { abortEarly: false });
};

export const validateUpdateTechnician = (data: any) => {
  return updateTechnicianSchema.validate(data, { abortEarly: false });
};

export const validateTechnicianFilter = (data: any) => {
  return technicianFilterSchema.validate(data, { abortEarly: false });
};

export const validateTechnicianAssignment = (data: any) => {
  return technicianAssignmentSchema.validate(data, { abortEarly: false });
};

export const validateSkillAssessment = (data: any) => {
  return skillAssessmentSchema.validate(data, { abortEarly: false });
};