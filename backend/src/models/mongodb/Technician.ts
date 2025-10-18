import mongoose, { Schema, Document } from 'mongoose';

export interface ITechnician extends Document {
  id: string;
  name: string;
  email: string;
  role: 'technician' | 'senior_technician' | 'team_lead' | 'manager';
  skills: string[];
  specializations: string[];
  isActive: boolean;
  currentWorkload: {
    activeTickets: number;
    totalHoursThisWeek: number;
    utilizationPercentage: number;
  };
  performance: {
    averageResolutionTime: number;
    ticketsResolvedThisMonth: number;
    customerSatisfactionScore: number;
    slaComplianceRate: number;
  };
  availability: {
    schedule: Array<{
      day: string;
      startTime: string;
      endTime: string;
    }>;
    timeZone: string;
    isOnline: boolean;
    lastSeen: Date;
  };
  preferences: {
    maxConcurrentTickets: number;
    preferredCategories: string[];
    notificationSettings: {
      email: boolean;
      slack: boolean;
      teams: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const TechnicianSchema = new Schema<ITechnician>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ['technician', 'senior_technician', 'team_lead', 'manager'],
    default: 'technician'
  },
  skills: [{ type: String }],
  specializations: [{ type: String }],
  isActive: { type: Boolean, default: true },
  currentWorkload: {
    activeTickets: { type: Number, default: 0 },
    totalHoursThisWeek: { type: Number, default: 0 },
    utilizationPercentage: { type: Number, default: 0 }
  },
  performance: {
    averageResolutionTime: { type: Number, default: 0 },
    ticketsResolvedThisMonth: { type: Number, default: 0 },
    customerSatisfactionScore: { type: Number, default: 0 },
    slaComplianceRate: { type: Number, default: 0 }
  },
  availability: {
    schedule: [{
      day: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true }
    }],
    timeZone: { type: String, default: 'UTC' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
  },
  preferences: {
    maxConcurrentTickets: { type: Number, default: 5 },
    preferredCategories: [{ type: String }],
    notificationSettings: {
      email: { type: Boolean, default: true },
      slack: { type: Boolean, default: true },
      teams: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Indexes
TechnicianSchema.index({ id: 1 });
TechnicianSchema.index({ email: 1 });
TechnicianSchema.index({ isActive: 1 });
TechnicianSchema.index({ skills: 1 });
TechnicianSchema.index({ specializations: 1 });

export const Technician = mongoose.model<ITechnician>('Technician', TechnicianSchema);