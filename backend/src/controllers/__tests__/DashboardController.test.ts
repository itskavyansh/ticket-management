import { Response } from 'express';
import { dashboardController } from '../DashboardController';
import { dashboardService } from '../../services/DashboardService';
import { AuthenticatedRequest } from '../../types/auth';

// Mock the dashboard service
jest.mock('../../services/DashboardService');
const mockDashboardService = dashboardService as jest.Mocked<typeof dashboardService>;

describe('DashboardController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      query: {},
      params: {},
      user: { userId: 'test-user-id', email: 'test@example.com', role: 'admin' as any }
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
      setHeader: jest.fn(),
      send: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('getDashboardWidgets', () => {
    it('should return dashboard widgets successfully', async () => {
      const mockWidgetData = {
        'kpi-summary': {
          totalTickets: 100,
          avgResponseTime: 30,
          slaCompliance: 95
        }
      };

      mockDashboardService.getWidgetData.mockResolvedValue(mockWidgetData);

      mockRequest.query = {
        widgets: 'kpi-summary',
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      };

      await dashboardController.getDashboardWidgets(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDashboardService.getWidgetData).toHaveBeenCalledWith(
        ['kpi-summary'],
        {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-31')
        },
        {
          technicians: undefined,
          customers: undefined,
          categories: undefined,
          priorities: undefined
        }
      );

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockWidgetData,
        metadata: expect.objectContaining({
          period: {
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-31')
          },
          widgets: ['kpi-summary'],
          generatedAt: expect.any(Date)
        })
      });
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Service error';
      mockDashboardService.getWidgetData.mockRejectedValue(new Error(errorMessage));

      await dashboardController.getDashboardWidgets(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve dashboard widgets',
        message: errorMessage
      });
    });
  });

  describe('getChartData', () => {
    it('should return chart data successfully', async () => {
      const mockChartData = {
        data: [{ date: '2023-01-01', value: 10 }],
        labels: ['Jan 1']
      };

      mockDashboardService.getChartData.mockResolvedValue(mockChartData);

      mockRequest.params = { chartType: 'ticket-trend' };
      mockRequest.query = {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        granularity: 'daily'
      };

      await dashboardController.getChartData(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDashboardService.getChartData).toHaveBeenCalledWith(
        'ticket-trend',
        {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-31')
        },
        'daily',
        {
          technicians: undefined,
          customers: undefined,
          categories: undefined,
          priorities: undefined
        }
      );

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockChartData,
        metadata: expect.objectContaining({
          chartType: 'ticket-trend',
          granularity: 'daily'
        })
      });
    });

    it('should return 400 for missing required parameters', async () => {
      mockRequest.params = { chartType: 'ticket-trend' };
      mockRequest.query = { startDate: '2023-01-01' }; // Missing endDate

      await dashboardController.getChartData(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Start date and end date are required'
      });
    });
  });

  describe('exportPDF', () => {
    it('should generate and return PDF successfully', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');
      mockDashboardService.generateReport.mockResolvedValue(mockPDFBuffer);

      mockRequest.query = {
        reportType: 'dashboard',
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        includeCharts: 'true'
      };

      await dashboardController.exportPDF(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDashboardService.generateReport).toHaveBeenCalledWith(
        'dashboard',
        {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-31')
        },
        {
          technicians: undefined,
          customers: undefined,
          categories: undefined,
          priorities: undefined
        },
        {
          includeCharts: true,
          template: 'standard',
          format: 'pdf'
        }
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="dashboard-report-2023-01-01-to-2023-01-31.pdf"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockPDFBuffer);
    });
  });

  describe('exportCSV', () => {
    it('should generate and return CSV successfully', async () => {
      const mockCSVData = 'header1,header2\nvalue1,value2';
      mockDashboardService.exportData.mockResolvedValue(mockCSVData);

      mockRequest.query = {
        dataType: 'tickets',
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        includeHeaders: 'true'
      };

      await dashboardController.exportCSV(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDashboardService.exportData).toHaveBeenCalledWith(
        'tickets',
        {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-31')
        },
        {
          technicians: undefined,
          customers: undefined,
          categories: undefined,
          priorities: undefined
        },
        {
          columns: undefined,
          includeHeaders: true,
          format: 'csv'
        }
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="tickets-export-2023-01-01-to-2023-01-31.csv"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockCSVData);
    });
  });

  describe('healthCheck', () => {
    it('should return health status successfully', async () => {
      const mockHealthStatus = {
        dashboard: 'healthy',
        database: 'healthy',
        timestamp: new Date()
      };

      mockDashboardService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await dashboardController.healthCheck(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockHealthStatus
      });
    });
  });
});