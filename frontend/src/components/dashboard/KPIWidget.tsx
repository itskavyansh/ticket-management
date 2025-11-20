import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DashboardKPI } from '../../types/analytics';
import { clsx } from 'clsx';

interface KPIWidgetProps {
  kpi: DashboardKPI;
  isLoading?: boolean;
}

export function KPIWidget({ kpi, isLoading }: KPIWidgetProps) {
  const formatValue = (value: number | string, format?: string) => {
    if (value === undefined || value === null) return '0';
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'duration':
        return `${value.toFixed(1)}h`;
      case 'currency':
        return `$${value.toLocaleString()}`;
      default:
        return value.toLocaleString();
    }
  };

  const getChangeIcon = () => {
    switch (kpi.changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getChangeColor = () => {
    switch (kpi.changeType) {
      case 'increase':
        return kpi.color === 'red' ? 'text-red-600' : 'text-green-600';
      case 'decrease':
        return kpi.color === 'red' ? 'text-green-600' : 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{kpi.title}</p>
        {kpi.icon && (
          <div className={clsx(
            'p-1.5 rounded',
            kpi.color === 'green' && 'bg-green-50 text-green-600',
            kpi.color === 'red' && 'bg-red-50 text-red-600',
            kpi.color === 'blue' && 'bg-blue-50 text-blue-600',
            kpi.color === 'yellow' && 'bg-yellow-50 text-yellow-600',
            (!kpi.color || kpi.color === 'gray') && 'bg-gray-50 text-gray-600'
          )}>
            {/* Icon would be rendered here based on kpi.icon string */}
          </div>
        )}
      </div>
      
      <div>
        <p className={clsx(
          'text-2xl font-semibold mb-1',
          kpi.color === 'green' && 'text-green-600',
          kpi.color === 'red' && 'text-red-600',
          kpi.color === 'blue' && 'text-blue-600',
          kpi.color === 'yellow' && 'text-yellow-600',
          (!kpi.color || kpi.color === 'gray') && 'text-gray-900'
        )}>
          {formatValue(kpi.value, kpi.format)}
        </p>
        
        {kpi.change !== undefined && kpi.change !== 0 && (
          <div className={clsx('flex items-center text-xs', getChangeColor())}>
            {getChangeIcon()}
            <span className="ml-1 font-medium">
              {Math.abs(kpi.change).toFixed(1)}%
            </span>
            <span className="ml-1 text-gray-500">vs last week</span>
          </div>
        )}
      </div>
    </div>
  );
}