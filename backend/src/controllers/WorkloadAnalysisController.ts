import { Request, Response } from 'express';
import { WorkloadAnalysisService } from '../services/WorkloadAnalysisService';
import { TimeTrackingService } from '../services/TimeTrackingService';
import { TicketService } from '../services/TicketService';
import { logger } from '../utils/logger';

export class WorkloadAnalysisController {
  private workloadAnalysisService: WorkloadAnalysisService;

  constructor() {
    const timeTrackingService = new TimeTrackingService();
    const ticketService = new TicketService();
    this.workloadAnalysisService = new WorkloadAnalysisService(timeTrackingService, ticketService);
  }

  /**
   * Analyze workload for a specific technician
   * GET /api/workload-analysis/technician/:technicianId
   */
  public analyzeWorkload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const analysis = await this.workloadAnalysisService.analyzeWorkload(technicianId);

      res.json({
        success: true,
        data: analysis,
        message: 'Workload analysis completed successfully'
      });
    } catch (error) {
      logger.error('Error in analyzeWorkload:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to analyze workload'
      });
    }
  };

  /**
   * Get technician capacity
   * GET /api/workload-analysis/capacity/:technicianId
   */
  public getTechnicianCapacity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const capacity = await this.workloadAnalysisService.calculateTechnicianCapacity(technicianId);

      res.json({
        success: true,
        data: capacity
      });
    } catch (error) {
      logger.error('Error in getTechnicianCapacity:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get technician capacity'
      });
    }
  };

  /**
   * Get workload prediction for technician
   * GET /api/workload-analysis/prediction/:technicianId
   */
  public getWorkloadPrediction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const prediction = await this.workloadAnalysisService.generateWorkloadPrediction(technicianId);

      res.json({
        success: true,
        data: prediction
      });
    } catch (error) {
      logger.error('Error in getWorkloadPrediction:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workload prediction'
      });
    }
  };

  /**
   * Get utilization metrics for technician
   * GET /api/workload-analysis/utilization/:technicianId
   */
  public getUtilizationMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const metrics = await this.workloadAnalysisService.calculateUtilizationMetrics(technicianId);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error in getUtilizationMetrics:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get utilization metrics'
      });
    }
  };

  /**
   * Get workload alerts for technician
   * GET /api/workload-analysis/alerts/:technicianId
   */
  public getWorkloadAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      // Get current analysis to extract alerts
      const analysis = await this.workloadAnalysisService.analyzeWorkload(technicianId);
      const activeAlerts = analysis.alerts.filter(alert => alert.isActive);

      res.json({
        success: true,
        data: activeAlerts
      });
    } catch (error) {
      logger.error('Error in getWorkloadAlerts:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workload alerts'
      });
    }
  };

  /**
   * Get workload recommendations for technician
   * GET /api/workload-analysis/recommendations/:technicianId
   */
  public getWorkloadRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      // Get current analysis to extract recommendations
      const analysis = await this.workloadAnalysisService.analyzeWorkload(technicianId);

      res.json({
        success: true,
        data: analysis.recommendations
      });
    } catch (error) {
      logger.error('Error in getWorkloadRecommendations:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workload recommendations'
      });
    }
  };

  /**
   * Analyze team workload
   * GET /api/workload-analysis/team/:teamId
   */
  public analyzeTeamWorkload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;

      const teamAnalysis = await this.workloadAnalysisService.analyzeTeamWorkload(teamId);

      res.json({
        success: true,
        data: teamAnalysis
      });
    } catch (error) {
      logger.error('Error in analyzeTeamWorkload:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to analyze team workload'
      });
    }
  };

  /**
   * Get overutilized technicians
   * GET /api/workload-analysis/overutilized
   */
  public getOverutilizedTechnicians = async (req: Request, res: Response): Promise<void> => {
    try {
      const threshold = parseFloat(req.query.threshold as string) || 85;
      
      // This would be implemented as a method in the service
      // For now, we'll get all technicians and filter
      const overutilized = await this.getOverutilizedTechniciansList(threshold);

      res.json({
        success: true,
        data: overutilized
      });
    } catch (error) {
      logger.error('Error in getOverutilizedTechnicians:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get overutilized technicians'
      });
    }
  };

  /**
   * Get rebalancing recommendations
   * POST /api/workload-analysis/rebalance
   */
  public getRebalancingRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, threshold = 85 } = req.body;

      if (!teamId) {
        res.status(400).json({
          success: false,
          message: 'Team ID is required'
        });
        return;
      }

      const teamAnalysis = await this.workloadAnalysisService.analyzeTeamWorkload(teamId);
      
      res.json({
        success: true,
        data: {
          rebalancingOpportunities: teamAnalysis.rebalancingOpportunities,
          capacityOptimizations: teamAnalysis.capacityOptimizations
        }
      });
    } catch (error) {
      logger.error('Error in getRebalancingRecommendations:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get rebalancing recommendations'
      });
    }
  };

  /**
   * Get workload history for technician
   * GET /api/workload-analysis/history/:technicianId
   */
  public getWorkloadHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { days = 30 } = req.query;

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - parseInt(days as string) * 24 * 60 * 60 * 1000);

      // This would use the workload analysis repository
      const history = await this.getWorkloadAnalysisHistory(technicianId, startDate, endDate);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error in getWorkloadHistory:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workload history'
      });
    }
  };

  /**
   * Helper method to get overutilized technicians
   */
  private async getOverutilizedTechniciansList(threshold: number): Promise<any[]> {
    try {
      // Get all active technicians
      const technicians = await this.workloadAnalysisService['getAllTechnicians']();
      const overutilized = [];

      for (const technician of technicians) {
        const capacity = await this.workloadAnalysisService.calculateTechnicianCapacity(technician.id);
        
        if (capacity.utilizationPercentage > threshold) {
          overutilized.push({
            technicianId: technician.id,
            name: technician.name,
            department: technician.department,
            currentUtilization: capacity.utilizationPercentage,
            currentTickets: capacity.currentActiveTickets,
            maxCapacity: capacity.maxConcurrentTickets,
            overutilizationAmount: capacity.utilizationPercentage - threshold
          });
        }
      }

      return overutilized.sort((a, b) => b.currentUtilization - a.currentUtilization);
    } catch (error) {
      logger.error('Error getting overutilized technicians list:', error);
      return [];
    }
  }

  /**
   * Helper method to get workload analysis history
   */
  private async getWorkloadAnalysisHistory(
    technicianId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<any[]> {
    try {
      // This would use the workload analysis repository
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      logger.error('Error getting workload analysis history:', error);
      return [];
    }
  }
}