import { AlertTriangle, Clock, User, Building } from 'lucide-react';
import { SLAAlert } from '../../types/analytics';
import { clsx } from 'clsx';

interface SLAAlertPanelProps {
  alerts: SLAAlert[];
  isLoading?: boolean;
}

export function SLAAlertPanel({ alerts, isLoading }: SLAAlertPanelProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 0) {
      const overdue = Math.abs(minutes);
      if (overdue < 60) return `${overdue}m overdue`;
      if (overdue < 1440) return `${Math.floor(overdue / 60)}h overdue`;
      return `${Math.floor(overdue / 1440)}d overdue`;
    }
    
    if (minutes < 60) return `${minutes}m remaining`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h remaining`;
    return `${Math.floor(minutes / 1440)}d remaining`;
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">SLA Risk Alerts</h3>
        <div className="flex items-center text-sm text-gray-500">
          <AlertTriangle className="w-4 h-4 mr-1" />
          {alerts.length} active alerts
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No SLA alerts at this time</p>
          <p className="text-sm text-gray-400 mt-1">All tickets are on track</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={clsx(
                'flex items-start space-x-3 p-3 rounded-lg border-l-4 transition-colors hover:bg-gray-50',
                alert.riskLevel === 'critical' && 'border-red-500 bg-red-50',
                alert.riskLevel === 'high' && 'border-orange-500 bg-orange-50',
                alert.riskLevel === 'medium' && 'border-yellow-500 bg-yellow-50',
                alert.riskLevel === 'low' && 'border-blue-500 bg-blue-50'
              )}
            >
              <div className={clsx('p-1 rounded-full', getRiskColor(alert.riskLevel))}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    #{alert.ticketId} - {alert.ticketTitle}
                  </h4>
                  <span className={clsx(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    getRiskColor(alert.riskLevel)
                  )}>
                    {alert.riskLevel.toUpperCase()}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-xs text-gray-600">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTimeRemaining(alert.timeRemaining)}
                  </div>
                  
                  {alert.assignedTechnician && (
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {alert.assignedTechnician}
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Building className="w-3 h-3 mr-1" />
                    {alert.customer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}