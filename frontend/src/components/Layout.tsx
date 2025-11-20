import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Ticket, 
  BarChart3, 
  Settings,
  Menu,
  X,
  User,
  LogOut,
  Bell,
  Search,
  Users,
  Clock,
  AlertTriangle,
  Plus,
  ChevronRight,
  Home,
  HelpCircle,
  Keyboard,
  Shield
} from 'lucide-react'
import { useState } from 'react'
import { GlobalSearch } from './common/GlobalSearch'
import { NotificationCenter } from './common/NotificationCenter'
import { KeyboardShortcuts } from './common/KeyboardShortcuts'
import { HelpModal } from './common/HelpModal'
import { SystemStatus } from './common/SystemStatus'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Technicians', href: '/technicians', icon: Users },
  { name: 'Workload', href: '/workload', icon: Clock },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'SLA Monitor', href: '/sla', icon: AlertTriangle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const quickActionsRef = useRef<HTMLDivElement>(null)
  
  // Mock user data - in real app this would come from auth context
  const user = {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@techsolutions.in',
    role: 'IT Manager',
    avatar: null
  }

  // Generate breadcrumbs based on current path
  const getBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs = [{ name: 'Home', href: '/', icon: Home }]
    
    let currentPath = ''
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      const navItem = navigation.find(item => item.href === currentPath)
      if (navItem) {
        breadcrumbs.push({
          name: navItem.name,
          href: currentPath,
          icon: navItem.icon
        })
      } else {
        // Handle dynamic routes like /tickets/123
        const capitalizedSegment = segment.charAt(0).toUpperCase() + segment.slice(1)
        breadcrumbs.push({
          name: capitalizedSegment,
          href: currentPath,
          icon: Ticket // Default icon
        })
      }
    })
    
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  // Quick actions menu items
  const quickActions = [
    { name: 'New Ticket', href: '/tickets/new', icon: Ticket, color: 'bg-blue-500' },
    { name: 'Add Technician', href: '/technicians/new', icon: Users, color: 'bg-green-500' },
    { name: 'View Analytics', href: '/analytics', icon: BarChart3, color: 'bg-purple-500' },
    { name: 'SLA Monitor', href: '/sla', icon: AlertTriangle, color: 'bg-red-500' },
  ]



  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setQuickActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd/Ctrl + K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      
      // Cmd/Ctrl + Shift + A to open quick actions
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        setQuickActionsOpen(!quickActionsOpen)
      }
      
      // Cmd/Ctrl + Shift + N to open notifications
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'N') {
        event.preventDefault()
        setNotificationsOpen(!notificationsOpen)
      }
      

      
      // ? to show keyboard shortcuts
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setKeyboardShortcutsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [quickActionsOpen, notificationsOpen])

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center mr-3">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">ResolveIQ</h1>
            </div>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1 px-3 py-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                Main
              </div>
              {navigation.slice(0, 2).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            
            <div className="space-y-1 pt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                Management
              </div>
              {navigation.slice(2, 6).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            
            <div className="space-y-1 pt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                System
              </div>
              {navigation.slice(6).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>
          
          {/* User info at bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center mr-3">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-base font-semibold text-gray-900">ResolveIQ</h1>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1 px-3 py-4">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Main
              </div>
              {navigation.slice(0, 2).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            
            <div className="space-y-0.5 pt-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                Management
              </div>
              {navigation.slice(2, 6).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
            
            <div className="space-y-0.5 pt-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                System
              </div>
              {navigation.slice(6).map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>
          
          {/* User info at bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            {/* Search bar */}
            <div className="flex flex-1 items-center">
              <div className="relative w-full max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search tickets, technicians..."
                  onClick={() => setSearchOpen(true)}
                  className="block w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  readOnly
                />
              </div>
            </div>
            
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Quick Actions */}
              <div className="relative" ref={quickActionsRef}>
                <button
                  onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-1.5"
                  title="Quick Actions (Ctrl+Shift+A)"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">New</span>
                </button>
                
                {/* Quick Actions Menu */}
                {quickActionsOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">Quick Actions</p>
                    </div>
                    {quickActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <Link
                          key={action.name}
                          to={action.href}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setQuickActionsOpen(false)}
                        >
                          <div className={`p-1 rounded ${action.color} mr-3`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          {action.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* System Status */}
              <SystemStatus />



              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative rounded-full bg-white p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                    3
                  </span>
                </button>
                <NotificationCenter 
                  isOpen={notificationsOpen} 
                  onClose={() => setNotificationsOpen(false)} 
                />
              </div>
              
              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  className="flex items-center gap-x-2 rounded-full bg-white p-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.role}</div>
                  </div>
                </button>
                
                {/* User dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">{user.role}</p>
                    </div>
                    
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="mr-3 h-4 w-4" />
                        Your Profile
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          setKeyboardShortcutsOpen(true)
                        }}
                      >
                        <Keyboard className="mr-3 h-4 w-4" />
                        Keyboard Shortcuts
                      </button>
                      <button
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          setHelpModalOpen(true)
                        }}
                      >
                        <HelpCircle className="mr-3 h-4 w-4" />
                        Help & Support
                      </button>
                    </div>
                    
                    <div className="border-t border-gray-100 py-1">
                      <button
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          // Show privacy settings
                        }}
                      >
                        <Shield className="mr-3 h-4 w-4" />
                        Privacy & Security
                      </button>
                      <button
                        className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          // Handle logout with confirmation
                          if (confirm('Are you sure you want to sign out?')) {
                            // Perform logout
                            console.log('Logging out...')
                          }
                        }}
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <div className="border-b border-gray-200 bg-white px-4 lg:px-6">
            <div className="flex items-center space-x-2 py-3">
              {breadcrumbs.map((breadcrumb, idx) => {
                const Icon = breadcrumb.icon
                const isLast = idx === breadcrumbs.length - 1
                
                return (
                  <div key={breadcrumb.href} className="flex items-center">
                    {idx > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                    )}
                    {isLast ? (
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <Icon className="h-4 w-4 mr-2" />
                        {breadcrumb.name}
                      </div>
                    ) : (
                      <Link
                        to={breadcrumb.href}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {breadcrumb.name}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            {children}
          </div>
        </main>
      </div>
      
      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts 
        isOpen={keyboardShortcutsOpen} 
        onClose={() => setKeyboardShortcutsOpen(false)} 
      />
      
      {/* Help Modal */}
      <HelpModal 
        isOpen={helpModalOpen} 
        onClose={() => setHelpModalOpen(false)} 
      />
    </div>
  )
}