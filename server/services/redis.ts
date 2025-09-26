import { createClient } from 'redis';

let client: any = null;
let pubClient: any = null;
let subClient: any = null;
let isConnected = false;
let redisAvailable = true;

// Cache TTL values (in seconds)
const CACHE_TTL = {
  EVENT_SLOTS: 3600, // 1 hour
  EVENT_DATA: 3600 * 2, // 2 hours
  EVENT_LIST: 600, // 10 minutes
  ADMIN_STATS: 300, // 5 minutes
};

export const connectRedis = async () => {
  if (!redisAvailable) return;
  
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    client.on('error', () => {
      redisAvailable = false;
      isConnected = false;
    });

    await client.connect();
    // Duplicate connections for pub/sub to avoid performance issues
    pubClient = client.duplicate();
    subClient = client.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    // Subscribe to websocket broadcast channel
    await subClient.subscribe('ws:broadcast', (message: string) => {
      try {
        // Lazy import to avoid circular requiring websocket before init
        const { broadcast } = require('../websocket');
        const parsed = JSON.parse(message);
        broadcast(parsed, { localOnly: true });
      } catch (e) {
        console.error('Failed to handle pub/sub ws message', e);
      }
    });
    isConnected = true;
    console.log('Connected to Redis');
  } catch (error) {
    console.log('Redis not available, using database fallback');
    redisAvailable = false;
    isConnected = false;
    client = null;
  }
};

// Event Slots Cache Methods
export const getEventSlots = async (eventId: number): Promise<number | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const slots = await client.get(`event:${eventId}:slots`);
    return slots ? parseInt(slots, 10) : null;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const setEventSlots = async (eventId: number, slots: number): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.set(`event:${eventId}:slots`, slots.toString(), {
      EX: CACHE_TTL.EVENT_SLOTS, 
    });
  } catch (error) {
    redisAvailable = false;
  }
};

export const decrementEventSlots = async (eventId: number): Promise<number | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const result = await client.decr(`event:${eventId}:slots`);
    return result;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const incrementEventSlots = async (eventId: number): Promise<number | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const result = await client.incr(`event:${eventId}:slots`);
    return result;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const invalidateEventSlots = async (eventId: number): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.del(`event:${eventId}:slots`);
  } catch (error) {
    redisAvailable = false;
  }
};

// Event Data Cache Methods
export const getEventData = async (eventId: number): Promise<any | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const eventData = await client.get(`event:${eventId}:data`);
    return eventData ? JSON.parse(eventData) : null;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const setEventData = async (eventId: number, eventData: any): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.set(`event:${eventId}:data`, JSON.stringify(eventData), {
      EX: CACHE_TTL.EVENT_DATA,
    });
  } catch (error) {
    redisAvailable = false;
  }
};

export const invalidateEventData = async (eventId: number): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.del(`event:${eventId}:data`);
  } catch (error) {
    redisAvailable = false;
  }
};

// Event List Cache Methods
export const getEventList = async (page: number, limit: number, search?: string): Promise<any | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const cacheKey = `events:list:${page}:${limit}:${search || 'all'}`;
    const eventList = await client.get(cacheKey);
    return eventList ? JSON.parse(eventList) : null;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const setEventList = async (page: number, limit: number, search: string | undefined, eventList: any): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    const cacheKey = `events:list:${page}:${limit}:${search || 'all'}`;
    await client.set(cacheKey, JSON.stringify(eventList), {
      EX: CACHE_TTL.EVENT_LIST,
    });
  } catch (error) {
    redisAvailable = false;
  }
};

export const invalidateEventLists = async (): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    // Use scan to find all event list keys and delete them
    const keys = await client.keys('events:list:*');
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    redisAvailable = false;
  }
};

// Admin Stats Cache Methods
export const getAdminStats = async (): Promise<any | null> => {
  if (!isConnected || !redisAvailable || !client) return null;
  try {
    const stats = await client.get('admin:stats');
    return stats ? JSON.parse(stats) : null;
  } catch (error) {
    redisAvailable = false;
    return null;
  }
};

export const setAdminStats = async (stats: any): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.set('admin:stats', JSON.stringify(stats), {
      EX: CACHE_TTL.ADMIN_STATS,
    });
  } catch (error) {
    redisAvailable = false;
  }
};

export const invalidateAdminStats = async (): Promise<void> => {
  if (!isConnected || !redisAvailable || !client) return;
  try {
    await client.del('admin:stats');
  } catch (error) {
    redisAvailable = false;
  }
};

export const publishWebSocketMessage = async (payload: any) => {
  if (!pubClient || !isConnected || !redisAvailable) return false;
  try {
    await pubClient.publish('ws:broadcast', JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
};

export { client as redisClient };
