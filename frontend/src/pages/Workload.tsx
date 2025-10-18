import { useState } from 'react';
import {
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
  Users, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  User,
  CheckCircle,
  Calendar,
  Filter,
  Download,
  Search
} from 'lucide-react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { safeChartLabel } from '../utils/formatters';

interface TechnicianWorkload {
  id: string;
  name: string;
  currentTickets: number;
  maxCapacity: number;
  utilization: number;
  status: 'available' | 'busy' | 'overloaded' | 'offline';
  avgResolutionTime: number;
  ticketsThisWeek: number;
  department: string;
}

interface WorkloadTrend {
  date: string;
  totalTickets: number;
  assignedTickets: number;
  completedTickets: number;
  utilization: number;
}

const mockWorkloadData: TechnicianWorkload[] = [
  {
    id: 'tech-1',
    name: 'Rajesh Kumar',
    currentTickets: 8,
    maxCapacity: 10,
    utilization: 80,
    status: 'busy',
    avgResolutionTime: 2.4,
    ticketsThisWeek: 15,
    department: 'IT Support'
  },
  {
    id: 'tech-2',
    name: 'Priya Sharma',
    currentTickets: 12,
    maxCapacity: 10,
    utilization: 120,
    status: 'overloaded',
    avgResolutionTime: 1.8,
    ticketsThisWeek: 22,
    department: 'IT Support'
  },
  {
    id: 'tech-3',
    name: 'Amit Patel',
    currentTickets: 5,
    maxCapacity: 12,
    utilization: 42,
    status: 'available',
    avgResolutionTime: 3.2,
    ticketsThisWeek: 8,
    department: 'Network Admin'
  },
  {
    id: 'tech-4',
    name: 'Sneha Reddy',
    currentTickets: 0,
    maxCapacity: 6,
    utilization: 0,
    status: 'offline',
    avgResolutionTime: 4.1,
    ticketsThisWeek: 0,
    department: 'Security'
  },
  {
    id: 'tech-5',
    name: 'Vikram Singh',
    currentTickets: 7,
    maxCapacity: 8,
    utilization: 88,
    status: 'busy',
    avgResolutionTime: 2.1,
    ticketsThisWeek: 12,
    department: 'IT Support'
  },
  {
    id: 'tech-6',
    name: 'Kavya Nair',
    currentTickets: 4,
    maxCapacity: 8,
    utilization: 50,
    status: 'available',
    avgResolutionTime: 2.8,
    ticketsThisWeek: 9,
    department: 'Network Admin'
  }
];

const mockTrendData: WorkloadTrend[] = [
  { date: '2024-01-08', totalTickets: 45, assignedTickets: 42, completedTickets: 38, utilization: 75 },
  { date: '2024-01-09', totalTickets: 52, assignedTickets: 48, completedTickets: 41, utilization: 82 },
  { date: '2024-01-10', totalTickets: 38, assignedTickets: 35, completedTickets: 47, utilization: 68 },
  { date: '2024-01-11', totalTickets: 61, assignedTickets: 58, completedTickets: 39, utilization: 95 },
  { date: '2024-01-12', totalTickets: 43, assignedTickets: 40, completedTickets: 55, utilization: 71 },
  { date: '2024-01-13', totalTickets: 29, assignedTickets: 27, completedTickets: 31, utilization: 58 },
  { date: '2024-01-14', totalTickets: 48, assignedTickets: 45, completedTickets: 42, utilization: 78 },
];

const statusColors = {
  available: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  busy: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  overloaded: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  offline: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

export function Workload() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [utilizationFilter, setUtilizationFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'utilization' | 'tickets' | 'department'>('utilization');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  const workloadData = mockWorkloadData;
  const trendData = mockTrendData;

  const departments = [...new Set(workloadData.map(t => t.department))];
  const statuses = ['available', 'busy', 'overloaded', 'offline'];
  
  // Apply all filters
  const filteredData = workloadData.filter(technician => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = technician.name.toLowerCase().includes(query);
      const matchesDepartment = technician.department.toLowerCase().includes(query);
      if (!matchesName && !matchesDepartment) {
        return false;
      }
    }
    
    // Department filter
    if (selectedDepartment !== 'all' && technician.department !== selectedDepartment) {
      return false;
    }
    
    // Status filter
    if (selectedStatus !== 'all' && technician.status !== selectedStatus) {
      return false;
    }
    
    // Utilization filter
    if (utilizationFilter !== 'all') {
      switch (utilizationFilter) {
        case 'under-utilized':
          if (technician.utilization > 50) return false;
          break;
        case 'optimal':
          if (technician.utilization <= 50 || technician.utilization > 85) return false;
          break;
        case 'high':
          if (technician.utilization <= 85 || technician.utilization > 100) return false;
          break;
        case 'overloaded':
          if (technician.utilization <= 100) return false;
          break;
      }
    }
    
    return true;
  });

  // Apply sorting
  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'utilization':
        aValue = a.utilization;
        bValue = b.utilization;
        break;
      case 'tickets':
        aValue = a.currentTickets;
        bValue = b.currentTickets;
        break;
      case 'department':
        aValue = a.department.toLowerCase();
        bValue = b.department.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const overallStats = {
    totalTechnicians: filteredData.length,
    averageUtilization: filteredData.length > 0 ? Math.round(filteredData.reduce((sum, t) => sum + t.utilization, 0) / filteredData.length) : 0,
    overloadedCount: filteredData.filter(t => t.utilization > 100).length,
    availableCount: filteredData.filter(t => t.status === 'available').length,
  };

  const utilizationDistribution = [
    { name: 'Under-utilized (0-50%)', value: filteredData.filter(t => t.utilization <= 50).length, color: '#10b981' },
    { name: 'Optimal (51-85%)', value: filteredData.filter(t => t.utilization > 50 && t.utilization <= 85).length, color: '#3b82f6' },
    { name: 'High (86-100%)', value: filteredData.filter(t => t.utilization > 85 && t.utilization <= 100).length, color: '#f59e0b' },
    { name: 'Overloaded (>100%)', value: filteredData.filter(t => t.utilization > 100).length, color: '#ef4444' },
  ];

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 85) return 'bg-yellow-500';
    if (utilization > 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workload Management</h1>
          <p className="text-gray-600 mt-1">Monitor and optimize technician workloads</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search technicians by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          
          <select
            value={utilizationFilter}
            onChange={(e) => setUtilizationFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Utilization</option>
            <option value="under-utilized">Under-utilized (0-50%)</option>
            <option value="optimal">Optimal (51-85%)</option>
            <option value="high">High (86-100%)</option>
            <option value="overloaded">Overloaded (&gt;100%)</option>
          </select>
          
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          {/* Clear Filters Button */}
          {(selectedDepartment !== 'all' || selectedStatus !== 'all' || utilizationFilter !== 'all' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedStatus('all');
                setUtilizationFilter('all');
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
            >
              Clear Filters
            </button>
          )}
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="utilization">Utilization</option>
              <option value="name">Name</option>
              <option value="tickets">Current Tickets</option>
              <option value="department">Department</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          
          <button className="btn-secondary text-sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(selectedDepartment !== 'all' || selectedStatus !== 'all' || utilizationFilter !== 'all' || searchQuery.trim()) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Active Filters:</span>
              <div className="flex items-center space-x-2">
                {searchQuery.trim() && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Search: "{searchQuery}"
                  </span>
                )}
                {selectedDepartment !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Department: {selectedDepartment}
                  </span>
                )}
                {selectedStatus !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Status: {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                  </span>
                )}
                {utilizationFilter !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Utilization: {utilizationFilter.replace('-', ' ')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedStatus('all');
                setUtilizationFilter('all');
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Technicians</p>
              <p className="text-2xl font-semibold text-gray-900">{overallStats.totalTechnicians}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Utilization</p>
              <p className="text-2xl font-semibold text-gray-900">{overallStats.averageUtilization}%</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Overloaded</p>
              <p className="text-2xl font-semibold text-gray-900">{overallStats.overloadedCount}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-gray-900">{overallStats.availableCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Workload Trends</h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Assigned</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Completed</span>
              </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                formatter={(value, name) => [value, name === 'assignedTickets' ? 'Assigned' : 'Completed']}
                labelFormatter={(label) => formatDate(label)}
              />
              <Bar dataKey="assignedTickets" fill="#3b82f6" name="assignedTickets" />
              <Bar dataKey="completedTickets" fill="#10b981" name="completedTickets" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Utilization Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Utilization Distribution</h3>
          </div>
          
          <div className="flex items-center">
            <div className="w-2/3">
              <ErrorBoundary fallback={
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <p>Unable to load chart</p>
                </div>
              }>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={utilizationDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={safeChartLabel}
                    >
                      {utilizationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ErrorBoundary>
            </div>
            
            <div className="w-1/3 pl-4">
              <div className="space-y-2">
                {utilizationDistribution.map((item, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-gray-500">{item.value} technicians</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technician Workload Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Individual Workloads</h3>
          <div className="text-sm text-gray-500">
            Showing {sortedData.length} of {workloadData.length} technicians
            {sortedData.length !== workloadData.length && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                Filtered
              </span>
            )}
          </div>
        </div>

        {sortedData.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No technicians found</h3>
            <p className="text-gray-500 mb-4">
              No technicians match the current filter criteria.
            </p>
            <button
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedStatus('all');
                setUtilizationFilter('all');
                setSearchQuery('');
              }}
              className="btn-secondary"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Technician
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Load
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  This Week
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Resolution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((technician) => (
                <tr key={technician.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-sm font-medium text-gray-900">{technician.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {technician.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {technician.currentTickets}/{technician.maxCapacity}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${getUtilizationColor(technician.utilization)}`}
                        style={{ width: `${Math.min(technician.utilization, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      technician.utilization > 100 ? 'text-red-600' :
                      technician.utilization > 85 ? 'text-yellow-600' :
                      'text-gray-900'
                    }`}>
                      {technician.utilization}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {technician.ticketsThisWeek}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {technician.avgResolutionTime}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[technician.status].bg} ${statusColors[technician.status].text} ${statusColors[technician.status].border}`}>
                      {technician.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-3">
                      Reassign
                    </button>
                    <button className="text-gray-600 hover:text-gray-900">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">AI Recommendations</h3>
        <div className="space-y-3">
          {overallStats.overloadedCount > 0 && (
            <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {overallStats.overloadedCount} technician{overallStats.overloadedCount > 1 ? 's are' : ' is'} overloaded
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Consider redistributing tickets or hiring additional staff.
                </p>
              </div>
            </div>
          )}
          
          {overallStats.availableCount > 0 && (
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {overallStats.availableCount} technician{overallStats.availableCount > 1 ? 's are' : ' is'} available for new assignments
                </p>
                <p className="text-sm text-green-700 mt-1">
                  These technicians can take on additional tickets.
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Overall team utilization is {overallStats.averageUtilization}%
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {overallStats.averageUtilization < 70 
                  ? 'Team has capacity for more tickets.'
                  : overallStats.averageUtilization > 90
                  ? 'Team is operating at high capacity.'
                  : 'Team utilization is optimal.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}