import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Create staging database instance - local to pipeline
const sqlite = new Database('./data-pipeline/staging.db');
export const stagingDb = drizzle(sqlite);

// Initialize staging database with pipeline schema
export async function initStagingDb() {
  console.log('🔧 Initializing staging database...');
  
  // Run migrations from pipeline's db folder
  await migrate(stagingDb, { migrationsFolder: './data-pipeline/db' });
  
  console.log('✅ Staging database ready');
}