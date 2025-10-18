import { User, Mail, Shield, Calendar } from 'lucide-react'

export function Profile() {
  // Mock user data - in real app this would come from auth context
  const user = {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@techsolutions.in',
    role: 'IT Manager',
    department: 'IT Operations',
    joinDate: '2023-01-15',
    lastLogin: '2024-01-15 14:30:00',
    permissions: ['View All Tickets', 'Manage Technicians', 'View Analytics', 'System Settings']
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center mb-6">
              <div className="h-16 w-16 rounded-full bg-primary-600 flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
                <p className="text-gray-600">{user.role} • {user.department}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Role</p>
                  <p className="text-sm text-gray-600">{user.role}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Join Date</p>
                  <p className="text-sm text-gray-600">{new Date(user.joinDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button className="btn-primary">
                Edit Profile
              </button>
            </div>
          </div>
        </div>
        
        {/* Permissions & Activity */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Permissions</h3>
            <div className="space-y-2">
              {user.permissions.map((permission, index) => (
                <div key={index} className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-3"></div>
                  <span className="text-sm text-gray-600">{permission}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Activity</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Last Login</p>
                <p className="text-sm text-gray-600">{new Date(user.lastLogin).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Session Status</p>
                <div className="flex items-center mt-1">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm text-green-600">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}