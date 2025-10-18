import { Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';

interface RealTimeIndicatorProps {
  isConnected: boolean;
  lastUpdate?: Date;
}

export function RealTimeIndicator({ isConnected, lastUpdate }: RealTimeIndicatorProps) {
  const formatLastUpdate = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={clsx(
        'flex items-center space-x-1 px-2 py-1 rounded-full',
        isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      )}>
        {isConnected ? (
          <Wifi className="w-3 h-3" />
        ) : (
          <WifiOff className="w-3 h-3" />
        )}
        <span className="text-xs font-medium">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
      
      {lastUpdate && (
        <span className="text-gray-500 text-xs">
          Updated {formatLastUpdate(lastUpdate)}
        </span>
      )}
    </div>
  );
}