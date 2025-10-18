import { DateRange } from '../types';

export interface WorkloadAnalysis {
  technicianId: string;
  analysisDate: Date;
  currentCapacity: TechnicianCapacity;
  workloadPrediction: WorkloadPrediction;
  utilizationMetrics: UtilizationMetrics;
  alerts: WorkloadAlert[];
  recommendations: WorkloadRecommendation[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicianCapacity {
  technicianId: string;
  maxConcurrentTickets: number;
  currentActiveTickets: number;
  availableCapacity: number;
  utilizationPercentage: number;
  
  // Skill-based capacity
  skillCapacities: SkillCapacity[];
  
  // Time-based capacity
  dailyHours: number;
  weeklyHours: number;
  availableHoursToday: number;
  availableHoursThisWeek: number;
  
  // Efficiency metrics
  averageResolutionTime: number; // minutes
  ticketThroughput: number; // tickets per day
  efficiencyScore: number; // 0-100
  
  lastUpdated: Date;
}

export interface SkillCapacity {
  skillCategory: string;
  proficiencyLevel: number; // 1-10
  maxTicketsForSkill: number;
  currentTicketsForSkill: number;
  utilizationForSkill: number; // percentage
}

export interface WorkloadPrediction {
  technicianId: string;
  predictionPeriod: DateRange;
  
  // Predicted workload
  predictedTicketCount: number;
  predictedWorkHours: number;
  predictedUtilization: number; // percentage
  
  // Risk assessment
  overutilizationRisk: RiskLevel;
  burnoutRisk: RiskLevel;
  slaRisk: RiskLevel;
  
  // Trend analysis
  workloadTrend: TrendDirection;
  capacityTrend: TrendDirection;
  
  // Confidence metrics
  predictionConfidence: number; // 0-100
  dataQuality: number; // 0-100
  
  // Historical patterns
  historicalPatterns: HistoricalPattern[];
  
  createdAt: Date;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TrendDirection {
  DECREASING = 'decreasing',
  STABLE = 'stable',
  INCREASING = 'increasing',
  VOLATILE = 'volatile'
}

export interface HistoricalPattern {
  patternType: PatternType;
  description: string;
  frequency: number; // how often this pattern occurs
  impact: number; // impact on workload (percentage)
  confidence: number; // confidence in pattern (0-100)
}

export enum PatternType {
  DAILY_PEAK = 'daily_peak',
  WEEKLY_CYCLE = 'weekly_cycle',
  MONTHLY_TREND = 'monthly_trend',
  SEASONAL = 'seasonal',
  EVENT_DRIVEN = 'event_driven'
}

export interface UtilizationMetrics {
  technicianId: string;
  period: DateRange;
  
  // Time utilization
  totalWorkTime: number; // minutes
  activeWorkTime: number; // minutes (excluding idle)
  idleTime: number; // minutes
  timeUtilization: number; // percentage
  
  // Ticket utilization
  ticketsAssigned: number;
  ticketsCompleted: number;
  ticketsInProgress: number;
  ticketUtilization: number; // percentage
  
  // Capacity utilization
  averageCapacityUsed: number; // percentage
  peakCapacityUsed: number; // percentage
  capacityVariance: number; // standard deviation
  
  // Efficiency metrics
  averageTicketResolutionTime: number; // minutes
  firstCallResolutionRate: number; // percentage
  customerSatisfactionScore: number; // 1-5
  
  // Comparison metrics
  teamAverageUtilization: number;
  industryBenchmark: number;
  performanceRanking: number; // 1-100 percentile
}

export interface WorkloadAlert {
  id: string;
  technicianId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  
  // Alert data
  currentValue: number;
  thresholdValue: number;
  recommendedAction: string;
  
  // Timing
  triggeredAt: Date;
  resolvedAt?: Date;
  isActive: boolean;
  
  // Escalation
  escalationLevel: number;
  escalatedAt?: Date;
  escalatedTo?: string;
  
  metadata: Record<string, any>;
}

export enum AlertType {
  OVERUTILIZATION = 'overutilization',
  UNDERUTILIZATION = 'underutilization',
  BURNOUT_RISK = 'burnout_risk',
  SLA_RISK = 'sla_risk',
  CAPACITY_EXCEEDED = 'capacity_exceeded',
  SKILL_MISMATCH = 'skill_mismatch',
  WORKLOAD_IMBALANCE = 'workload_imbalance'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  URGENT = 'urgent'
}

export interface WorkloadRecommendation {
  id: string;
  technicianId: string;
  recommendationType: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  
  // Impact assessment
  expectedImpact: number; // percentage improvement
  implementationEffort: ImplementationEffort;
  timeToImplement: number; // hours
  
  // Actions
  suggestedActions: string[];
  requiredResources: string[];
  
  // Validation
  isImplemented: boolean;
  implementedAt?: Date;
  implementedBy?: string;
  actualImpact?: number;
  
  createdAt: Date;
  expiresAt?: Date;
}

export enum RecommendationType {
  REDISTRIBUTE_TICKETS = 'redistribute_tickets',
  ADJUST_CAPACITY = 'adjust_capacity',
  SKILL_TRAINING = 'skill_training',
  SCHEDULE_OPTIMIZATION = 'schedule_optimization',
  PROCESS_IMPROVEMENT = 'process_improvement',
  RESOURCE_ALLOCATION = 'resource_allocation'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ImplementationEffort {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTENSIVE = 'extensive'
}

export interface WorkloadAnalysisConfig {
  // Capacity thresholds
  overutilizationThreshold: number; // percentage
  underutilizationThreshold: number; // percentage
  burnoutRiskThreshold: number; // percentage
  
  // Prediction settings
  predictionHorizon: number; // days
  historicalDataPeriod: number; // days
  minimumDataPoints: number;
  
  // Alert settings
  alertCooldownPeriod: number; // minutes
  escalationThreshold: number; // minutes
  autoResolveThreshold: number; // minutes
  
  // Analysis frequency
  analysisInterval: number; // minutes
  predictionInterval: number; // hours
  
  // Weights for scoring
  timeWeight: number;
  qualityWeight: number;
  capacityWeight: number;
  satisfactionWeight: number;
}

export interface TeamWorkloadSummary {
  teamId: string;
  analysisDate: Date;
  
  // Team metrics
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  teamUtilization: number; // percentage
  
  // Distribution metrics
  workloadDistribution: TechnicianWorkloadSummary[];
  utilizationVariance: number;
  balanceScore: number; // 0-100, higher is better balanced
  
  // Risk assessment
  overutilizedTechnicians: number;
  underutilizedTechnicians: number;
  atRiskTechnicians: number;
  
  // Recommendations
  rebalancingOpportunities: RebalancingOpportunity[];
  capacityOptimizations: CapacityOptimization[];
}

export interface TechnicianWorkloadSummary {
  technicianId: string;
  name: string;
  currentUtilization: number;
  capacity: number;
  availableCapacity: number;
  riskLevel: RiskLevel;
  activeAlerts: number;
  recommendations: number;
}

export interface RebalancingOpportunity {
  fromTechnicianId: string;
  toTechnicianId: string;
  ticketIds: string[];
  expectedImprovementFrom: number; // percentage
  expectedImprovementTo: number; // percentage
  skillMatchScore: number; // 0-100
  effort: ImplementationEffort;
}

export interface CapacityOptimization {
  technicianId: string;
  currentCapacity: number;
  recommendedCapacity: number;
  reasoning: string;
  expectedImpact: number; // percentage
  implementationSteps: string[];
}