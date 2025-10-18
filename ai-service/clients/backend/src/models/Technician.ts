import { 
  UserRole, 
  TechnicianSkill, 
  AvailabilitySchedule, 
  TechnicianPreferences, 
  PerformanceMetrics 
} from '../types';

export interface Technician {
  id: string;
  externalId?: string; // SuperOps technician ID
  name: string;
  email: string;
  role: UserRole;
  skills: TechnicianSkill[];
  currentWorkload: number; // percentage (0-100)
  maxCapacity: number; // max concurrent tickets
  performanceMetrics?: PerformanceMetrics;
  availability: AvailabilitySchedule;
  preferences: TechnicianPreferences;
  
  // Profile information
  phoneNumber?: string;
  department: string;
  manager?: string;
  hireDate: Date;
  
  // Status tracking
  isActive: boolean;
  lastLoginAt?: Date;
  currentStatus: 'available' | 'busy' | 'away' | 'offline';
  statusMessage?: string;
  
  // Location and timezone
  timezone: string;
  location?: string;
  
  // Certification and training
  certifications: string[];
  trainingCompleted: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTechnicianRequest {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  timezone: string;
  phoneNumber?: string;
  manager?: string;
  hireDate?: Date;
  skills?: TechnicianSkill[];
  maxCapacity?: number;
  location?: string;
  externalId?: string;
}

export interface UpdateTechnicianRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  department?: string;
  phoneNumber?: string;
  manager?: string;
  skills?: TechnicianSkill[];
  maxCapacity?: number;
  availability?: AvailabilitySchedule;
  preferences?: TechnicianPreferences;
  currentStatus?: 'available' | 'busy' | 'away' | 'offline';
  statusMessage?: string;
  location?: string;
  isActive?: boolean;
}

export interface TechnicianWorkload {
  technicianId: string;
  currentTickets: number;
  maxCapacity: number;
  utilizationRate: number; // percentage (0-100)
  averageTicketAge: number; // in hours
  overdueTickets: number;
  slaRiskTickets: number;
  estimatedAvailableCapacity: number;
  predictedWorkload: {
    nextHour: number;
    nextDay: number;
    nextWeek: number;
  };
}

export interface TechnicianAssignment {
  technicianId: string;
  ticketId: string;
  assignedAt: Date;
  assignedBy: string;
  estimatedEffort: number; // in minutes
  skillMatch: number; // percentage (0-100)
  workloadImpact: number; // percentage increase in workload
}

export interface TechnicianFilter {
  role?: UserRole[];
  department?: string[];
  skills?: string[];
  isActive?: boolean;
  currentStatus?: string[];
  availabilityStatus?: 'available' | 'overloaded' | 'unavailable';
  location?: string[];
}

export interface SkillAssessment {
  technicianId: string;
  skill: string;
  currentLevel: number;
  targetLevel: number;
  assessedAt: Date;
  assessedBy: string;
  improvementPlan?: string[];
  certificationRequired?: string[];
}