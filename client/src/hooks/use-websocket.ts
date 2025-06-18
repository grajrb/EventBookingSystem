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
    // Remove the /v2 path and hardcode the URL without it
    return 'ws://localhost:5000';
  };

  const connect = useCallback(() => {
    try {
      const socket = new WebSocket(getWebSocketUrl());
      
      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      socket.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        setIsConnected(false);
        
        // Attempt to reconnect after a delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000); // Reconnect after 3 seconds
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
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
