import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === 'test';

if (!process.env.DATABASE_URL && !isTest) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use a default test connection string if none is provided and we're in test mode
const connectionString = process.env.DATABASE_URL || 
  (isTest ? 'postgres://postgres:7992425448@localhost:5432/event_booking_system' : '');

console.log(`Connecting to PostgreSQL with connection string: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

// Determine SSL usage: allow override with DB_SSL env.
// Acceptable truthy values: '1', 'true', 'TRUE'.
const dbSslEnv = (process.env.DB_SSL || '').toLowerCase();
const forceSsl = dbSslEnv === '1' || dbSslEnv === 'true';

// Detect localhost usage (no SSL needed if host is localhost/127.0.0.1 unless forced)
let useSsl = false;
try {
  const url = new URL(connectionString);
  const host = url.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  if (forceSsl) {
    useSsl = true;
  } else if (!isLocalHost && process.env.NODE_ENV === 'production') {
    useSsl = true;
  }
} catch (_) {
  // If parsing fails, fall back to previous behavior
  if (process.env.NODE_ENV === 'production') {
    useSsl = true;
  }
}

if (useSsl) {
  console.log('[db] SSL enabled for PostgreSQL connection');
} else {
  console.log('[db] SSL disabled for PostgreSQL connection');
}

export const pool = new pg.Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Create a Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Test the connection and create tables if they don't exist
export const initDatabase = async () => {
  try {
    // Test the connection
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
};

// Test the connection
pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => {
    console.error('PostgreSQL connection error:', err.message);
    // Don't fail the server start if DB connection fails
  });