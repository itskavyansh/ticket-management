import { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'SLA Risk Alert',
    message: 'Ticket TKT-001 from TCS is approaching SLA deadline in 2 hours',
    timestamp: '2024-01-15T14:30:00Z',
    read: false,
    actionUrl: '/tickets/1'
  },
  {
    id: '2',
    type: 'success',
    title: 'Ticket Resolved',
    message: 'Ticket TKT-002 from Infosys has been successfully resolved by Rajesh Kumar',
    timestamp: '2024-01-15T13:15:00Z',
    read: false,
    actionUrl: '/tickets/2'
  },
  {
    id: '3',
    type: 'info',
    title: 'New Ticket Assigned',
    message: 'You have been assigned ticket TKT-003 from Wipro Technologies',
    timestamp: '2024-01-15T12:45:00Z',
    read: true,
    actionUrl: '/tickets/3'
  },
  {
    id: '4',
    type: 'error',
    title: 'SLA Breach',
    message: 'Ticket TKT-004 from Reliance Industries has exceeded its SLA deadline',
    timestamp: '2024-01-15T11:20:00Z',
    read: true,
    actionUrl: '/tickets/4'
  },
  {
    id: '5',
    type: 'warning',
    title: 'Network Issue Alert',
    message: 'Internet connectivity issues reported in Pune office - Tech Mahindra',
    timestamp: '2024-01-15T14:15:00Z',
    read: false,
    actionUrl: '/tickets/5'
  }
];

const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const notificationColors = {
  info: 'text-blue-600 bg-blue-100',
  success: 'text-green-600 bg-green-100',
  warning: 'text-yellow-600 bg-yellow-100',
  error: 'text-red-600 bg-red-100',
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Bell className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type];
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-1 rounded-full ${notificationColors[notification.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          !notification.read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="p-1 rounded-full hover:bg-gray-200"
                        >
                          <X className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Mark read
                            </button>
                          )}
                          {notification.actionUrl && (
                            <a
                              href={notification.actionUrl}
                              className="text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                markAsRead(notification.id);
                                onClose();
                              }}
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
}