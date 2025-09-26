import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket event types - must match the server definitions
export const WS_EVENTS = {
  SLOT_UPDATE: 'SLOT_UPDATE',
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  EVENT_UPDATED: 'EVENT_UPDATED',
};

export type WebSocketMessage = {
  type: string;
  payload: any;
};

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);  // Get WebSocket URL from server's origin
  const getWebSocketUrl = () => {
    // In production you may want to derive from window.location
    // but for now we keep localhost for dev and relative for prod
    if (typeof window !== 'undefined') {
      const { protocol, host } = window.location;
      const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${host}/ws`;
    }
    return 'ws://localhost:5000/ws';
  };

  const attemptRef = useRef(0);
  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return; // already connecting/connected
    }
    try {
      const socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        attemptRef.current = 0;
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        console.log('WebSocket connected');
        // Authenticate connection (optional for user-targeted messages)
        try {
          const token = localStorage.getItem('token');
            if (token) {
              socket.send(JSON.stringify({ type: 'AUTH', payload: { token } }));
            }
        } catch {}
      };
      socket.onmessage = (event) => {
        try { setLastMessage(JSON.parse(event.data) as WebSocketMessage); } catch (e) { console.error('WS parse error', e); }
      };
      socket.onclose = (event) => {
        setIsConnected(false);
        const attempt = ++attemptRef.current;
        const base = Math.min(30000, 1000 * Math.pow(2, attempt));
        const jitter = Math.random() * 500;
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, base + jitter);
        }
        console.log('WebSocket disconnected', { code: event.code, reason: event.reason, retryIn: base });
      };
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WS:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message, WebSocket is not connected');
    }
  }, [isConnected]);

  // Connect when the component mounts, disconnect when it unmounts
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
};
