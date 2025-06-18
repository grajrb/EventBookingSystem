import { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from './use-websocket';

const WebSocketContext = createContext<ReturnType<typeof useWebSocket> | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const websocket = useWebSocket();
  
  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
