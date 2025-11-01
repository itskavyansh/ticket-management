import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { io, Socket } from 'socket.io-client';
import { PerformanceMetrics, SLAAlert, RealTimeUpdate } from '../types/analytics';
import { apiService } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3001';


export function useRealTimeData() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to real-time server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from real-time server');
    });

    newSocket.on('dashboard_update', (update: RealTimeUpdate) => {
      handleRealTimeUpdate(update);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleRealTimeUpdate = useCallback((update: RealTimeUpdate) => {
    switch (update.type) {
      case 'kpi_update':
        queryClient.setQueryData(['dashboard-metrics'], update.data);
        break;
      case 'new_ticket':
      case 'ticket_resolved':
        queryClient.invalidateQueries(['dashboard-metrics']);
        queryClient.invalidateQueries(['ticket-trends']);
        break;
      case 'sla_alert':
        queryClient.setQueryData(['sla-alerts'], (old: SLAAlert[] = []) => [
          update.data,
          ...old.slice(0, 9) // Keep only 10 most recent alerts
        ]);
        break;
      case 'technician_status':
        queryClient.invalidateQueries(['technician-performance']);
        break;
    }
  }, [queryClient]);

  return {
    socket,
    isConnected,
  };
}

export function useDashboardMetrics() {
  return useQuery<PerformanceMetrics>(
    ['dashboard-metrics'],
    () => apiService.getDashboardMetrics(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds as fallback
      staleTime: 10000, // Consider data stale after 10 seconds
    }
  );
}

export function useSLAAlerts() {
  return useQuery<SLAAlert[]>(
    ['sla-alerts'],
    () => apiService.getSLAAlerts(),
    {
      refetchInterval: 15000, // Refetch every 15 seconds
      staleTime: 5000,
    }
  );
}

export function useTicketTrends(timeRange: string = '7d') {
  return useQuery(
    ['ticket-trends', timeRange],
    () => apiService.getTicketTrends(timeRange),
    {
      refetchInterval: 60000, // Refetch every minute
      staleTime: 30000,
    }
  );
}