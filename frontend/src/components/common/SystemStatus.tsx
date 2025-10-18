import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SystemStatusProps {
  className?: string;
}

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  responseTime?: number;
}

const mockServices: ServiceStatus[] = [
  { name: 'API Server', status: 'operational', responseTime: 45 },
  { name: 'Database', status: 'operational', responseTime: 12 },
  { name: 'AI Service', status: 'operational', responseTime: 230 },
  { name: 'Email Service', status: 'operational', responseTime: 89 },
  { name: 'File Storage', status: 'operational', responseTime: 67 }
];

export function SystemStatus({ className = '' }: SystemStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>(mockServices);
  const [overallStatus, setOverallStatus] = useState<'operational' | 'degraded' | 'outage'>('operational');

  useEffect(() => {
    // Determine overall status based on individual services
    const hasOutage = services.some(s => s.status === 'outage');
    const hasDegraded = services.some(s => s.status === 'degraded');
    
    if (hasOutage) {
      setOverallStatus('outage');
    } else if (hasDegraded) {
      setOverallStatus('degraded');
    } else {
      setOverallStatus('operational');
    }
  }, [services]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'outage':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'outage':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getOverallStatusText = () => {
    switch (overallStatus) {
      case 'operational':
        return 'All Systems Operational';
      case 'degraded':
        return 'Some Systems Degraded';
      case 'outage':
        return 'System Outage';
      default:
        return 'Status Unknown';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${getStatusColor(overallStatus)}`}
        title="System Status"
      >
        {getStatusIcon(overallStatus)}
        <span className="ml-1 hidden sm:inline">{getOverallStatusText()}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">System Status</h3>
              <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(overallStatus)}`}>
                {getStatusIcon(overallStatus)}
                <span className="ml-1">{getOverallStatusText()}</span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(service.status)}
                    <span className="ml-2 text-sm text-gray-900">{service.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {service.responseTime && (
                      <span className="text-xs text-gray-500">{service.responseTime}ms</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
                <button
                  onClick={() => {
                    // Refresh status
                    setServices([...mockServices]);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}