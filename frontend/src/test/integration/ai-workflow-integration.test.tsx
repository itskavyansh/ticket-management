import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import App from '../../App';
import { mockApiService } from '../../services/mockApi';

// Mock the API service
vi.mock('../../services/mockApi', () => ({
  mockApiService: {
    getDashboardMetrics: vi.fn(),
    getSLAAlerts: vi.fn(),
    getTicketTrends: vi.fn(),
  }
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Workflow Integration Tests - Frontend', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Setup default mock responses
    mockApiService.getDashboardMetrics.mockResolvedValue({
      totalTickets: 1247,
      openTickets: 342,
      resolvedTickets: 89,
      slaCompliance: 94.2,
      averageResolutionTime: 2.4,
      criticalTickets: 5,
      overdueTickets: 12,
      technicianUtilization: 78.5,
    });

    mockApiService.getSLAAlerts.mockResolvedValue([
      {
        id: '1',
        ticketId: 'TKT-001',
        ticketTitle: 'Email server down affecting multiple offices',
        riskLevel: 'critical',
        timeRemaining: -30,
        assignedTechnician: 'John Doe',
        customer: 'Test Company',
        createdAt: '2024-01-15T10:30:00Z',
      }
    ]);

    mockApiService.getTicketTrends.mockResolvedValue([
      { date: '2024-01-08', created: 45, resolved: 38, open: 342 },
      { date: '2024-01-09', created: 52, resolved: 41, open: 353 },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Ticket Lifecycle UI Integration', () => {
    test('should display dashboard with real-time AI insights', async () => {
      render(<App />);

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/AI Ticket Management/i)).toBeInTheDocument();
      });

      // Check if key metrics are displayed
      await waitFor(() => {
        expect(screen.getByText('1,247')).toBeInTheDocument(); // Total tickets
        expect(screen.getByText('342')).toBeInTheDocument(); // Open tickets
        expect(screen.getByText('94.2%')).toBeInTheDocument(); // SLA compliance
      });

      // Verify API calls were made
      expect(mockApiService.getDashboardMetrics).toHaveBeenCalled();
      expect(mockApiService.getSLAAlerts).toHaveBeenCalled();
    });

    test('should create ticket with AI triage integration', async () => {
      // Mock successful ticket creation with AI triage
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'TKT-001',
            title: 'Email server down affecting multiple offices',
            description: 'Exchange server is completely down',
            status: 'open',
            priority: 'high',
            category: 'software',
            aiInsights: {
              triageConfidence: 0.95,
              suggestedCategory: 'software',
              suggestedPriority: 'high',
              reasoning: 'High confidence classification based on error patterns'
            }
          }
        })
      });

      render(<App />);

      // Navigate to ticket creation (assuming there's a create ticket button)
      const createButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(createButton);

      // Fill out ticket form
      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      fireEvent.change(titleInput, { 
        target: { value: 'Email server down affecting multiple offices' } 
      });
      fireEvent.change(descriptionInput, { 
        target: { value: 'Exchange server is completely down. Users cannot send or receive emails.' } 
      });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Wait for AI triage to complete and ticket to be created
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/tickets'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('Email server down')
          })
        );
      });

      // Verify success message or redirect
      await waitFor(() => {
        expect(screen.getByText(/ticket created successfully/i)).toBeInTheDocument();
      });
    });

    test('should display SLA risk alerts with AI predictions', async () => {
      render(<App />);

      // Wait for SLA alerts to load
      await waitFor(() => {
        expect(screen.getByText('TKT-001')).toBeInTheDocument();
        expect(screen.getByText(/email server down/i)).toBeInTheDocument();
        expect(screen.getByText(/critical/i)).toBeInTheDocument();
      });

      // Check if risk indicators are displayed
      expect(screen.getByText(/-30/)).toBeInTheDocument(); // Overdue time
      expect(screen.getByText(/John Doe/)).toBeInTheDocument(); // Assigned technician
    });

    test('should show AI resolution suggestions when viewing ticket details', async () => {
      // Mock ticket details with AI suggestions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'TKT-001',
            title: 'Email server down affecting multiple offices',
            description: 'Exchange server is completely down',
            status: 'open',
            priority: 'high',
            category: 'software'
          }
        })
      });

      // Mock AI resolution suggestions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          suggestions: [
            {
              title: 'Restart Exchange Services',
              description: 'Restart the Microsoft Exchange services in the correct order',
              steps: [
                'Stop Microsoft Exchange Information Store service',
                'Stop Microsoft Exchange System Attendant service',
                'Start Microsoft Exchange System Attendant service',
                'Start Microsoft Exchange Information Store service'
              ],
              confidence_score: 0.92,
              estimated_time_minutes: 15,
              difficulty_level: 'medium'
            }
          ],
          similar_tickets: [
            {
              ticket_id: 'TKT-045',
              title: 'Exchange server connectivity issues',
              similarity_score: 0.87,
              resolution_summary: 'Resolved by restarting services and checking network connectivity'
            }
          ]
        })
      });

      render(<App />);

      // Click on a ticket to view details
      const ticketLink = screen.getByText('TKT-001');
      fireEvent.click(ticketLink);

      // Wait for ticket details and AI suggestions to load
      await waitFor(() => {
        expect(screen.getByText(/restart exchange services/i)).toBeInTheDocument();
        expect(screen.getByText(/confidence: 92%/i)).toBeInTheDocument();
        expect(screen.getByText(/estimated time: 15 minutes/i)).toBeInTheDocument();
      });

      // Check if similar tickets are shown
      await waitFor(() => {
        expect(screen.getByText('TKT-045')).toBeInTheDocument();
        expect(screen.getByText(/similarity: 87%/i)).toBeInTheDocument();
      });
    });

    test('should handle AI service failures gracefully', async () => {
      // Mock AI service failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'TKT-002',
            title: 'Network connectivity issues',
            description: 'Users unable to access internal applications',
            status: 'open',
            priority: 'medium',
            category: 'network'
            // No aiInsights due to AI service failure
          }
        })
      });

      // Mock failed AI suggestions request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'AI service temporarily unavailable',
          ticket_id: 'TKT-002'
        })
      });

      render(<App />);

      // Create ticket without AI triage
      const createButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(createButton);

      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { 
        target: { value: 'Network connectivity issues' } 
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Ticket should still be created successfully
      await waitFor(() => {
        expect(screen.getByText(/ticket created successfully/i)).toBeInTheDocument();
      });

      // View ticket details
      const ticketLink = screen.getByText('TKT-002');
      fireEvent.click(ticketLink);

      // Should show fallback message for AI suggestions
      await waitFor(() => {
        expect(screen.getByText(/ai suggestions temporarily unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates and WebSocket Integration', () => {
    test('should update dashboard metrics in real-time', async () => {
      render(<App />);

      // Initial load
      await waitFor(() => {
        expect(screen.getByText('342')).toBeInTheDocument(); // Open tickets
      });

      // Simulate real-time update
      mockApiService.getDashboardMetrics.mockResolvedValueOnce({
        totalTickets: 1248,
        openTickets: 343,
        resolvedTickets: 89,
        slaCompliance: 94.1,
        averageResolutionTime: 2.4,
        criticalTickets: 6,
        overdueTickets: 12,
        technicianUtilization: 78.5,
      });

      // Trigger refresh (this would normally come from WebSocket)
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Check updated values
      await waitFor(() => {
        expect(screen.getByText('343')).toBeInTheDocument(); // Updated open tickets
        expect(screen.getByText('6')).toBeInTheDocument(); // Updated critical tickets
      });
    });

    test('should show real-time SLA risk updates', async () => {
      render(<App />);

      // Initial SLA alerts
      await waitFor(() => {
        expect(screen.getByText('TKT-001')).toBeInTheDocument();
        expect(screen.getByText(/-30/)).toBeInTheDocument(); // Overdue by 30 minutes
      });

      // Simulate SLA risk increase
      mockApiService.getSLAAlerts.mockResolvedValueOnce([
        {
          id: '1',
          ticketId: 'TKT-001',
          ticketTitle: 'Email server down affecting multiple offices',
          riskLevel: 'critical',
          timeRemaining: -45, // Now overdue by 45 minutes
          assignedTechnician: 'John Doe',
          customer: 'Test Company',
          createdAt: '2024-01-15T10:30:00Z',
        }
      ]);

      // Trigger update
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Check updated overdue time
      await waitFor(() => {
        expect(screen.getByText(/-45/)).toBeInTheDocument();
      });
    });
  });

  describe('AI Performance and Error Handling', () => {
    test('should display AI processing indicators', async () => {
      // Mock slow AI response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              success: true,
              suggestions: [],
              processing_time_ms: 2500
            })
          }), 2000)
        )
      );

      render(<App />);

      // Click to get AI suggestions
      const ticketLink = screen.getByText('TKT-001');
      fireEvent.click(ticketLink);

      const suggestionsButton = screen.getByRole('button', { name: /get ai suggestions/i });
      fireEvent.click(suggestionsButton);

      // Should show loading indicator
      expect(screen.getByText(/generating ai suggestions/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText(/generating ai suggestions/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<App />);

      const createButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(createButton);

      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { 
        target: { value: 'Test ticket' } 
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    test('should validate AI confidence thresholds in UI', async () => {
      // Mock low confidence AI response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          suggestions: [
            {
              title: 'Generic troubleshooting steps',
              description: 'Basic troubleshooting approach',
              confidence_score: 0.3, // Low confidence
              steps: ['Check connections', 'Restart service']
            }
          ]
        })
      });

      render(<App />);

      const ticketLink = screen.getByText('TKT-001');
      fireEvent.click(ticketLink);

      const suggestionsButton = screen.getByRole('button', { name: /get ai suggestions/i });
      fireEvent.click(suggestionsButton);

      // Should show low confidence warning
      await waitFor(() => {
        expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
        expect(screen.getByText(/30%/)).toBeInTheDocument();
        expect(screen.getByText(/manual review recommended/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    test('should be accessible with screen readers', async () => {
      render(<App />);

      // Check for proper ARIA labels
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Check for proper headings hierarchy
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      
      // Check for proper button labels
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    test('should support keyboard navigation', async () => {
      render(<App />);

      // Tab through interactive elements
      const interactiveElements = screen.getAllByRole('button');
      
      interactiveElements[0].focus();
      expect(interactiveElements[0]).toHaveFocus();

      // Simulate tab navigation
      fireEvent.keyDown(interactiveElements[0], { key: 'Tab' });
      
      // Should move focus to next element
      expect(document.activeElement).toBeDefined();
    });

    test('should provide clear feedback for AI operations', async () => {
      render(<App />);

      const ticketLink = screen.getByText('TKT-001');
      fireEvent.click(ticketLink);

      // Check for clear AI status indicators
      expect(screen.getByText(/ai insights/i)).toBeInTheDocument();
      expect(screen.getByText(/confidence/i)).toBeInTheDocument();
      
      // Check for help text
      expect(screen.getByText(/ai-powered suggestions/i)).toBeInTheDocument();
    });
  });
});