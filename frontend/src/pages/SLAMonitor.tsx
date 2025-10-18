import { useState } from 'react';
import { SLAAlertPanel, KPIWidget, RealTimeIndicator } from '../components/dashboard';
import { useSLAAlerts, useDashboardMetrics, useRealTimeData } from '../hooks/useRealTimeData';
import { DashboardKPI } from '../types/analytics';

export function SLAMonitor() {
  const [timeRange, setTimeRange] = useState('24h');
  const { isConnected } = useRealTimeData();
  const { data: alerts, isLoading: alertsLoading } = useSLAAlerts();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();

  // SLA-specific KPIs
  const slaKpis: DashboardKPI[] = [
    {
      id: 'sla-compliance',
      title: 'Overall SLA Compliance',
      value: metrics?.slaCompliance || 0,
      format: 'percentage',
      color: (metrics?.slaCompliance || 0) >= 95 ? 'green' : (metrics?.slaCompliance || 0) >= 90 ? 'yellow' : 'red',
      change: 1.3,
      changeType: 'increase',
    },
    {
      id: 'at-risk-tickets',
      title: 'At Risk Tickets',
      value: alerts?.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length || 0,
      format: 'number',
      color: 'red',
      change: -15.2,
      changeType: 'decrease',
    },
    {
      id: 'overdue-tickets',
      title: 'Overdue Tickets',
      value: metrics?.overdueTickets || 0,
      format: 'number',
      color: (metrics?.overdueTickets || 0) > 0 ? 'red' : 'green',
      change: -25.0,
      changeType: 'decrease',
    },
    {
      id: 'avg-response-time',
      title: 'Avg Response Time',
      value: 0.8,
      format: 'duration',
      color: 'green',
      change: -12.5,
      changeType: 'decrease',
    },
  ];

  const riskLevelCounts = alerts?.reduce((acc, alert) => {
    acc[alert.riskLevel] = (acc[alert.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">SLA Monitor</h1>
          <p className="text-gray-600 mt-1">Track SLA compliance and risk alerts</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <RealTimeIndicator isConnected={isConnected} lastUpdate={new Date()} />
        </div>
      </div>

      {/* SLA KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {slaKpis.map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={metricsLoading} />
        ))}
      </div>

      {/* Risk Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card border-l-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-500">Critical Risk</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {riskLevelCounts.critical || 0}
          </p>
        </div>
        <div className="card border-l-4 border-orange-500">
          <h3 className="text-sm font-medium text-gray-500">High Risk</h3>
          <p className="text-2xl font-semibold text-orange-600 mt-2">
            {riskLevelCounts.high || 0}
          </p>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <h3 className="text-sm font-medium text-gray-500">Medium Risk</h3>
          <p className="text-2xl font-semibold text-yellow-600 mt-2">
            {riskLevelCounts.medium || 0}
          </p>
        </div>
        <div className="card border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Low Risk</h3>
          <p className="text-2xl font-semibold text-blue-600 mt-2">
            {riskLevelCounts.low || 0}
          </p>
        </div>
      </div>

      {/* SLA Alerts Panel */}
      <SLAAlertPanel alerts={alerts || []} isLoading={alertsLoading} />
    </div>
  );
}