// Cloudflare D1 database connection
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// For local development, this will be provided by Wrangler
// In production, it will be bound via wrangler.toml
export function createDb(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

// Type for the database instance
export type Database = ReturnType<typeof createDb>;