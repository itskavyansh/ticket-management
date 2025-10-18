import { TicketRepository } from '../database/repositories/TicketRepository';
import { TicketEntity } from '../entities/TicketEntity';
import { TechnicianEntity } from '../entities/TechnicianEntity';
import { TicketStatus, Priority } from '../types';
import { logger } from '../utils/logger';
import { aiService } from './AIService';

/**
 * Workload optimization recommendation interface
 */
export interface WorkloadRecommendation {
  ticket_id: string;
  current_technician_id?: string;
  recommended_technician_id: string;
  confidence_score: number;
  reasoning: string;
  estimated_impact: {
    time_savings_hours: number;
    sla_improvement_percentage: number;
    workload_balance_score: number;
  };
}

/**
 * Technician capacity analysis interface
 */
export interface TechnicianCapacityAnalysis {
  technician_id: string;
  current_workload_percentage: number;
  optimal_workload_percentage: number;
  skill_utilization: Record<string, number>;
  recommended_actions: Array<{
    action: 'assign_more' | 'reduce_load' | 'skill_training' | 'no_action';
    priority: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

/**
 * AI-powered workload optimization service
 */
export class AIWorkloadOptimizationService {
  private ticketRepository: TicketRepository;

  constructor(ticketRepository?: TicketRepository) {
    this.ticketRepository = ticketRepository || new TicketRepository();
  }

  /**
   * Get AI-powered ticket assignment recommendations
   */
  async getTicketAssignmentRecommendations(
    ticketIds: string[],
    availableTechnicians: TechnicianEntity[]
  ): Promise<WorkloadRecommendation[]> {
    try {
      // Get ticket details
      const tickets = await Promise.all(
        ticketIds.map(async (ticketId) => {
          // Parse customerId and ticketId if needed
          const [customerId, actualTicketId] = ticketId.includes(':') 
            ? ticketId.split(':') 
            : ['', ticketId];
          
          return await this.ticketRepository.getById(customerId, actualTicketId);
        })
      );

      const validTickets = tickets.filter(ticket => ticket !== null) as TicketEntity[];

      if (validTickets.length === 0) {
        return [];
      }

      // Prepare data for AI service
      const aiRequest = {
        technicians: availableTechnicians.map(tech => ({
          technician_id: tech.id,
          skills: tech.skills.map(skill => skill.category),
          current_workload: tech.currentWorkload || 0,
          max_capacity: tech.maxCapacity || 40, // Default 40 hours per week
          availability_hours: this.calculateAvailabilityHours(tech)
        })),
        pending_tickets: validTickets.map(ticket => ({
          ticket_id: ticket.id,
          priority: ticket.priority,
          category: ticket.category,
          estimated_hours: this.estimateTicketHours(ticket),
          required_skills: this.extractRequiredSkills(ticket)
        }))
      };

      // Get AI recommendations
      const aiResponse = await aiService.optimizeWorkload(aiRequest);

      if (!aiResponse.success || !aiResponse.recommendations) {
        logger.warn('AI workload optimization failed, using fallback logic');
        return this.getFallbackRecommendations(validTickets, availableTechnicians);
      }

      // Convert AI recommendations to our format
      const recommendations: WorkloadRecommendation[] = aiResponse.recommendations.map(rec => ({
        ticket_id: rec.ticket_id,
        recommended_technician_id: rec.recommended_technician_id,
        confidence_score: rec.confidence_score,
        reasoning: rec.reasoning,
        estimated_impact: {
          time_savings_hours: 0.5, // Default estimate
          sla_improvement_percentage: 10,
          workload_balance_score: 0.8
        }
      }));

      logger.info('AI workload optimization completed', {
        ticketsAnalyzed: validTickets.length,
        recommendationsGenerated: recommendations.length,
        averageConfidence: recommendations.reduce((sum, r) => sum + r.confidence_score, 0) / recommendations.length
      });

      return recommendations;
    } catch (error) {
      logger.error('Failed to get AI workload recommendations', {
        error: (error as Error).message,
        ticketCount: ticketIds.length,
        technicianCount: availableTechnicians.length
      });
      
      // Fallback to rule-based recommendations
      const tickets = await Promise.all(
        ticketIds.map(async (ticketId) => {
          const [customerId, actualTicketId] = ticketId.includes(':') 
            ? ticketId.split(':') 
            : ['', ticketId];
          return await this.ticketRepository.getById(customerId, actualTicketId);
        })
      );
      
      const validTickets = tickets.filter(ticket => ticket !== null) as TicketEntity[];
      return this.getFallbackRecommendations(validTickets, availableTechnicians);
    }
  }

  /**
   * Analyze technician capacity and workload distribution
   */
  async analyzeTechnicianCapacity(
    technicianIds: string[]
  ): Promise<TechnicianCapacityAnalysis[]> {
    try {
      const analyses: TechnicianCapacityAnalysis[] = [];

      for (const technicianId of technicianIds) {
        // Get technician's current tickets
        const activeTickets = await this.ticketRepository.getByTechnician(
          technicianId,
          [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
          100
        );

        // Calculate current workload
        const totalEstimatedHours = activeTickets.reduce(
          (sum, ticket) => sum + this.estimateTicketHours(ticket),
          0
        );

        const currentWorkloadPercentage = Math.min(100, (totalEstimatedHours / 40) * 100);
        const optimalWorkloadPercentage = 80; // 80% is considered optimal

        // Analyze skill utilization
        const skillUtilization = this.analyzeSkillUtilization(activeTickets);

        // Generate recommendations
        const recommendedActions = this.generateCapacityRecommendations(
          currentWorkloadPercentage,
          optimalWorkloadPercentage,
          skillUtilization
        );

        analyses.push({
          technician_id: technicianId,
          current_workload_percentage: Math.round(currentWorkloadPercentage),
          optimal_workload_percentage: optimalWorkloadPercentage,
          skill_utilization: skillUtilization,
          recommended_actions: recommendedActions
        });
      }

      logger.info('Technician capacity analysis completed', {
        techniciansAnalyzed: technicianIds.length,
        averageWorkload: analyses.reduce((sum, a) => sum + a.current_workload_percentage, 0) / analyses.length
      });

      return analyses;
    } catch (error) {
      logger.error('Failed to analyze technician capacity', {
        error: (error as Error).message,
        technicianIds
      });
      throw error;
    }
  }

  /**
   * Get intelligent ticket routing suggestions
   */
  async getIntelligentRouting(
    newTicket: TicketEntity,
    availableTechnicians: TechnicianEntity[]
  ): Promise<{
    primary_recommendation: WorkloadRecommendation;
    alternative_recommendations: WorkloadRecommendation[];
    routing_factors: {
      skill_match_score: number;
      workload_balance_score: number;
      sla_risk_score: number;
      availability_score: number;
    };
  }> {
    try {
      // Get recommendations for this single ticket
      const recommendations = await this.getTicketAssignmentRecommendations(
        [newTicket.id],
        availableTechnicians
      );

      if (recommendations.length === 0) {
        throw new Error('No routing recommendations available');
      }

      // Calculate routing factors for the primary recommendation
      const primaryRec = recommendations[0];
      const recommendedTech = availableTechnicians.find(
        t => t.id === primaryRec.recommended_technician_id
      );

      const routingFactors = {
        skill_match_score: this.calculateSkillMatchScore(newTicket, recommendedTech),
        workload_balance_score: this.calculateWorkloadBalanceScore(recommendedTech),
        sla_risk_score: this.calculateSLARiskScore(newTicket),
        availability_score: this.calculateAvailabilityScore(recommendedTech)
      };

      logger.info('Intelligent routing completed', {
        ticketId: newTicket.id,
        primaryRecommendation: primaryRec.recommended_technician_id,
        confidence: primaryRec.confidence_score,
        alternativeCount: recommendations.length - 1
      });

      return {
        primary_recommendation: primaryRec,
        alternative_recommendations: recommendations.slice(1),
        routing_factors: routingFactors
      };
    } catch (error) {
      logger.error('Failed to get intelligent routing', {
        ticketId: newTicket.id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Calculate availability hours for a technician
   */
  private calculateAvailabilityHours(technician: TechnicianEntity): number {
    // Default to 8 hours per day, 5 days per week
    const defaultHours = 40;
    
    // If technician has availability schedule, calculate based on that
    if (technician.availability) {
      // This would be implemented based on the actual availability structure
      return defaultHours;
    }
    
    return defaultHours;
  }

  /**
   * Estimate hours required for a ticket
   */
  private estimateTicketHours(ticket: TicketEntity): number {
    // Base estimation on priority and category
    const priorityMultipliers = {
      [Priority.CRITICAL]: 4,
      [Priority.HIGH]: 3,
      [Priority.MEDIUM]: 2,
      [Priority.LOW]: 1
    };

    const categoryBaseHours = {
      'hardware': 3,
      'software': 2,
      'network': 4,
      'security': 5,
      'email': 1.5,
      'backup': 2.5,
      'printer': 1,
      'phone': 1.5,
      'access': 1,
      'other': 2
    };

    const baseHours = categoryBaseHours[ticket.category] || 2;
    const multiplier = priorityMultipliers[ticket.priority] || 2;
    
    return baseHours * multiplier;
  }

  /**
   * Extract required skills from ticket
   */
  private extractRequiredSkills(ticket: TicketEntity): string[] {
    const skills = [ticket.category];
    
    // Add additional skills based on ticket content
    if (ticket.description.toLowerCase().includes('server')) {
      skills.push('server_administration');
    }
    if (ticket.description.toLowerCase().includes('database')) {
      skills.push('database_management');
    }
    if (ticket.description.toLowerCase().includes('security')) {
      skills.push('cybersecurity');
    }
    
    return skills;
  }

  /**
   * Fallback recommendation logic when AI is unavailable
   */
  private getFallbackRecommendations(
    tickets: TicketEntity[],
    technicians: TechnicianEntity[]
  ): WorkloadRecommendation[] {
    return tickets.map(ticket => {
      // Simple round-robin assignment based on current workload
      const availableTech = technicians
        .filter(tech => tech.currentWorkload < tech.maxCapacity)
        .sort((a, b) => a.currentWorkload - b.currentWorkload)[0];

      return {
        ticket_id: ticket.id,
        recommended_technician_id: availableTech?.id || technicians[0]?.id || 'unassigned',
        confidence_score: 0.6, // Lower confidence for fallback
        reasoning: 'Fallback assignment based on workload balance',
        estimated_impact: {
          time_savings_hours: 0,
          sla_improvement_percentage: 5,
          workload_balance_score: 0.6
        }
      };
    });
  }

  /**
   * Analyze skill utilization for a technician
   */
  private analyzeSkillUtilization(tickets: TicketEntity[]): Record<string, number> {
    const skillCounts = new Map<string, number>();
    
    tickets.forEach(ticket => {
      const skills = this.extractRequiredSkills(ticket);
      skills.forEach(skill => {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      });
    });

    const totalTickets = tickets.length;
    const utilization: Record<string, number> = {};
    
    skillCounts.forEach((count, skill) => {
      utilization[skill] = totalTickets > 0 ? (count / totalTickets) * 100 : 0;
    });

    return utilization;
  }

  /**
   * Generate capacity recommendations
   */
  private generateCapacityRecommendations(
    currentWorkload: number,
    optimalWorkload: number,
    skillUtilization: Record<string, number>
  ): Array<{
    action: 'assign_more' | 'reduce_load' | 'skill_training' | 'no_action';
    priority: 'high' | 'medium' | 'low';
    description: string;
  }> {
    const recommendations = [];

    if (currentWorkload > 95) {
      recommendations.push({
        action: 'reduce_load' as const,
        priority: 'high' as const,
        description: 'Technician is severely overloaded. Consider reassigning tickets or hiring additional staff.'
      });
    } else if (currentWorkload > optimalWorkload) {
      recommendations.push({
        action: 'reduce_load' as const,
        priority: 'medium' as const,
        description: 'Technician workload is above optimal. Monitor closely and consider load balancing.'
      });
    } else if (currentWorkload < 60) {
      recommendations.push({
        action: 'assign_more' as const,
        priority: 'low' as const,
        description: 'Technician has capacity for additional tickets.'
      });
    } else {
      recommendations.push({
        action: 'no_action' as const,
        priority: 'low' as const,
        description: 'Technician workload is within optimal range.'
      });
    }

    // Check for skill gaps
    const lowUtilizationSkills = Object.entries(skillUtilization)
      .filter(([_, utilization]) => utilization < 20)
      .map(([skill, _]) => skill);

    if (lowUtilizationSkills.length > 0) {
      recommendations.push({
        action: 'skill_training' as const,
        priority: 'medium' as const,
        description: `Consider training in underutilized skills: ${lowUtilizationSkills.join(', ')}`
      });
    }

    return recommendations;
  }

  /**
   * Calculate skill match score
   */
  private calculateSkillMatchScore(ticket: TicketEntity, technician?: TechnicianEntity): number {
    if (!technician) return 0;
    
    const requiredSkills = this.extractRequiredSkills(ticket);
    const techSkills = technician.skills.map(skill => skill.category);
    
    const matchingSkills = requiredSkills.filter(skill => techSkills.includes(skill));
    return requiredSkills.length > 0 ? (matchingSkills.length / requiredSkills.length) * 100 : 0;
  }

  /**
   * Calculate workload balance score
   */
  private calculateWorkloadBalanceScore(technician?: TechnicianEntity): number {
    if (!technician) return 0;
    
    const utilizationRate = (technician.currentWorkload / technician.maxCapacity) * 100;
    
    // Optimal range is 70-85%
    if (utilizationRate >= 70 && utilizationRate <= 85) {
      return 100;
    } else if (utilizationRate < 70) {
      return 70 + (utilizationRate / 70) * 30;
    } else {
      return Math.max(0, 100 - (utilizationRate - 85) * 2);
    }
  }

  /**
   * Calculate SLA risk score
   */
  private calculateSLARiskScore(ticket: TicketEntity): number {
    const now = new Date();
    const timeRemaining = ticket.slaDeadline.getTime() - now.getTime();
    const totalSLATime = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
    
    if (timeRemaining <= 0) return 100; // Already breached
    
    const timeElapsed = totalSLATime - timeRemaining;
    const progressRatio = timeElapsed / totalSLATime;
    
    return Math.min(100, progressRatio * 100);
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(technician?: TechnicianEntity): number {
    if (!technician) return 0;
    
    // Simple calculation based on current workload
    const availabilityPercentage = Math.max(0, 100 - (technician.currentWorkload / technician.maxCapacity) * 100);
    return availabilityPercentage;
  }
}

// Export singleton instance
export const aiWorkloadOptimizationService = new AIWorkloadOptimizationService();