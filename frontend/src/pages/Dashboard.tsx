import { useMemo } from 'react';
import {
  KPIWidget,
  TicketTrendsChart,
  SLAAlertPanel,
  CategoryDistributionChart,
  RealTimeIndicator,
} from '../components/dashboard';
import {
  useDashboardMetrics,
  useSLAAlerts,
  useTicketTrends,
  useRealTimeData,
} from '../hooks/useRealTimeData';
import { DashboardKPI, CategoryDistribution } from '../types/analytics';

export function Dashboard() {
  const { isConnected } = useRealTimeData();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: alerts, isLoading: alertsLoading } = useSLAAlerts();
  const { data: trends, isLoading: trendsLoading } = useTicketTrends('7d');

  // Transform metrics data into KPI widgets
  const kpis: DashboardKPI[] = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        id: 'total-tickets',
        title: 'Total Tickets',
        value: metrics.totalTickets,
        format: 'number',
        color: 'blue',
        change: 5.2,
        changeType: 'increase',
      },
      {
        id: 'open-tickets',
        title: 'Open Tickets',
        value: metrics.openTickets,
        format: 'number',
        color: 'yellow',
        change: -2.1,
        changeType: 'decrease',
      },
      {
        id: 'sla-compliance',
        title: 'SLA Compliance',
        value: metrics.slaCompliance,
        format: 'percentage',
        color: metrics.slaCompliance >= 95 ? 'green' : metrics.slaCompliance >= 90 ? 'yellow' : 'red',
        change: 1.3,
        changeType: 'increase',
      },
      {
        id: 'avg-resolution-time',
        title: 'Avg Resolution Time',
        value: metrics.averageResolutionTime,
        format: 'duration',
        color: 'gray',
        change: -8.5,
        changeType: 'decrease',
      },
      {
        id: 'critical-tickets',
        title: 'Critical Tickets',
        value: metrics.criticalTickets,
        format: 'number',
        color: metrics.criticalTickets > 0 ? 'red' : 'green',
        change: metrics.criticalTickets > 0 ? 15.2 : -100,
        changeType: metrics.criticalTickets > 0 ? 'increase' : 'decrease',
      },
      {
        id: 'overdue-tickets',
        title: 'Overdue Tickets',
        value: metrics.overdueTickets,
        format: 'number',
        color: metrics.overdueTickets > 0 ? 'red' : 'green',
        change: -12.3,
        changeType: 'decrease',
      },
      {
        id: 'technician-utilization',
        title: 'Team Utilization',
        value: metrics.technicianUtilization,
        format: 'percentage',
        color: metrics.technicianUtilization > 90 ? 'red' : metrics.technicianUtilization > 75 ? 'yellow' : 'green',
        change: 3.7,
        changeType: 'increase',
      },
      {
        id: 'resolved-tickets',
        title: 'Resolved Today',
        value: metrics.resolvedTickets,
        format: 'number',
        color: 'green',
        change: 12.8,
        changeType: 'increase',
      },
    ];
  }, [metrics]);

  // Mock category distribution data (would come from API in real implementation)
  const categoryData: CategoryDistribution[] = useMemo(() => [
    { category: 'software', count: 45, percentage: 35.2, color: '#3b82f6' },
    { category: 'hardware', count: 32, percentage: 25.0, color: '#10b981' },
    { category: 'network', count: 28, percentage: 21.9, color: '#f59e0b' },
    { category: 'security', count: 15, percentage: 11.7, color: '#ef4444' },
    { category: 'access', count: 8, percentage: 6.2, color: '#8b5cf6' },
  ], []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <RealTimeIndicator 
          isConnected={isConnected} 
          lastUpdate={new Date()} 
        />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.slice(0, 4).map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={metricsLoading} />
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.slice(4).map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={metricsLoading} />
        ))}
      </div>

      {/* Charts and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TicketTrendsChart data={trends || []} isLoading={trendsLoading} />
        <CategoryDistributionChart data={categoryData} isLoading={false} />
      </div>

      {/* SLA Alerts */}
      <div className="mb-8">
        <SLAAlertPanel alerts={alerts || []} isLoading={alertsLoading} />
      </div>
    </div>
  );
}