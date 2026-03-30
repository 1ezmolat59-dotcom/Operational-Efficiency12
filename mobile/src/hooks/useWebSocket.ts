import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

const WS_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3001';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
}

export function useWebSocket(): UseWebSocketReturn {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!token || !user) return;
    if (socketRef.current?.connected) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setConnected(true);

      // Join role-specific rooms
      if (user.role === 'housekeeper' && user.wingId) {
        socket.emit('join:wing', user.wingId);
      } else if (user.role === 'transporter') {
        socket.emit('join:transport');
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    socketRef.current = socket;
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [token, user, connect]);

  return {
    socket: socketRef.current,
    connected,
  };
}
