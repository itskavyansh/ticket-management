import { BaseRepository } from '../dynamodb/repositories/BaseRepository';
import { WorkloadAnalysis, TechnicianCapacity, WorkloadPrediction } from '../../models/WorkloadAnalysis';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for workload analysis data operations using DynamoDB
 */
export class WorkloadAnalysisRepository extends BaseRepository<WorkloadAnalysis> {
  constructor() {
    super(process.env.WORKLOAD_ANALYSIS_TABLE_NAME || 'ai-ticket-management-workload-analysis');
  }

  /**
   * Save workload analysis
   */
  async saveAnalysis(analysis: WorkloadAnalysis): Promise<void> {
    try {
      const analysisWithId = {
        ...analysis,
        id: `${analysis.technicianId}_${analysis.analysisDate.toISOString()}`
      };

      await this.putItem(analysisWithId);
      
      logger.info('Workload analysis saved successfully', {
        technicianId: analysis.technicianId,
        analysisDate: analysis.analysisDate
      });
    } catch (error) {
      logger.error('Failed to save workload analysis', {
        technicianId: analysis.technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get latest workload analysis for technician
   */
  async getLatestAnalysis(technicianId: string): Promise<WorkloadAnalysis | null> {
    try {
      const result = await this.queryItems(
        'technicianId = :technicianId',
        undefined,
        { ':technicianId': technicianId },
        'TechnicianIndex',
        undefined,
        1,
        false // Most recent first
      );

      return result.items.length > 0 ? result.items[0] as WorkloadAnalysis : null;
    } catch (error) {
      logger.error('Failed to get latest workload analysis', {
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get workload analysis history for technician
   */
  async getAnalysisHistory(
    technicianId: string, 
    startDate: Date, 
    endDate: Date,
    limit: number = 50
  ): Promise<WorkloadAnalysis[]> {
    try {
      const result = await this.queryItems(
        'technicianId = :technicianId AND analysisDate BETWEEN :startDate AND :endDate',
        undefined,
        { 
          ':technicianId': technicianId,
          ':startDate': startDate.toISOString(),
          ':endDate': endDate.toISOString()
        },
        'TechnicianIndex',
        undefined,
        limit,
        false // Most recent first
      );

      return result.items as WorkloadAnalysis[];
    } catch (error) {
      logger.error('Failed to get workload analysis history', {
        technicianId,
        startDate,
        endDate,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get all technicians with recent analysis
   */
  async getAllRecentAnalyses(hoursBack: number = 24): Promise<WorkloadAnalysis[]> {
    try {
      const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      
      const result = await this.scanItems(
        'analysisDate >= :cutoffDate',
        undefined,
        { ':cutoffDate': cutoffDate.toISOString() }
      );

      return result.items as WorkloadAnalysis[];
    } catch (error) {
      logger.error('Failed to get recent workload analyses', {
        hoursBack,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete old workload analyses (cleanup)
   */
  async deleteOldAnalyses(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const result = await this.scanItems(
        'analysisDate < :cutoffDate',
        undefined,
        { ':cutoffDate': cutoffDate.toISOString() }
      );

      let deletedCount = 0;
      for (const item of result.items) {
        await this.deleteItem({ 
          technicianId: item.technicianId, 
          analysisDate: item.analysisDate 
        });
        deletedCount++;
      }

      logger.info('Old workload analyses deleted', {
        deletedCount,
        olderThanDays
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete old workload analyses', {
        olderThanDays,
        error: (error as Error).message
      });
      throw error;
    }
  }
}