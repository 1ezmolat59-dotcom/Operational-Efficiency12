import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

const TOKEN_KEY = 'hospital_ops_token';

interface WebSocketHookResult {
  socket: Socket | null;
  connected: boolean;
  subscribe: <T>(event: string, handler: (data: T) => void) => () => void;
}

export function useWebSocket(): WebSocketHookResult {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      // Join role-based rooms
      if (user.role === 'supervisor') {
        socket.emit('join:supervisor', { wingId: user.wingId });
      } else if (user.role === 'admin') {
        socket.emit('join:admin');
      }

      if (user.wingId) {
        socket.emit('join:wing', { wingId: user.wingId });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('WebSocket connection error:', err.message);
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, user]);

  const subscribe = useCallback(<T>(event: string, handler: (data: T) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    subscribe,
  };
}

// Typed event names as constants
export const WS_EVENTS = {
  ROOM_STATUS_UPDATED: 'room:status-updated',
  ALERT_NEW: 'alert:new',
  ACTIVITY_NEW: 'activity:new',
  TRANSPORT_JOB_UPDATED: 'transport:job-updated',
  STAFF_STATUS_UPDATED: 'staff:status-updated',
} as const;
