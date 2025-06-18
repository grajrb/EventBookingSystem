import { createClient } from 'redis';

let client: any = null;
let isConnected = false;
let redisAvailable = true;

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
    isConnected = true;
    console.log('Connected to Redis');
  } catch (error) {
    console.log('Redis not available, using database fallback');
    redisAvailable = false;
    isConnected = false;
    client = null;
  }
};

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
      EX: 3600, // Expire after 1 hour
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

export { client as redisClient };
