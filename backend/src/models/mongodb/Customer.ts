import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  id: string;
  name: string;
  email: string;
  company: string;
  tier: 'basic' | 'standard' | 'premium' | 'enterprise';
  contactInfo: {
    phone?: string;
    address?: string;
    primaryContact: string;
  };
  slaAgreement: {
    responseTime: number; // in minutes
    resolutionTime: number; // in hours
    businessHours: {
      start: string;
      end: string;
      timezone: string;
    };
    supportLevel: '24x7' | 'business_hours' | 'extended_hours';
  };
  preferences: {
    communicationChannel: 'email' | 'phone' | 'slack' | 'teams';
    language: string;
    notificationFrequency: 'immediate' | 'hourly' | 'daily';
  };
  statistics: {
    totalTickets: number;
    openTickets: number;
    averageResolutionTime: number;
    satisfactionScore: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  company: { type: String, required: true },
  tier: { 
    type: String, 
    enum: ['basic', 'standard', 'premium', 'enterprise'],
    default: 'standard'
  },
  contactInfo: {
    phone: { type: String },
    address: { type: String },
    primaryContact: { type: String, required: true }
  },
  slaAgreement: {
    responseTime: { type: Number, required: true }, // minutes
    resolutionTime: { type: Number, required: true }, // hours
    businessHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      timezone: { type: String, default: 'UTC' }
    },
    supportLevel: { 
      type: String, 
      enum: ['24x7', 'business_hours', 'extended_hours'],
      default: 'business_hours'
    }
  },
  preferences: {
    communicationChannel: { 
      type: String, 
      enum: ['email', 'phone', 'slack', 'teams'],
      default: 'email'
    },
    language: { type: String, default: 'en' },
    notificationFrequency: { 
      type: String, 
      enum: ['immediate', 'hourly', 'daily'],
      default: 'immediate'
    }
  },
  statistics: {
    totalTickets: { type: Number, default: 0 },
    openTickets: { type: Number, default: 0 },
    averageResolutionTime: { type: Number, default: 0 },
    satisfactionScore: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
CustomerSchema.index({ id: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ company: 1 });
CustomerSchema.index({ tier: 1 });
CustomerSchema.index({ isActive: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);