import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

let isConnected = false;

export const connectRedis = async () => {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log('Connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }
};

export const getEventSlots = async (eventId: number): Promise<number | null> => {
  try {
    const slots = await client.get(`event:${eventId}:slots`);
    return slots ? parseInt(slots, 10) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const setEventSlots = async (eventId: number, slots: number): Promise<void> => {
  try {
    await client.set(`event:${eventId}:slots`, slots.toString(), {
      EX: 3600, // Expire after 1 hour
    });
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

export const decrementEventSlots = async (eventId: number): Promise<number | null> => {
  try {
    const result = await client.decr(`event:${eventId}:slots`);
    return result;
  } catch (error) {
    console.error('Redis decrement error:', error);
    return null;
  }
};

export const incrementEventSlots = async (eventId: number): Promise<number | null> => {
  try {
    const result = await client.incr(`event:${eventId}:slots`);
    return result;
  } catch (error) {
    console.error('Redis increment error:', error);
    return null;
  }
};

export const invalidateEventSlots = async (eventId: number): Promise<void> => {
  try {
    await client.del(`event:${eventId}:slots`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
};

export { client as redisClient };
