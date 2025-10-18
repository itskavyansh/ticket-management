import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  customerId: string;
  customerName?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  slaDeadline?: Date;
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  tags: string[];
  attachments: Array<{
    filename: string;
    url: string;
    uploadedAt: Date;
  }>;
  comments: Array<{
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Date;
    isInternal: boolean;
  }>;
  aiInsights?: {
    suggestedCategory?: string;
    suggestedPriority?: string;
    confidence?: number;
    reasoning?: string;
    suggestedTechnician?: string;
    estimatedResolutionTime?: number;
    resolutionSuggestions?: Array<{
      suggestion: string;
      confidence: number;
      steps: string[];
    }>;
    slaRiskPrediction?: {
      breachProbability: number;
      riskLevel: string;
      riskFactors: string[];
    };
  };
  timeTracking?: {
    totalTimeSpent: number;
    sessions: Array<{
      technicianId: string;
      startTime: Date;
      endTime?: Date;
      duration?: number;
      description?: string;
    }>;
  };
}

const TicketSchema = new Schema<ITicket>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: { type: String, default: 'general' },
  customerId: { type: String, required: true },
  customerName: { type: String },
  assignedTechnicianId: { type: String },
  assignedTechnicianName: { type: String },
  resolvedAt: { type: Date },
  slaDeadline: { type: Date },
  estimatedResolutionTime: { type: Number },
  actualResolutionTime: { type: Number },
  tags: [{ type: String }],
  attachments: [{
    filename: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  comments: [{
    id: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false }
  }],
  aiInsights: {
    suggestedCategory: { type: String },
    suggestedPriority: { type: String },
    confidence: { type: Number },
    reasoning: { type: String },
    suggestedTechnician: { type: String },
    estimatedResolutionTime: { type: Number },
    resolutionSuggestions: [{
      suggestion: { type: String },
      confidence: { type: Number },
      steps: [{ type: String }]
    }],
    slaRiskPrediction: {
      breachProbability: { type: Number },
      riskLevel: { type: String },
      riskFactors: [{ type: String }]
    }
  },
  timeTracking: {
    totalTimeSpent: { type: Number, default: 0 },
    sessions: [{
      technicianId: { type: String, required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date },
      duration: { type: Number },
      description: { type: String }
    }]
  }
}, {
  timestamps: true
});

// Indexes for better query performance
TicketSchema.index({ id: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ customerId: 1 });
TicketSchema.index({ assignedTechnicianId: 1 });
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ slaDeadline: 1 });
TicketSchema.index({ category: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);