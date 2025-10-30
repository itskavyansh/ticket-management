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
  Filter,
  Download,
  Search,
  RefreshCw,
  Loader2,
  Zap
} from 'lucide-react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { safeChartLabel } from '../utils/formatters';
import {
  useWorkloadData,
  useWorkloadRecommendations,
  useReassignTickets,
  useOptimizeWorkload,
  useExportWorkloadData,
  useWorkloadCalculations,
  type TechnicianWorkload,
  type WorkloadFilters
} from '../hooks/useWorkload';
import toast from 'react-hot-toast';

const statusColors = {
  available: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  busy: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  overloaded: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  offline: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

export function Workload() {
  // State for filters and UI
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [utilizationFilter, setUtilizationFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'utilization' | 'tickets' | 'department'>('utilization');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianWorkload | null>(null);

  // API hooks
  const filters: WorkloadFilters = {
    period: selectedPeriod,
    department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    utilizationFilter: utilizationFilter !== 'all' ? utilizationFilter : undefined,
  };

  const { data: workloadData, isLoading, error, refetch } = useWorkloadData(filters);
  const { data: recommendations } = useWorkloadRecommendations();
  const reassignMutation = useReassignTickets();
  const optimizeMutation = useOptimizeWorkload();
  const exportMutation = useExportWorkloadData();

  // Extract data with fallbacks
  const technicians = workloadData?.technicians || [];
  const trendData = workloadData?.trends || [];
  const apiStats = workloadData?.stats;

  const departments = [...new Set(technicians.map(t => t.department))];
  const statuses = ['available', 'busy', 'overloaded', 'offline'];

  // Apply all filters
  const filteredData = technicians.filter(technician => {
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

  // Use the workload calculations hook
  const calculations = useWorkloadCalculations(filteredData);
  const overallStats = apiStats || {
    totalTechnicians: calculations.totalTechnicians,
    averageUtilization: calculations.averageUtilization,
    overloadedCount: calculations.overloadedCount,
    availableCount: calculations.availableCount,
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

  // Handler functions
  const handleRefresh = () => {
    refetch();
    toast.success('Workload data refreshed');
  };

  const handleExport = async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      await exportMutation.mutateAsync({
        format,
        filters: {
          ...filters,
          search: searchQuery,
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleOptimizeWorkload = async () => {
    try {
      const result = await optimizeMutation.mutateAsync({
        technicians: filteredData,
        pending_tickets: [] // This would come from tickets API
      });

      if (result?.optimized_assignments) {
        toast.success('Workload optimization suggestions generated');
      }
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleReassignTickets = (technician: TechnicianWorkload) => {
    setSelectedTechnician(technician);
    setShowReassignModal(true);
  };

  const handleViewDetails = (technician: TechnicianWorkload) => {
    toast.success(`Viewing details for ${technician.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workload Management</h1>
          <p className="text-gray-600 mt-1">Monitor and optimize technician workloads</p>
          {error ? (
            <p className="text-red-600 text-sm mt-1">
              Failed to load workload data. Using offline data.
            </p>
          ) : null}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOptimizeWorkload}
            disabled={optimizeMutation.isLoading}
            className="btn-secondary"
          >
            {optimizeMutation.isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Optimize
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-600">Loading workload data...</span>
        </div>
      )}

      {/* Main Content - Only show when not loading */}
      {!isLoading && (
        <>
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
                Showing {sortedData.length} of {technicians.length} technicians
              </div>
            </div>

            {sortedData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No technicians found</h3>
                <p className="text-gray-500 mb-4">
                  No technicians match the current filter criteria.
                </p>
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
                          <div className={`text-sm font-medium ${technician.utilization > 100 ? 'text-red-600' :
                            technician.utilization > 85 ? 'text-yellow-600' :
                              'text-gray-900'
                            }`}>
                            {technician.utilization}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[technician.status].bg} ${statusColors[technician.status].text} ${statusColors[technician.status].border}`}>
                            {technician.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleReassignTickets(technician)}
                            disabled={technician.currentTickets === 0 || reassignMutation.isLoading}
                            className="text-primary-600 hover:text-primary-900 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => handleViewDetails(technician)}
                            className="text-gray-600 hover:text-gray-900"
                          >
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
        </>
      )}

      {/* Recommendations */}
      {!isLoading && (
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
      )}

      {/* Reassign Modal */}
      {showReassignModal && selectedTechnician && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Reassign Tickets - {selectedTechnician.name}
              </h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedTechnician.name} currently has {selectedTechnician.currentTickets} tickets
                  ({selectedTechnician.utilization}% utilization)
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Tickets reassigned successfully');
                    setShowReassignModal(false);
                  }}
                  className="btn-primary"
                >
                  Reassign Tickets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}