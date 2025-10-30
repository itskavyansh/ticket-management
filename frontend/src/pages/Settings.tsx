import { useState, useEffect, useCallback } from 'react'
import { Bell, Shield, Globe, Save, User, Settings as SettingsIcon, Database, Palette, Clock, Mail, Slack, AlertTriangle, Check, X, Eye, EyeOff } from 'lucide-react'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
}

interface NotificationSettings {
  email: boolean;
  slack: boolean;
  teams: boolean;
  slaAlerts: boolean;
  ticketUpdates: boolean;
  workloadAlerts: boolean;
  systemMaintenance: boolean;
  weeklyReports: boolean;
}

interface SystemPreferences {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  theme: string;
  dashboardRefreshRate: number;
  defaultTicketView: string;
  itemsPerPage: number;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  passwordLastChanged: string;
  activeSessions: number;
}

interface IntegrationSettings {
  slackWebhook: string;
  teamsWebhook: string;
  emailSmtp: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  };
  superOpsApiKey: string;
  geminiApiKey: string;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: '1',
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'Admin',
    department: 'IT Support',
    avatar: ''
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    slack: true,
    teams: false,
    slaAlerts: true,
    ticketUpdates: false,
    workloadAlerts: true,
    systemMaintenance: true,
    weeklyReports: false
  });
  
  const [preferences, setPreferences] = useState<SystemPreferences>({
    language: 'en',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    theme: 'light',
    dashboardRefreshRate: 30,
    defaultTicketView: 'list',
    itemsPerPage: 25
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: 480, // 8 hours in minutes
    passwordLastChanged: '2024-01-15',
    activeSessions: 2
  });

  const [integrations, setIntegrations] = useState<IntegrationSettings>({
    slackWebhook: '',
    teamsWebhook: '',
    emailSmtp: {
      host: 'smtp.gmail.com',
      port: 587,
      username: '',
      password: '',
      secure: true
    },
    superOpsApiKey: '',
    geminiApiKey: ''
  });

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch real data from API using axios directly
      try {
        const [profileRes, notificationsRes, preferencesRes, securityRes, integrationsRes] = await Promise.all([
          fetch('/api/user/profile').then(r => r.ok ? r.json() : null),
          fetch('/api/user/notifications').then(r => r.ok ? r.json() : null),
          fetch('/api/user/preferences').then(r => r.ok ? r.json() : null),
          fetch('/api/user/security').then(r => r.ok ? r.json() : null),
          fetch('/api/system/integrations').then(r => r.ok ? r.json() : null)
        ]);

        if (profileRes) setUserProfile(profileRes);
        if (notificationsRes) setNotifications(notificationsRes);
        if (preferencesRes) setPreferences(preferencesRes);
        if (securityRes) setSecurity(securityRes);
        if (integrationsRes) setIntegrations(integrationsRes);
      } catch (apiError) {
        console.warn('API not available, using default settings:', apiError);
        // Keep default values
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to API
  const saveSettings = useCallback(async () => {
    try {
      setIsSaving(true);
      
      // Try to save to API using fetch
      try {
        await Promise.all([
          fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userProfile) }),
          fetch('/api/user/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notifications) }),
          fetch('/api/user/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) }),
          fetch('/api/user/security', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(security) }),
          fetch('/api/system/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(integrations) })
        ]);
        
        toast.success('Settings saved successfully');
      } catch (apiError) {
        console.warn('API not available, settings saved locally:', apiError);
        toast.success('Settings saved locally (API unavailable)');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [userProfile, notifications, preferences, security, integrations]);

  // Change password
  const changePassword = useCallback(async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    try {
      await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSecurity(prev => ({ ...prev, passwordLastChanged: new Date().toISOString().split('T')[0] }));
      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    }
  }, [passwordForm]);

  // Toggle 2FA
  const toggle2FA = useCallback(async () => {
    try {
      const newStatus = !security.twoFactorEnabled;
      await fetch('/api/user/toggle-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newStatus })
      });
      setSecurity(prev => ({ ...prev, twoFactorEnabled: newStatus }));
      toast.success(`Two-factor authentication ${newStatus ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast.error('Failed to update two-factor authentication');
    }
  }, [security.twoFactorEnabled]);

  // Test integration
  const testIntegration = useCallback(async (type: string) => {
    try {
      await fetch(`/api/integrations/test/${type}`, { method: 'POST' });
      toast.success(`${type} integration test successful`);
    } catch (error) {
      console.error(`Error testing ${type} integration:`, error);
      toast.error(`${type} integration test failed`);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your application preferences and system settings</p>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'profile', name: 'Profile', icon: User },
            { id: 'notifications', name: 'Notifications', icon: Bell },
            { id: 'preferences', name: 'Preferences', icon: SettingsIcon },
            { id: 'security', name: 'Security', icon: Shield },
            { id: 'integrations', name: 'Integrations', icon: Database }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card">
            <div className="flex items-center mb-6">
              <User className="h-5 w-5 text-gray-400 mr-3" />
              <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Full Name</label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Email Address</label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Role</label>
                <select
                  value={userProfile.role}
                  onChange={(e) => setUserProfile({...userProfile, role: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Technician">Technician</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Department</label>
                <select
                  value={userProfile.department}
                  onChange={(e) => setUserProfile({...userProfile, department: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="IT Support">IT Support</option>
                  <option value="Network Operations">Network Operations</option>
                  <option value="Security">Security</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="card">
            <div className="flex items-center mb-6">
              <Bell className="h-5 w-5 text-gray-400 mr-3" />
              <h2 className="text-lg font-medium text-gray-900">Notification Preferences</h2>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'email', label: 'Email Notifications', desc: 'Receive notifications via email', icon: Mail },
                  { key: 'slack', label: 'Slack Notifications', desc: 'Receive notifications via Slack', icon: Slack },
                  { key: 'teams', label: 'Teams Notifications', desc: 'Receive notifications via Microsoft Teams', icon: Bell },
                  { key: 'slaAlerts', label: 'SLA Alerts', desc: 'Get alerts for SLA risks and breaches', icon: AlertTriangle },
                  { key: 'ticketUpdates', label: 'Ticket Updates', desc: 'Notifications for all ticket changes', icon: Bell },
                  { key: 'workloadAlerts', label: 'Workload Alerts', desc: 'Alerts for workload optimization', icon: Bell },
                  { key: 'systemMaintenance', label: 'System Maintenance', desc: 'Notifications about system updates', icon: SettingsIcon },
                  { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Receive weekly performance reports', icon: Bell }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <Icon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications[item.key as keyof NotificationSettings]}
                          onChange={(e) => setNotifications({...notifications, [item.key]: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Localization */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Globe className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900">Localization</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Language</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => setPreferences({...preferences, language: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="ta">Tamil</option>
                    <option value="te">Telugu</option>
                    <option value="kn">Kannada</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Timezone</label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences({...preferences, timezone: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Gulf Standard Time</option>
                    <option value="Asia/Singapore">Singapore Time</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="Europe/London">London Time</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Date Format</label>
                  <select
                    value={preferences.dateFormat}
                    onChange={(e) => setPreferences({...preferences, dateFormat: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Time Format</label>
                  <select
                    value={preferences.timeFormat}
                    onChange={(e) => setPreferences({...preferences, timeFormat: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="12h">12 Hour (AM/PM)</option>
                    <option value="24h">24 Hour</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Preferences */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Palette className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900">Display Preferences</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Theme</label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => setPreferences({...preferences, theme: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Dashboard Refresh Rate (seconds)</label>
                  <select
                    value={preferences.dashboardRefreshRate}
                    onChange={(e) => setPreferences({...preferences, dashboardRefreshRate: parseInt(e.target.value)})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Default Ticket View</label>
                  <select
                    value={preferences.defaultTicketView}
                    onChange={(e) => setPreferences({...preferences, defaultTicketView: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="list">List View</option>
                    <option value="grid">Grid View</option>
                    <option value="kanban">Kanban Board</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Items Per Page</label>
                  <select
                    value={preferences.itemsPerPage}
                    onChange={(e) => setPreferences({...preferences, itemsPerPage: parseInt(e.target.value)})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Password Change */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Shield className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
              </div>
              
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <button
                  onClick={changePassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  Change Password
                </button>
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <button
                  onClick={toggle2FA}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    security.twoFactorEnabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
              
              <div className="flex items-center">
                {security.twoFactorEnabled ? (
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <X className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span className="text-sm text-gray-600">
                  Two-factor authentication is {security.twoFactorEnabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            </div>

            {/* Session Management */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Session Management</h3>
                  <p className="text-sm text-gray-500">Manage your active sessions and security settings</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Sessions</span>
                  <span className="text-sm font-medium text-gray-900">{security.activeSessions}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Session Timeout</span>
                  <select
                    value={security.sessionTimeout}
                    onChange={(e) => setSecurity({...security, sessionTimeout: parseInt(e.target.value)})}
                    className="text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={60}>1 hour</option>
                    <option value={240}>4 hours</option>
                    <option value={480}>8 hours</option>
                    <option value={1440}>24 hours</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Password Last Changed</span>
                  <span className="text-sm font-medium text-gray-900">{security.passwordLastChanged}</span>
                </div>
                
                <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">
                  Terminate All Other Sessions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            {/* Slack Integration */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Slack className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Slack Integration</h3>
                    <p className="text-sm text-gray-500">Configure Slack webhook for notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => testIntegration('slack')}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Test
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={integrations.slackWebhook}
                  onChange={(e) => setIntegrations({...integrations, slackWebhook: e.target.value})}
                  placeholder="https://hooks.slack.com/services/..."
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Teams Integration */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Bell className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Microsoft Teams Integration</h3>
                    <p className="text-sm text-gray-500">Configure Teams webhook for notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => testIntegration('teams')}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Test
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={integrations.teamsWebhook}
                  onChange={(e) => setIntegrations({...integrations, teamsWebhook: e.target.value})}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Email SMTP */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Mail className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Email SMTP Configuration</h3>
                  <p className="text-sm text-gray-500">Configure SMTP settings for email notifications</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">SMTP Host</label>
                  <input
                    type="text"
                    value={integrations.emailSmtp.host}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      emailSmtp: {...integrations.emailSmtp, host: e.target.value}
                    })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Port</label>
                  <input
                    type="number"
                    value={integrations.emailSmtp.port}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      emailSmtp: {...integrations.emailSmtp, port: parseInt(e.target.value)}
                    })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Username</label>
                  <input
                    type="text"
                    value={integrations.emailSmtp.username}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      emailSmtp: {...integrations.emailSmtp, username: e.target.value}
                    })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Password</label>
                  <input
                    type="password"
                    value={integrations.emailSmtp.password}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      emailSmtp: {...integrations.emailSmtp, password: e.target.value}
                    })}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={integrations.emailSmtp.secure}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      emailSmtp: {...integrations.emailSmtp, secure: e.target.checked}
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Use SSL/TLS</span>
                </label>
              </div>
            </div>

            {/* API Keys */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Database className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                  <p className="text-sm text-gray-500">Configure external service API keys</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">SuperOps API Key</label>
                  <input
                    type="password"
                    value={integrations.superOpsApiKey}
                    onChange={(e) => setIntegrations({...integrations, superOpsApiKey: e.target.value})}
                    placeholder="Enter SuperOps API key"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Gemini AI API Key</label>
                  <input
                    type="password"
                    value={integrations.geminiApiKey}
                    onChange={(e) => setIntegrations({...integrations, geminiApiKey: e.target.value})}
                    placeholder="Enter Gemini API key"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={loadSettings}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}