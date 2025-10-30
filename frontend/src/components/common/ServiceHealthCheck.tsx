import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useHealthChecks } from '../../hooks/useAnalytics';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
}

export function ServiceHealthCheck() {
  const { data: healthData, isLoading, refetch } = useHealthChecks();
  const [services, setServices] = useState<ServiceStatus[]>([]);

  useEffect(() => {
    if (healthData) {
      const serviceStatuses: ServiceStatus[] = [
        {
          name: 'Backend API',
          status: healthData.backend?.status === 'healthy' ? 'healthy' : 'unhealthy',
          responseTime: healthData.backend?.responseTime,
          lastCheck: new Date(),
          error: healthData.backend?.error
        },
        {
          name: 'AI Service',
          status: healthData.aiService?.status === 'healthy' ? 'healthy' : 'unhealthy',
          responseTime: healthData.aiService?.responseTime,
          lastCheck: new Date(),
          error: healthData.aiService?.error
        }
      ];
      setServices(serviceStatuses);
    }
  }, [healthData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const overallStatus = services.length > 0 
    ? services.every(s => s.status === 'healthy') 
      ? 'healthy' 
      : services.some(s => s.status === 'unhealthy') 
        ? 'unhealthy' 
        : 'degraded'
    : 'unknown';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Service Health</h3>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(overallStatus)}`}>
            {getStatusIcon(overallStatus)}
            <span className="ml-1">
              {overallStatus === 'healthy' ? 'All Systems Operational' : 
               overallStatus === 'degraded' ? 'Some Issues Detected' : 
               overallStatus === 'unhealthy' ? 'Service Issues' : 'Checking...'}
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`h-4 w-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              {getStatusIcon(service.status)}
              <span className="ml-2 text-sm font-medium text-gray-900">{service.name}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {service.responseTime && (
                <span className="text-gray-500">{service.responseTime}ms</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                {service.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {services.some(s => s.error) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 mb-2">Service Errors:</h4>
          <div className="space-y-1">
            {services.filter(s => s.error).map((service) => (
              <p key={service.name} className="text-sm text-red-700">
                <strong>{service.name}:</strong> {service.error}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Last updated: {new Date().toLocaleTimeString()} IST
        </p>
      </div>
    </div>
  );
}