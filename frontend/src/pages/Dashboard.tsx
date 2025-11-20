import { useMemo, useState } from 'react';
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
  useCategoryAnalytics 
} from '../hooks/useAnalytics';
import { useWorkloadData } from '../hooks/useWorkload';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { DashboardKPI, CategoryDistribution } from '../types/analytics';

export function Dashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const { isConnected } = useRealTimeData();
  
  // Use individual analytics hooks
  const { data: metrics, isLoading: metricsLoading, refetch: refreshMetrics } = useDashboardMetrics();
  const { data: alerts, isLoading: alertsLoading } = useSLAAlerts();
  const { data: trends, isLoading: trendsLoading } = useTicketTrends(timeRange);
  const { data: categoryDistribution, isLoading: categoryLoading } = useCategoryAnalytics(timeRange);
  
  const { 
    data: workloadData, 
    isLoading: workloadLoading 
  } = useWorkloadData();

  // Mock breach predictions for dashboard
  const breachPredictions = [
    {
      ticketId: 'TKT-006',
      riskScore: 0.85,
      timeToBreachHours: 3.5,
      reason: 'Complex technical issue with limited expertise available',
    },
    {
      ticketId: 'TKT-007',
      riskScore: 0.72,
      timeToBreachHours: 8.2,
      reason: 'Waiting for customer response, historical delays likely',
    },
  ];

  // Calculate trends from historical data
  const calculateTrend = (trendData: any[], key: string) => {
    if (!trendData || trendData.length < 2) {
      console.log(`No trend data for ${key}:`, trendData?.length || 0, 'items');
      return { change: 0, changeType: 'neutral' as const };
    }
    
    // Get last 7 days and previous 7 days for comparison
    const recentData = trendData.slice(-7);
    const previousData = trendData.slice(-14, -7);
    
    if (recentData.length === 0 || previousData.length === 0) {
      console.log(`Insufficient data for ${key}:`, { recent: recentData.length, previous: previousData.length });
      return { change: 0, changeType: 'neutral' as const };
    }
    
    const recentAvg = recentData.reduce((sum, item) => sum + (item[key] || 0), 0) / recentData.length;
    const previousAvg = previousData.reduce((sum, item) => sum + (item[key] || 0), 0) / previousData.length;
    
    if (previousAvg === 0) return { change: 0, changeType: 'neutral' as const };
    
    const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100;
    const changeType = percentChange > 0 ? 'increase' as const : percentChange < 0 ? 'decrease' as const : 'neutral' as const;
    
    console.log(`Trend for ${key}:`, { recentAvg, previousAvg, percentChange: percentChange.toFixed(1), changeType });
    
    return { change: Math.abs(percentChange), changeType };
  };

  // Transform metrics data into KPI widgets
  const kpis: DashboardKPI[] = useMemo(() => {
    // Provide default metrics if API data is not available
    const defaultMetrics = {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0,
      slaCompliance: 0,
      averageResolutionTime: 0,
      criticalTickets: 0,
      overdueTickets: 0,
      technicianUtilization: 0
    };
    
    const currentMetrics = metrics || defaultMetrics;
    
    // Calculate resolved today (use resolvedTickets as approximation)
    const resolvedToday = currentMetrics.resolvedTickets || 0;

    const avgUtilization = workloadData?.technicians?.reduce((sum, tech) => sum + tech.utilization, 0) / (workloadData?.technicians?.length || 1) || 0;

    // Calculate trends from trend data
    const totalTicketsTrend = calculateTrend(trends || [], 'created');
    const openTicketsTrend = calculateTrend(trends || [], 'open');
    const resolvedTicketsTrend = calculateTrend(trends || [], 'resolved');

    return [
      {
        id: 'total-tickets',
        title: 'Total Tickets',
        value: currentMetrics.totalTickets,
        format: 'number',
        color: 'blue',
        change: totalTicketsTrend.change,
        changeType: totalTicketsTrend.changeType,
      },
      {
        id: 'open-tickets',
        title: 'Open Tickets',
        value: currentMetrics.openTickets,
        format: 'number',
        color: 'yellow',
        change: openTicketsTrend.change,
        changeType: openTicketsTrend.changeType,
      },
      {
        id: 'sla-compliance',
        title: 'SLA Compliance',
        value: currentMetrics.slaCompliance,
        format: 'percentage',
        color: currentMetrics.slaCompliance >= 95 ? 'green' : currentMetrics.slaCompliance >= 90 ? 'yellow' : 'red',
        change: 0,
        changeType: 'neutral',
      },
      {
        id: 'avg-resolution-time',
        title: 'Avg Resolution Time',
        value: currentMetrics.averageResolutionTime,
        format: 'duration',
        color: 'gray',
        change: 0,
        changeType: 'neutral',
      },
      {
        id: 'critical-tickets',
        title: 'Critical Tickets',
        value: currentMetrics.criticalTickets,
        format: 'number',
        color: currentMetrics.criticalTickets > 0 ? 'red' : 'green',
        change: 0,
        changeType: 'neutral',
      },
      {
        id: 'overdue-tickets',
        title: 'Overdue Tickets',
        value: currentMetrics.overdueTickets,
        format: 'number',
        color: currentMetrics.overdueTickets > 0 ? 'red' : 'green',
        change: 0,
        changeType: 'neutral',
      },
      {
        id: 'technician-utilization',
        title: 'Team Utilization',
        value: avgUtilization,
        format: 'percentage',
        color: avgUtilization > 90 ? 'red' : avgUtilization > 75 ? 'yellow' : 'green',
        change: 0,
        changeType: 'neutral',
      },
      {
        id: 'resolved-tickets',
        title: 'Resolved Today',
        value: resolvedToday,
        format: 'number',
        color: 'green',
        change: resolvedTicketsTrend.change,
        changeType: resolvedTicketsTrend.changeType,
      },
    ];
  }, [metrics, workloadData, trends]);

  // Enhanced loading state
  const isLoading = metricsLoading || workloadLoading || alertsLoading || trendsLoading || categoryLoading;

  // Refresh function
  const refreshData = () => {
    refreshMetrics();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">Real-time IT support metrics and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <RealTimeIndicator 
            isConnected={isConnected} 
            lastUpdate={new Date()} 
          />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts && alerts.filter(alert => alert.severity === 'critical').length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
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

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.slice(0, 4).map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={isLoading} />
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.slice(4).map((kpi) => (
          <KPIWidget key={kpi.id} kpi={kpi} isLoading={isLoading} />
        ))}
      </div>

      {/* Charts and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TicketTrendsChart data={trends || []} isLoading={isLoading} />
        <CategoryDistributionChart data={categoryDistribution || []} isLoading={isLoading} />
      </div>

      {/* SLA Alerts */}
      <div className="mb-8">
        <SLAAlertPanel alerts={alerts || []} isLoading={isLoading} />
      </div>

      {/* Breach Predictions */}
      {breachPredictions && breachPredictions.length > 0 && (
        <div className="mb-8">
          <div className="card-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">SLA Breach Predictions</h3>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                {breachPredictions.length} At Risk
              </span>
            </div>
            <div className="space-y-2">
              {breachPredictions.slice(0, 5).map((prediction) => (
                <div key={prediction.ticketId} className="flex items-center justify-between p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Ticket #{prediction.ticketId}
                    </p>
                    <p className="text-sm text-gray-600">
                      Predicted breach in {Math.round(prediction.timeToBreachHours)} hours
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-yellow-800">
                      {Math.round(prediction.riskScore * 100)}% Risk
                    </p>
                    <p className="text-xs text-gray-500">
                      {prediction.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-elevated">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors">
              Create New Ticket
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors">
              Assign Bulk Tickets
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors">
              Generate Report
            </button>
          </div>
        </div>

        <div className="card-elevated">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Top Performers</h3>
          <div className="space-y-3">
            {workloadData?.technicians?.slice(0, 3).map((tech, index) => (
              <div key={tech.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900">{tech.name}</span>
                </div>
                <span className="text-sm text-gray-600">{tech.resolvedTickets} resolved</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">System Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-700">API Status</span>
              </div>
              <span className="text-xs text-green-600 font-medium">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-700">Database</span>
              </div>
              <span className="text-xs text-green-600 font-medium">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-700">AI Service</span>
              </div>
              <span className="text-xs text-green-600 font-medium">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}