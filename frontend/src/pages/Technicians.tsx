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
  UserPlus
} from 'lucide-react';

interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  status: 'available' | 'busy' | 'offline';
  currentTickets: number;
  maxCapacity: number;
  specialties: string[];
  averageResolutionTime: number;
  slaCompliance: number;
  totalResolved: number;
  joinedDate: string;
  avatar?: string;
}

const mockTechnicians: Technician[] = [
  {
    id: 'tech-1',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@techsolutions.in',
    phone: '+91 98765 43210',
    department: 'IT Support',
    location: 'Bangalore Office',
    status: 'available',
    currentTickets: 5,
    maxCapacity: 10,
    specialties: ['Hardware', 'Network', 'Windows'],
    averageResolutionTime: 2.4,
    slaCompliance: 96.5,
    totalResolved: 342,
    joinedDate: '2023-01-15'
  },
  {
    id: 'tech-2',
    name: 'Priya Sharma',
    email: 'priya.sharma@techsolutions.in',
    phone: '+91 87654 32109',
    department: 'IT Support',
    location: 'Mumbai Office',
    status: 'busy',
    currentTickets: 8,
    maxCapacity: 8,
    specialties: ['Software', 'Email', 'Security'],
    averageResolutionTime: 1.8,
    slaCompliance: 98.2,
    totalResolved: 456,
    joinedDate: '2022-08-20'
  },
  {
    id: 'tech-3',
    name: 'Amit Patel',
    email: 'amit.patel@techsolutions.in',
    phone: '+91 76543 21098',
    department: 'Network Admin',
    location: 'Pune Office',
    status: 'available',
    currentTickets: 3,
    maxCapacity: 12,
    specialties: ['Network', 'Server', 'Infrastructure'],
    averageResolutionTime: 3.2,
    slaCompliance: 94.8,
    totalResolved: 289,
    joinedDate: '2023-03-10'
  },
  {
    id: 'tech-4',
    name: 'Sneha Reddy',
    email: 'sneha.reddy@techsolutions.in',
    phone: '+91 65432 10987',
    department: 'Security',
    location: 'Hyderabad Office',
    status: 'offline',
    currentTickets: 0,
    maxCapacity: 6,
    specialties: ['Security', 'Compliance', 'Access Control'],
    averageResolutionTime: 4.1,
    slaCompliance: 92.3,
    totalResolved: 178,
    joinedDate: '2023-06-01'
  },
  {
    id: 'tech-5',
    name: 'Vikram Singh',
    email: 'vikram.singh@techsolutions.in',
    phone: '+91 54321 09876',
    department: 'IT Support',
    location: 'Delhi Office',
    status: 'busy',
    currentTickets: 7,
    maxCapacity: 10,
    specialties: ['Database', 'Cloud', 'DevOps'],
    averageResolutionTime: 2.8,
    slaCompliance: 95.1,
    totalResolved: 267,
    joinedDate: '2022-11-12'
  },
  {
    id: 'tech-6',
    name: 'Kavya Nair',
    email: 'kavya.nair@techsolutions.in',
    phone: '+91 43210 98765',
    department: 'Network Admin',
    location: 'Chennai Office',
    status: 'available',
    currentTickets: 4,
    maxCapacity: 8,
    specialties: ['Networking', 'Firewall', 'VPN'],
    averageResolutionTime: 2.1,
    slaCompliance: 97.3,
    totalResolved: 198,
    joinedDate: '2023-04-18'
  }
];

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
  const [technicians] = useState<Technician[]>(mockTechnicians);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

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
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Technician
        </button>
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

      {/* Technicians Grid */}
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[technician.status]}`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {technician.status}
                  </span>
                  <button className="p-1 rounded-full hover:bg-gray-100">
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>
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
                <button className="flex-1 btn-secondary text-sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button className="btn-secondary text-sm px-3">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTechnicians.length === 0 && (
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

      {/* Add Technician Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Technician</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="email"
                placeholder="Email Address"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <select className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500">
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button className="btn-primary">
                  Add Technician
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}