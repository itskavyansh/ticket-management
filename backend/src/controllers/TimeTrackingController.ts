import { Request, Response } from 'express';
import { TimeTrackingService } from '../services/TimeTrackingService';
import { 
  CreateTimeEntryRequest, 
  UpdateTimeEntryRequest,
  TimeEntryFilter,
  TimeValidationRequest,
  DateRange
} from '../models/TimeTracking';
import { logger } from '../utils/logger';

export class TimeTrackingController {
  private timeTrackingService: TimeTrackingService;

  constructor() {
    this.timeTrackingService = new TimeTrackingService();
  }

  /**
   * Start time tracking
   * POST /api/time-tracking/start
   */
  public startTimeTracking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId, ticketId, description, isBillable, isAutomatic } = req.body;

      const request: CreateTimeEntryRequest = {
        technicianId,
        ticketId,
        description,
        isBillable,
        isAutomatic
      };

      const timeEntry = await this.timeTrackingService.startTimeTracking(request);

      res.status(201).json({
        success: true,
        data: timeEntry,
        message: 'Time tracking started successfully'
      });
    } catch (error) {
      logger.error('Error in startTimeTracking:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start time tracking'
      });
    }
  };

  /**
   * Stop time tracking
   * POST /api/time-tracking/stop/:technicianId
   */
  public stopTimeTracking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const timeEntry = await this.timeTrackingService.stopTimeTracking(technicianId);

      res.json({
        success: true,
        data: timeEntry,
        message: 'Time tracking stopped successfully'
      });
    } catch (error) {
      logger.error('Error in stopTimeTracking:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop time tracking'
      });
    }
  };

  /**
   * Pause time tracking
   * POST /api/time-tracking/pause/:technicianId
   */
  public pauseTimeTracking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { reason } = req.body;

      const timeEntry = await this.timeTrackingService.pauseTimeTracking(technicianId, reason);

      res.json({
        success: true,
        data: timeEntry,
        message: 'Time tracking paused successfully'
      });
    } catch (error) {
      logger.error('Error in pauseTimeTracking:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to pause time tracking'
      });
    }
  };

  /**
   * Resume time tracking
   * POST /api/time-tracking/resume/:technicianId
   */
  public resumeTimeTracking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const timeEntry = await this.timeTrackingService.resumeTimeTracking(technicianId);

      res.json({
        success: true,
        data: timeEntry,
        message: 'Time tracking resumed successfully'
      });
    } catch (error) {
      logger.error('Error in resumeTimeTracking:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resume time tracking'
      });
    }
  };

  /**
   * Record activity (heartbeat)
   * POST /api/time-tracking/activity/:technicianId
   */
  public recordActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      await this.timeTrackingService.recordActivity(technicianId);

      res.json({
        success: true,
        message: 'Activity recorded successfully'
      });
    } catch (error) {
      logger.error('Error in recordActivity:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to record activity'
      });
    }
  };

  /**
   * Get current time entry
   * GET /api/time-tracking/current/:technicianId
   */
  public getCurrentTimeEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const timeEntry = await this.timeTrackingService.getCurrentTimeEntry(technicianId);

      if (!timeEntry) {
        res.status(404).json({
          success: false,
          message: 'No active time entry found'
        });
        return;
      }

      res.json({
        success: true,
        data: timeEntry
      });
    } catch (error) {
      logger.error('Error in getCurrentTimeEntry:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current time entry'
      });
    }
  };

  /**
   * Get active session
   * GET /api/time-tracking/session/:technicianId
   */
  public getActiveSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const session = await this.timeTrackingService.getActiveSession(technicianId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'No active session found'
        });
        return;
      }

      res.json({
        success: true,
        data: session.getSummary()
      });
    } catch (error) {
      logger.error('Error in getActiveSession:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active session'
      });
    }
  };

  /**
   * Validate time entry
   * POST /api/time-tracking/validate
   */
  public validateTimeEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { timeEntryId, validatedBy, correctedDuration, correctionReason, isBillable } = req.body;

      const request: TimeValidationRequest = {
        timeEntryId,
        validatedBy,
        correctedDuration,
        correctionReason,
        isBillable
      };

      const timeEntry = await this.timeTrackingService.validateTimeEntry(request);

      res.json({
        success: true,
        data: timeEntry,
        message: 'Time entry validated successfully'
      });
    } catch (error) {
      logger.error('Error in validateTimeEntry:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to validate time entry'
      });
    }
  };

  /**
   * Get time entries with filtering
   * GET /api/time-tracking/entries
   */
  public getTimeEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        technicianId,
        ticketId,
        status,
        isBillable,
        isAutomatic,
        isValidated,
        startDate,
        endDate,
        minDuration,
        maxDuration,
        page = 1,
        limit = 50
      } = req.query;

      const filter: TimeEntryFilter = {};

      if (technicianId) filter.technicianId = technicianId as string;
      if (ticketId) filter.ticketId = ticketId as string;
      if (status) filter.status = (status as string).split(',') as any[];
      if (isBillable !== undefined) filter.isBillable = isBillable === 'true';
      if (isAutomatic !== undefined) filter.isAutomatic = isAutomatic === 'true';
      if (isValidated !== undefined) filter.isValidated = isValidated === 'true';
      if (minDuration) filter.minDuration = parseInt(minDuration as string);
      if (maxDuration) filter.maxDuration = parseInt(maxDuration as string);

      if (startDate && endDate) {
        filter.dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const timeEntries = await this.timeTrackingService.getTimeEntries(filter);

      // Apply pagination
      const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
      const endIndex = startIndex + parseInt(limit as string);
      const paginatedEntries = timeEntries.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedEntries,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: timeEntries.length,
          totalPages: Math.ceil(timeEntries.length / parseInt(limit as string))
        }
      });
    } catch (error) {
      logger.error('Error in getTimeEntries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get time entries'
      });
    }
  };

  /**
   * Get time tracking summary
   * GET /api/time-tracking/summary/:technicianId
   */
  public getTimeTrackingSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const summary = await this.timeTrackingService.getTimeTrackingSummary(technicianId, period);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error in getTimeTrackingSummary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get time tracking summary'
      });
    }
  };

  /**
   * Get time tracking statistics
   * GET /api/time-tracking/stats/:technicianId
   */
  public getTimeTrackingStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;

      const stats = await this.timeTrackingService.getTimeTrackingStats(technicianId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in getTimeTrackingStats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get time tracking statistics'
      });
    }
  };

  /**
   * Get entries that need validation
   * GET /api/time-tracking/validation-required
   */
  public getEntriesNeedingValidation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.query;

      const filter: TimeEntryFilter = {
        isValidated: false
      };

      if (technicianId) {
        filter.technicianId = technicianId as string;
      }

      const timeEntries = await this.timeTrackingService.getTimeEntries(filter);

      // Filter entries that actually need validation based on business rules
      const entriesNeedingValidation = timeEntries.filter(entry => {
        // Convert to entity to use business logic
        const entryEntity = new (require('../entities/TimeTrackingEntity').TimeEntryEntity)(entry);
        return entryEntity.needsValidation();
      });

      res.json({
        success: true,
        data: entriesNeedingValidation,
        count: entriesNeedingValidation.length
      });
    } catch (error) {
      logger.error('Error in getEntriesNeedingValidation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get entries needing validation'
      });
    }
  };
}