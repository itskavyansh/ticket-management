import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Download,
  Filter,
  BarChart3,
  RefreshCw,
  Loader2,
  Info
} from 'lucide-react';
import {
  useAnalyticsData,
  useCategoryAnalytics,
  useTechnicianPerformance,
  usePerformanceInsights,
  useExportAnalyticsReport,
  useAnalyticsTrends,
  type AnalyticsFilters
} from '../hooks/useAnalytics';
import toast from 'react-hot-toast';

// Component interfaces and types are now imported from hooks

export function Analytics() {
  // State for filters and UI
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('tickets');

  // API hooks
  const filters: AnalyticsFilters = {
    period: selectedPeriod,
    metric: selectedMetric
  };

  const { data: analyticsData, isLoading, error, refetch } = useAnalyticsData(filters);
  const { data: categoryData = [] } = useCategoryAnalytics(selectedPeriod);
  const { data: technicianData = [] } = useTechnicianPerformance(selectedPeriod);
  const { data: insights } = usePerformanceInsights(selectedPeriod);
  const exportMutation = useExportAnalyticsReport();

  // Extract data with fallbacks
  const timeSeriesData = analyticsData?.timeSeries || [];
  const summary = analyticsData?.summary || {
    totalTicketsResolved: 0,
    avgSlaCompliance: 0,
    avgResolutionTime: 0,
    avgCustomerSatisfaction: 0
  };

  // Calculate trends using the custom hook
  const { trends } = useAnalyticsTrends(timeSeriesData);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Handler functions
  const handleRefresh = () => {
    refetch();
    toast.success('Analytics data refreshed');
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel' = 'csv') => {
    try {
      await exportMutation.mutateAsync({
        format,
        period: selectedPeriod,
        includeCharts: true
      });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive performance insights and trends</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Period: {selectedPeriod === '7d' ? 'Last 7 days' : selectedPeriod === '30d' ? 'Last 30 days' : selectedPeriod === '90d' ? 'Last 90 days' : 'Last year'}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Metric: {selectedMetric === 'tickets' ? 'Ticket Volume' : selectedMetric === 'resolution' ? 'Resolution Time' : 'SLA Compliance'}
            </span>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Failed to load analytics data. Using offline data.
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                toast.success(`Analytics updated for ${e.target.value === '7d' ? 'last 7 days' : e.target.value === '30d' ? 'last 30 days' : e.target.value === '90d' ? 'last 90 days' : 'last year'}`);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            {isLoading && (
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exportMutation.isLoading}
            className="btn-secondary"
          >
            {exportMutation.isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Report
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-600">Loading analytics data...</span>
        </div>
      )}

      {/* Main Content - Only show when not loading */}
      {!isLoading && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tickets Resolved</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {summary.totalTicketsResolved}
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className={`flex items-center mt-2 text-sm ${trends.tickets.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trends.tickets.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {trends.tickets.value.toFixed(1)}% vs last week
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">SLA Compliance</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.avgSlaCompliance.toFixed(1)}%</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className={`flex items-center mt-2 text-sm ${trends.sla.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trends.sla.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {trends.sla.value.toFixed(1)}% vs last week
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Resolution Time</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.avgResolutionTime.toFixed(1)}h</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className={`flex items-center mt-2 text-sm ${!trends.resolutionTime.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {!trends.resolutionTime.isPositive ? <TrendingDown className="h-4 w-4 mr-1" /> : <TrendingUp className="h-4 w-4 mr-1" />}
                {trends.resolutionTime.value.toFixed(1)}% vs last week
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer Satisfaction</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.avgCustomerSatisfaction.toFixed(1)}/5</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className={`flex items-center mt-2 text-sm ${trends.satisfaction.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trends.satisfaction.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {trends.satisfaction.value.toFixed(1)}% vs last week
              </div>
            </div>
          </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Volume Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-medium text-gray-900">Ticket Volume Trends</h3>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary-600 ml-2" />}
            </div>
            <select
              value={selectedMetric}
              onChange={(e) => {
                setSelectedMetric(e.target.value);
                const metricNames = {
                  tickets: 'Ticket Volume',
                  resolution: 'Resolution Time',
                  sla: 'SLA Compliance'
                };
                toast.success(`Chart updated to show ${metricNames[e.target.value as keyof typeof metricNames]}`);
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="tickets">Tickets</option>
              <option value="resolution">Resolution Time</option>
              <option value="sla">SLA Compliance</option>
            </select>
          </div>
          
          <ResponsiveContainer width="100%" height={300} key={`${selectedPeriod}-${selectedMetric}`}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                labelFormatter={(label) => formatDate(label)}
                formatter={(value, name) => {
                  if (selectedMetric === 'tickets') {
                    return [
                      typeof value === 'number' ? value.toFixed(0) : value,
                      name === 'ticketsCreated' ? 'Created' : 'Resolved'
                    ];
                  } else if (selectedMetric === 'resolution') {
                    return [
                      typeof value === 'number' ? `${value.toFixed(1)}h` : value,
                      'Avg Resolution Time'
                    ];
                  } else if (selectedMetric === 'sla') {
                    return [
                      typeof value === 'number' ? `${value.toFixed(1)}%` : value,
                      'SLA Compliance'
                    ];
                  }
                  return [value, name];
                }}
              />
              {selectedMetric === 'tickets' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="ticketsCreated"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    name="ticketsCreated"
                  />
                  <Area
                    type="monotone"
                    dataKey="ticketsResolved"
                    stackId="2"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    name="ticketsResolved"
                  />
                </>
              )}
              {selectedMetric === 'resolution' && (
                <Area
                  type="monotone"
                  dataKey="avgResolutionTime"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  name="avgResolutionTime"
                />
              )}
              {selectedMetric === 'sla' && (
                <Area
                  type="monotone"
                  dataKey="slaCompliance"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  name="slaCompliance"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Performance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-medium text-gray-900">Category Performance</h3>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary-600 ml-2" />}
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300} key={`category-${selectedPeriod}`}>
            <BarChart data={categoryData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis 
                dataKey="category" 
                type="category" 
                stroke="#6b7280" 
                fontSize={12}
                width={80}
              />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'count' ? 'Tickets' : name
                ]}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Compliance Trend */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">SLA Compliance Trend</h3>
          <ResponsiveContainer width="100%" height={200} key={`sla-${selectedPeriod}`}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={10}
              />
              <YAxis 
                domain={[85, 100]}
                stroke="#6b7280" 
                fontSize={10}
              />
              <Tooltip 
                labelFormatter={(label) => formatDate(label)}
                formatter={(value) => [`${value}%`, 'SLA Compliance']}
              />
              <Line
                type="monotone"
                dataKey="slaCompliance"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Resolution Time Distribution */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resolution Time</h3>
          <ResponsiveContainer width="100%" height={200} key={`resolution-${selectedPeriod}`}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={10}
              />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip 
                labelFormatter={(label) => formatDate(label)}
                formatter={(value) => [`${value}h`, 'Avg Resolution Time']}
              />
              <Line
                type="monotone"
                dataKey="avgResolutionTime"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Satisfaction */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Satisfaction</h3>
          <ResponsiveContainer width="100%" height={200} key={`satisfaction-${selectedPeriod}`}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={10}
              />
              <YAxis 
                domain={[3.5, 5]}
                stroke="#6b7280" 
                fontSize={10}
              />
              <Tooltip 
                labelFormatter={(label) => formatDate(label)}
                formatter={(value) => [`${value}/5`, 'Customer Rating']}
              />
              <Line
                type="monotone"
                dataKey="customerSatisfaction"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Details Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Category Performance Details</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Resolution Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SLA Compliance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categoryData.map((category) => (
                <tr key={category.category} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <div className="text-sm font-medium text-gray-900">{category.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {category.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {category.avgResolutionTime}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      category.slaCompliance >= 95 ? 'text-green-600' :
                      category.slaCompliance >= 90 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {category.slaCompliance}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-green-600">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      +{Math.floor(Math.random() * 10 + 1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technician Performance */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Top Performing Technicians</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicianData.map((tech, index) => (
            <div key={tech.name} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-sm font-medium text-gray-900">{tech.name}</div>
                </div>
                <div className="text-xs text-gray-500">#{index + 1}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Resolved</span>
                  <span className="font-medium">{tech.ticketsResolved}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg Time</span>
                  <span className="font-medium">{tech.avgResolutionTime}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">SLA</span>
                  <span className="font-medium">{tech.slaCompliance}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rating</span>
                  <span className="font-medium">{tech.customerRating}/5</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Insights */}
      {insights && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Performance Insights</h3>
            <Info className="h-5 w-5 text-gray-400" />
          </div>

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">Recommendations</h4>
              <div className="space-y-3">
                {insights.recommendations.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${
                    rec.priority === 'high' ? 'bg-red-50 border-red-200' :
                    rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start">
                      <div className={`p-1 rounded-full mr-3 ${
                        rec.priority === 'high' ? 'bg-red-100' :
                        rec.priority === 'medium' ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        <Info className={`h-4 w-4 ${
                          rec.priority === 'high' ? 'text-red-600' :
                          rec.priority === 'medium' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h5 className={`font-medium ${
                          rec.priority === 'high' ? 'text-red-900' :
                          rec.priority === 'medium' ? 'text-yellow-900' :
                          'text-blue-900'
                        }`}>
                          {rec.title}
                        </h5>
                        <p className={`text-sm mt-1 ${
                          rec.priority === 'high' ? 'text-red-700' :
                          rec.priority === 'medium' ? 'text-yellow-700' :
                          'text-blue-700'
                        }`}>
                          {rec.description}
                        </p>
                        <p className={`text-xs mt-2 font-medium ${
                          rec.priority === 'high' ? 'text-red-800' :
                          rec.priority === 'medium' ? 'text-yellow-800' :
                          'text-blue-800'
                        }`}>
                          Impact: {rec.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          {insights.alerts && insights.alerts.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Alerts</h4>
              <div className="space-y-2">
                {insights.alerts.map((alert, index) => (
                  <div key={index} className="flex items-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mr-3" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900">{alert.message}</p>
                      <p className="text-xs text-orange-700 mt-1">Action: {alert.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}