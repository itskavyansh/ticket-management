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
  BarChart3
} from 'lucide-react';

interface AnalyticsData {
  date: string;
  ticketsCreated: number;
  ticketsResolved: number;
  avgResolutionTime: number;
  slaCompliance: number;
  customerSatisfaction: number;
}

interface CategoryAnalytics {
  category: string;
  count: number;
  avgResolutionTime: number;
  slaCompliance: number;
  color: string;
}

interface TechnicianPerformance {
  name: string;
  ticketsResolved: number;
  avgResolutionTime: number;
  slaCompliance: number;
  customerRating: number;
}

const mockAnalyticsData: AnalyticsData[] = [
  { date: '2024-01-01', ticketsCreated: 45, ticketsResolved: 38, avgResolutionTime: 2.4, slaCompliance: 94.2, customerSatisfaction: 4.2 },
  { date: '2024-01-02', ticketsCreated: 52, ticketsResolved: 41, avgResolutionTime: 2.1, slaCompliance: 96.1, customerSatisfaction: 4.3 },
  { date: '2024-01-03', ticketsCreated: 38, ticketsResolved: 47, avgResolutionTime: 1.9, slaCompliance: 97.8, customerSatisfaction: 4.5 },
  { date: '2024-01-04', ticketsCreated: 61, ticketsResolved: 39, avgResolutionTime: 2.8, slaCompliance: 91.3, customerSatisfaction: 4.0 },
  { date: '2024-01-05', ticketsCreated: 43, ticketsResolved: 55, avgResolutionTime: 2.2, slaCompliance: 95.7, customerSatisfaction: 4.4 },
  { date: '2024-01-06', ticketsCreated: 29, ticketsResolved: 31, avgResolutionTime: 1.8, slaCompliance: 98.1, customerSatisfaction: 4.6 },
  { date: '2024-01-07', ticketsCreated: 48, ticketsResolved: 42, avgResolutionTime: 2.3, slaCompliance: 94.8, customerSatisfaction: 4.2 },
  { date: '2024-01-08', ticketsCreated: 55, ticketsResolved: 48, avgResolutionTime: 2.0, slaCompliance: 96.4, customerSatisfaction: 4.4 },
  { date: '2024-01-09', ticketsCreated: 41, ticketsResolved: 52, avgResolutionTime: 1.7, slaCompliance: 98.9, customerSatisfaction: 4.7 },
  { date: '2024-01-10', ticketsCreated: 47, ticketsResolved: 44, avgResolutionTime: 2.1, slaCompliance: 95.2, customerSatisfaction: 4.3 },
  { date: '2024-01-11', ticketsCreated: 39, ticketsResolved: 46, avgResolutionTime: 1.9, slaCompliance: 97.1, customerSatisfaction: 4.5 },
  { date: '2024-01-12', ticketsCreated: 58, ticketsResolved: 41, avgResolutionTime: 2.6, slaCompliance: 92.8, customerSatisfaction: 4.1 },
  { date: '2024-01-13', ticketsCreated: 33, ticketsResolved: 49, avgResolutionTime: 1.8, slaCompliance: 98.3, customerSatisfaction: 4.6 },
  { date: '2024-01-14', ticketsCreated: 51, ticketsResolved: 45, avgResolutionTime: 2.2, slaCompliance: 95.6, customerSatisfaction: 4.3 },
];

const mockCategoryData: CategoryAnalytics[] = [
  { category: 'Software', count: 156, avgResolutionTime: 1.8, slaCompliance: 97.2, color: '#3b82f6' },
  { category: 'Hardware', count: 89, avgResolutionTime: 3.2, slaCompliance: 92.1, color: '#10b981' },
  { category: 'Network', count: 67, avgResolutionTime: 2.9, slaCompliance: 94.8, color: '#f59e0b' },
  { category: 'Security', count: 34, avgResolutionTime: 4.1, slaCompliance: 89.3, color: '#ef4444' },
  { category: 'Email', count: 78, avgResolutionTime: 1.5, slaCompliance: 98.7, color: '#8b5cf6' },
  { category: 'Access', count: 45, avgResolutionTime: 2.1, slaCompliance: 96.4, color: '#06b6d4' },
];

const mockTechnicianData: TechnicianPerformance[] = [
  { name: 'Priya Sharma', ticketsResolved: 89, avgResolutionTime: 1.8, slaCompliance: 98.2, customerRating: 4.7 },
  { name: 'Rajesh Kumar', ticketsResolved: 76, avgResolutionTime: 2.1, slaCompliance: 96.5, customerRating: 4.5 },
  { name: 'Amit Patel', ticketsResolved: 65, avgResolutionTime: 2.8, slaCompliance: 94.8, customerRating: 4.3 },
  { name: 'Sneha Reddy', ticketsResolved: 52, avgResolutionTime: 3.2, slaCompliance: 92.3, customerRating: 4.2 },
  { name: 'Vikram Singh', ticketsResolved: 71, avgResolutionTime: 2.3, slaCompliance: 95.7, customerRating: 4.4 },
  { name: 'Kavya Nair', ticketsResolved: 58, avgResolutionTime: 2.6, slaCompliance: 93.8, customerRating: 4.3 },
];

export function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('tickets');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateTrend = (data: number[]) => {
    if (data.length < 2) return { value: 0, isPositive: true };
    const recent = data.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const previous = data.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const change = ((recent - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const ticketTrend = calculateTrend(mockAnalyticsData.map(d => d.ticketsResolved));
  const slaCompliance = mockAnalyticsData[mockAnalyticsData.length - 1].slaCompliance;
  const avgResolutionTime = mockAnalyticsData.reduce((sum, d) => sum + d.avgResolutionTime, 0) / mockAnalyticsData.length;
  const customerSatisfaction = mockAnalyticsData.reduce((sum, d) => sum + d.customerSatisfaction, 0) / mockAnalyticsData.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive performance insights and trends</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tickets Resolved</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockAnalyticsData.reduce((sum, d) => sum + d.ticketsResolved, 0)}
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className={`flex items-center mt-2 text-sm ${ticketTrend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {ticketTrend.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
            {ticketTrend.value.toFixed(1)}% vs last week
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">SLA Compliance</p>
              <p className="text-2xl font-semibold text-gray-900">{slaCompliance.toFixed(1)}%</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center mt-2 text-sm text-green-600">
            <TrendingUp className="h-4 w-4 mr-1" />
            2.3% vs last week
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Resolution Time</p>
              <p className="text-2xl font-semibold text-gray-900">{avgResolutionTime.toFixed(1)}h</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center mt-2 text-sm text-green-600">
            <TrendingDown className="h-4 w-4 mr-1" />
            8.2% vs last week
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Customer Satisfaction</p>
              <p className="text-2xl font-semibold text-gray-900">{customerSatisfaction.toFixed(1)}/5</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center mt-2 text-sm text-green-600">
            <TrendingUp className="h-4 w-4 mr-1" />
            5.1% vs last week
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Volume Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Ticket Volume Trends</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="tickets">Tickets</option>
              <option value="resolution">Resolution Time</option>
              <option value="sla">SLA Compliance</option>
            </select>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockAnalyticsData}>
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
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(1) : value,
                  name === 'ticketsCreated' ? 'Created' : 'Resolved'
                ]}
              />
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
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Performance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Category Performance</h3>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockCategoryData} layout="horizontal">
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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockAnalyticsData}>
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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockAnalyticsData}>
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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockAnalyticsData}>
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
              {mockCategoryData.map((category) => (
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
          {mockTechnicianData.map((tech, index) => (
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
    </div>
  );
}