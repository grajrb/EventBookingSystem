import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

// Centralized WebSocket event types
export const WS_EVENTS = {
  SLOT_UPDATE: 'SLOT_UPDATE',
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  EVENT_UPDATED: 'EVENT_UPDATED',
};

interface WebSocketMessage {
  type: string;
  payload: any;
}

// Store clients with their connection status
const clients = new Map<WebSocket, { isAlive: boolean }>();

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    clients.set(ws, { isAlive: true });

    // Ping to verify connection is still alive
    ws.on('pong', () => {
      const client = clients.get(ws);
      if (client) client.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage;
        console.log('WebSocket message received:', data.type);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      clients.delete(ws);
    });
  });

  // Interval to check connection status and clean up dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = clients.get(ws);
      if (!client) return;

      if (client.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }

      client.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

// Function to broadcast a message to all connected clients
export function broadcast(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  
  Array.from(clients.entries()).forEach(([ws, client]) => {
    if (client.isAlive && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// Function to send a message to a specific client
export function sendTo(ws: WebSocket, message: WebSocketMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
