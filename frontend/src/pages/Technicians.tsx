import { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  useTechnicians, 
  useCreateTechnician, 
  useUpdateTechnician, 
  useDeleteTechnician,
  useUpdateTechnicianStatus,
  type Technician,
  type CreateTechnicianData,
  type UpdateTechnicianData
} from '../hooks/useTechnicians';
import toast from 'react-hot-toast';

// Form data interfaces
interface TechnicianFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  specialties: string[];
  maxCapacity: number;
}

const statusColors = {
  available: 'bg-green-100 text-green-800 border-green-200',
  busy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  offline: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusIcons = {
  available: CheckCircle,
  busy: Clock,
  offline: AlertTriangle,
};

export function Technicians() {
  // API hooks
  const { data: technicians = [], isLoading, error, refetch } = useTechnicians();
  const createTechnicianMutation = useCreateTechnician();
  const updateTechnicianMutation = useUpdateTechnician();
  const deleteTechnicianMutation = useDeleteTechnician();
  const updateStatusMutation = useUpdateTechnicianStatus();

  // Local state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [formData, setFormData] = useState<TechnicianFormData>({
    name: '',
    email: '',
    phone: '',
    department: '',
    location: '',
    specialties: [],
    maxCapacity: 10
  });

  // Form handlers
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: '',
      location: '',
      specialties: [],
      maxCapacity: 10
    });
  };

  const handleAddTechnician = () => {
    setEditingTechnician(null);
    resetForm();
    setShowAddModal(true);
  };

  const handleEditTechnician = (technician: Technician) => {
    setEditingTechnician(technician);
    setFormData({
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      department: technician.department,
      location: technician.location,
      specialties: technician.specialties,
      maxCapacity: technician.maxCapacity
    });
    setShowEditModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.department) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingTechnician) {
        await updateTechnicianMutation.mutateAsync({
          id: editingTechnician.id,
          data: formData
        });
        setShowEditModal(false);
      } else {
        await createTechnicianMutation.mutateAsync(formData);
        setShowAddModal(false);
      }
      resetForm();
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  const handleDeleteTechnician = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      try {
        await deleteTechnicianMutation.mutateAsync(id);
      } catch (error) {
        // Error handling is done in the mutation hook
      }
    }
  };

  const handleStatusChange = async (id: string, status: 'available' | 'busy' | 'offline') => {
    try {
      await updateStatusMutation.mutateAsync({ id, status });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleSpecialtyChange = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  // Filtering logic
  const filteredTechnicians = technicians.filter(tech => {
    const matchesSearch = tech.name.toLowerCase().includes(search.toLowerCase()) ||
                         tech.email.toLowerCase().includes(search.toLowerCase()) ||
                         tech.department.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || tech.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || tech.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getUtilizationColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const departments = [...new Set(technicians.map(t => t.department))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Technicians</h1>
          <p className="text-gray-600 mt-1">Manage technician profiles and assignments</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Failed to load technicians. Using offline data.
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleAddTechnician}
            disabled={createTechnicianMutation.isLoading}
            className="btn-primary"
          >
            {createTechnicianMutation.isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Add Technician
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Technicians</p>
              <p className="text-2xl font-semibold text-gray-900">{technicians.length}</p>
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
              <p className="text-2xl font-semibold text-gray-900">
                {technicians.filter(t => t.status === 'available').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Busy</p>
              <p className="text-2xl font-semibold text-gray-900">
                {technicians.filter(t => t.status === 'busy').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Offline</p>
              <p className="text-2xl font-semibold text-gray-900">
                {technicians.filter(t => t.status === 'offline').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search technicians..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
          
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-600">Loading technicians...</span>
        </div>
      )}

      {/* Technicians Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTechnicians.map((technician) => {
          const StatusIcon = statusIcons[technician.status];
          
          return (
            <div key={technician.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-primary-600 flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{technician.name}</h3>
                    <p className="text-sm text-gray-500">{technician.department}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={technician.status}
                    onChange={(e) => handleStatusChange(technician.id, e.target.value as any)}
                    disabled={updateStatusMutation.isLoading}
                    className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${statusColors[technician.status]} focus:ring-2 focus:ring-primary-500 focus:border-primary-500`}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                  {updateStatusMutation.isLoading && (
                    <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {technician.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {technician.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  {technician.location}
                </div>
              </div>

              {/* Workload */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Current Workload</span>
                  <span className="font-medium">{technician.currentTickets}/{technician.maxCapacity}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getUtilizationColor(technician.currentTickets, technician.maxCapacity)}`}
                    style={{ width: `${Math.min((technician.currentTickets / technician.maxCapacity) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Specialties */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Specialties</p>
                <div className="flex flex-wrap gap-1">
                  {technician.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{technician.totalResolved}</p>
                  <p className="text-xs text-gray-500">Resolved</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{technician.averageResolutionTime}h</p>
                  <p className="text-xs text-gray-500">Avg Time</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{technician.slaCompliance}%</p>
                  <p className="text-xs text-gray-500">SLA</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200">
                <button 
                  onClick={() => handleEditTechnician(technician)}
                  disabled={updateTechnicianMutation.isLoading}
                  className="flex-1 btn-secondary text-sm"
                >
                  {updateTechnicianMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Edit className="h-4 w-4 mr-1" />
                  )}
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteTechnician(technician.id, technician.name)}
                  disabled={deleteTechnicianMutation.isLoading}
                  className="btn-secondary text-sm px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deleteTechnicianMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTechnicians.length === 0 && (
        <div className="card">
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No technicians found</h3>
            <p className="text-gray-500">
              {search || statusFilter !== 'all' || departmentFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first technician to get started.'}
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Technician Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <form onSubmit={handleSubmitForm}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingTechnician ? 'Edit Technician' : 'Add New Technician'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-md"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department *
                  </label>
                  <select 
                    required
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select Department</option>
                    <option value="IT Support">IT Support</option>
                    <option value="Network Admin">Network Admin</option>
                    <option value="Security">Security</option>
                    <option value="Database">Database</option>
                    <option value="DevOps">DevOps</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter location"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.maxCapacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) || 10 }))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialties
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['Hardware', 'Software', 'Network', 'Security', 'Database', 'Cloud', 'DevOps', 'Email', 'Server', 'Infrastructure', 'Windows', 'Linux'].map(specialty => (
                    <label key={specialty} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialties.includes(specialty)}
                        onChange={() => handleSpecialtyChange(specialty)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{specialty}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createTechnicianMutation.isLoading || updateTechnicianMutation.isLoading}
                  className="btn-primary"
                >
                  {(createTechnicianMutation.isLoading || updateTechnicianMutation.isLoading) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingTechnician ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingTechnician ? 'Update Technician' : 'Add Technician'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}