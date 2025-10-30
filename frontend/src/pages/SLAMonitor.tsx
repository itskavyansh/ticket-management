import { useState, useMemo, useEffect, useCallback } from 'react';
import { SLAAlertPanel, KPIWidget, RealTimeIndicator } from '../components/dashboard';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { apiService } from '../services/api';
import { DashboardKPI } from '../types/analytics';

// SLA interfaces
interface SLAAlert {
  id: string;
  ticketId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'acknowledged' | 'escalated' | 'resolved';
  message: string;
  timeRemaining: string;
  createdAt: string;
  updatedAt: string;
}

interface SLABreachPrediction {
  ticketId: string;
  riskScore: number;
  timeToBreachHours: number;
  reason: string;
  confidence: number;
}

interface SLAMetrics {
  overallCompliance: number;
  complianceChange: number;
  atRiskChange: number;
  predictionChange: number;
  averageResponseTime: number;
  responseTimeChange: number;
  totalAlerts: number;
  criticalAlerts: number;
  resolvedAlerts: number;
}

export function SLAMonitor() {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [alerts, setAlerts] = useState<SLAAlert[]>([]);
  const [breachPredictions, setBreachPredictions] = useState<SLABreachPrediction[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { isConnected } = useRealTimeData();

  // Mock data
  const mockAlerts: SLAAlert[] = [
    {
      id: '1',
      ticketId: 'TKT-001',
      severity: 'critical',
      status: 'active',
      message: 'SLA breach imminent - 15 minutes remaining',
      timeRemaining: '15 minutes',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      ticketId: 'TKT-002',
      severity: 'high',
      status: 'acknowledged',
      message: 'High priority ticket approaching SLA deadline',
      timeRemaining: '2 hours 30 minutes',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      ticketId: 'TKT-003',
      severity: 'medium',
      status: 'active',
      message: 'Medium priority ticket requires attention',
      timeRemaining: '6 hours 45 minutes',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      ticketId: 'TKT-004',
      severity: 'low',
      status: 'active',
      message: 'Low priority ticket monitoring',
      timeRemaining: '1 day 4 hours',
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      ticketId: 'TKT-005',
      severity: 'high',
      status: 'escalated',
      message: 'Escalated due to complexity - SLA extended',
      timeRemaining: '4 hours 20 minutes',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockBreachPredictions: SLABreachPrediction[] = [
    {
      ticketId: 'TKT-006',
      riskScore: 0.85,
      timeToBreachHours: 3.5,
      reason: 'Complex technical issue with limited expertise available',
      confidence: 0.92,
    },
    {
      ticketId: 'TKT-007',
      riskScore: 0.72,
      timeToBreachHours: 8.2,
      reason: 'Waiting for customer response, historical delays likely',
      confidence: 0.78,
    },
    {
      ticketId: 'TKT-008',
      riskScore: 0.68,
      timeToBreachHours: 12.1,
      reason: 'Resource constraints during peak hours',
      confidence: 0.85,
    },
  ];

  const mockSlaMetrics: SLAMetrics = {
    overallCompliance: 94.2,
    complianceChange: -1.3,
    atRiskChange: 2,
    predictionChange: 1,
    averageResponseTime: 1.2,
    responseTimeChange: -0.3,
    totalAlerts: mockAlerts.length,
    criticalAlerts: mockAlerts.filter(a => a.severity === 'critical').length,
    resolvedAlerts: mockAlerts.filter(a => a.status === 'resolved').length,
  };

  const fetchSLAData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch real data from API
      try {
        const [alertsResponse, predictionsResponse, metricsResponse] = await Promise.all([
          apiService.get('/api/sla/alerts'),
          apiService.get('/api/sla/predictions'),
          apiService.get('/api/sla/metrics'),
        ]);

        setAlerts(alertsResponse.data || mockAlerts);
        setBreachPredictions(predictionsResponse.data || mockBreachPredictions);
        setSlaMetrics(metricsResponse.data || mockSlaMetrics);
      } catch (apiError) {
        console.warn('API not available, using mock data:', apiError);
        // Fallback to mock data
        setAlerts(mockAlerts);
        setBreachPredictions(mockBreachPredictions);
        setSlaMetrics(mockSlaMetrics);
      }
    } catch (error) {
      console.error('Error fetching SLA data:', error);
      // Still provide mock data on error
      setAlerts(mockAlerts);
      setBreachPredictions(mockBreachPredictions);
      setSlaMetrics(mockSlaMetrics);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      // Try API call first
      try {
        await apiService.post(`/api/sla/alerts/${alertId}/acknowledge`);
      } catch (apiError) {
        console.warn('API not available for acknowledge action:', apiError);
      }

      // Update local state optimistically
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged' as const, updatedAt: new Date().toISOString() }
          : alert
      ));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }, []);

  const escalateAlert = useCallback(async (alertId: string) => {
    try {
      // Try API call first
      try {
        await apiService.post(`/api/sla/alerts/${alertId}/escalate`);
      } catch (apiError) {
        console.warn('API not available for escalate action:', apiError);
      }

      // Update local state optimistically
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'escalated' as const, updatedAt: new Date().toISOString() }
          : alert
      ));
    } catch (error) {
      console.error('Error escalating alert:', error);
    }
  }, []);

  const refreshData = useCallback(() => {
    fetchSLAData();
  }, [fetchSLAData]);

  useEffect(() => {
    fetchSLAData();
  }, [fetchSLAData]);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSLAData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSLAData]);

  // Filter alerts based on selected criteria
  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    
    return alerts.filter(alert => {
      const severityMatch = selectedSeverity === 'all' || alert.severity === selectedSeverity;
      const statusMatch = selectedStatus === 'all' || alert.status === selectedStatus;
      return severityMatch && statusMatch;
    });
  }, [alerts, selectedSeverity, selectedStatus]);

  // SLA-specific KPIs
  const slaKpis: DashboardKPI[] = useMemo(() => {
    if (!slaMetrics) return [];

    const atRiskCount = alerts?.filter(a => a.severity === 'high' || a.severity === 'critical').length || 0;
    const breachPredictionCount = breachPredictions?.length || 0;

    return [
      {
        id: 'sla-compliance',
        title: 'Overall SLA Compliance',
        value: slaMetrics.overallCompliance,
        format: 'percentage',
        color: slaMetrics.overallCompliance >= 95 ? 'green' : slaMetrics.overallCompliance >= 90 ? 'yellow' : 'red',
        change: slaMetrics.complianceChange || 0,
        changeType: (slaMetrics.complianceChange || 0) >= 0 ? 'increase' : 'decrease',
      },
      {
        id: 'at-risk-tickets',
        title: 'At Risk Tickets',
        value: atRiskCount,
        format: 'number',
        color: atRiskCount > 0 ? 'red' : 'green',
        change: slaMetrics.atRiskChange || 0,
        changeType: (slaMetrics.atRiskChange || 0) >= 0 ? 'increase' : 'decrease',
      },
      {
        id: 'breach-predictions',
        title: 'Predicted Breaches',
        value: breachPredictionCount,
        format: 'number',
        color: breachPredictionCount > 0 ? 'orange' : 'green',
        change: slaMetrics.predictionChange || 0,
        changeType: (slaMetrics.predictionChange || 0) >= 0 ? 'increase' : 'decrease',
      },
      {
        id: 'avg-response-time',
        title: 'Avg Response Time',
        value: slaMetrics.averageResponseTime,
        format: 'duration',
        color: slaMetrics.averageResponseTime <= 1 ? 'green' : slaMetrics.averageResponseTime <= 2 ? 'yellow' : 'red',
        change: slaMetrics.responseTimeChange || 0,
        changeType: (slaMetrics.responseTimeChange || 0) <= 0 ? 'increase' : 'decrease', // Lower is better
      },
    ];
  }, [slaMetrics, alerts, breachPredictions]);

  // Risk level counts for filtered alerts
  const riskLevelCounts = useMemo(() => {
    return filteredAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredAlerts]);

  // Handle alert actions
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleEscalateAlert = async (alertId: string) => {
    try {
      await escalateAlert(alertId);
    } catch (error) {
      console.error('Failed to escalate alert:', error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">SLA Monitor</h1>
          <p className="text-gray-600 mt-1">Track SLA compliance and risk alerts in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <RealTimeIndicator isConnected={isConnected} lastUpdate={new Date()} />
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts && alerts.filter(alert => alert.severity === 'critical').length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Critical SLA Alerts Require Immediate Attention
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {alerts.filter(alert => alert.severity === 'critical').length} critical alerts detected
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SLA KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {slaKpis.map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={isLoading} />
        ))}
      </div>

      {/* Risk Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-500">Critical Severity</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {riskLevelCounts.critical || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Immediate action required</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <h3 className="text-sm font-medium text-gray-500">High Severity</h3>
          <p className="text-2xl font-semibold text-orange-600 mt-2">
            {riskLevelCounts.high || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Urgent attention needed</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <h3 className="text-sm font-medium text-gray-500">Medium Severity</h3>
          <p className="text-2xl font-semibold text-yellow-600 mt-2">
            {riskLevelCounts.medium || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Monitor closely</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Low Severity</h3>
          <p className="text-2xl font-semibold text-blue-600 mt-2">
            {riskLevelCounts.low || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Standard monitoring</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Alert Filters</h3>
          <div className="text-sm text-gray-500">
            Showing {filteredAlerts.length} of {alerts?.length || 0} alerts
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Breach Predictions */}
      {breachPredictions && breachPredictions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">SLA Breach Predictions</h3>
          <div className="space-y-4">
            {breachPredictions.slice(0, 10).map((prediction) => (
              <div key={prediction.ticketId} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      Ticket #{prediction.ticketId}
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      prediction.riskScore >= 0.8 ? 'bg-red-100 text-red-800' :
                      prediction.riskScore >= 0.6 ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {Math.round(prediction.riskScore * 100)}% Risk
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Predicted breach in {Math.round(prediction.timeToBreachHours)} hours
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Reason: {prediction.reason}
                  </p>
                </div>
                <div className="ml-4">
                  <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                    View Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced SLA Alerts Panel */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Active SLA Alerts</h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading alerts...</span>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedSeverity !== 'all' || selectedStatus !== 'all' 
                  ? 'Try adjusting your filters to see more alerts.'
                  : 'All SLAs are currently on track.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'critical' ? 'bg-red-50 border-red-500' :
                  alert.severity === 'high' ? 'bg-orange-50 border-orange-500' :
                  alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-blue-50 border-blue-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          Ticket #{alert.ticketId}
                        </h4>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.status === 'active' ? 'bg-gray-100 text-gray-800' :
                          alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-800' :
                          alert.status === 'escalated' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {alert.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Time remaining: {alert.timeRemaining} | 
                        Created: {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(alert.status === 'active' || alert.status === 'acknowledged') && (
                        <button
                          onClick={() => handleEscalateAlert(alert.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Escalate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}