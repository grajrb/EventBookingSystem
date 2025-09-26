import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { publishWebSocketMessage } from './services/redis';
import jwt from 'jsonwebtoken';

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

interface AuthedClientMeta { isAlive: boolean; userId?: number }

// Store clients with their connection status and optional userId once authenticated
const clients = new Map<WebSocket, AuthedClientMeta>();

export function setupWebSocketServer(server: Server) {
  // Use dedicated path for application WebSocket (avoid clashing with Vite HMR)
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('Client connected to WebSocket', { ip: req.socket.remoteAddress });
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
        if (data.type === 'AUTH' && data.payload?.token) {
          try {
            const decoded: any = jwt.verify(data.payload.token, process.env.JWT_SECRET || 'secret');
            const meta = clients.get(ws);
            if (meta) meta.userId = decoded.id;
            ws.send(JSON.stringify({ type: 'AUTH_OK', payload: { userId: decoded.id }}));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', payload: { message: 'Invalid token' }}));
          }
          return;
        }
        console.log('WebSocket message received:', data.type);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', (code, reason) => {
      console.log('Client disconnected from WebSocket', { code, reason: reason.toString() });
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error', err);
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
    console.log('WebSocket server closing');
    clearInterval(interval);
  });

  return wss;
}

// Function to broadcast a message to all connected clients
export function broadcast(message: WebSocketMessage, { localOnly = false }: { localOnly?: boolean } = {}) {
  const messageStr = JSON.stringify(message);
  // Send to local clients
  Array.from(clients.entries()).forEach(([ws, client]) => {
    if (client.isAlive && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
  // Publish for other instances unless suppressed
  if (!localOnly) {
    publishWebSocketMessage(message).catch(() => {});
  }
}

// Function to send a message to a specific client
export function sendTo(ws: WebSocket, message: WebSocketMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function sendToUser(userId: number, message: WebSocketMessage) {
  const str = JSON.stringify(message);
  Array.from(clients.entries()).forEach(([ws, meta]) => {
    if (meta.userId === userId && meta.isAlive && ws.readyState === WebSocket.OPEN) {
      ws.send(str);
    }
  });
}

export function broadcastToUser(userId: number, message: WebSocketMessage, { localOnly = false }: { localOnly?: boolean } = {}) {
  sendToUser(userId, message);
  if (!localOnly) {
    // Wrap user targeting so other instances can route; include a special envelope
    publishWebSocketMessage({ type: '__USER_TARGET__', payload: { userId, message } }).catch(()=>{});
  }
}
