#!/usr/bin/env tsx

import 'dotenv/config';
import { Client } from 'pg';

const MB_CONNECTION = {
  host: process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432'),
  database: process.env.MUSICBRAINZ_DB_NAME || 'musicbrainz_db',
  user: process.env.MUSICBRAINZ_DB_USER || 'musicbrainz',
  password: process.env.MUSICBRAINZ_DB_PASSWORD || ''
};

async function checkCanonicalTables() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('🔍 Checking for canonical data tables in MusicBrainz\n');
    
    // Check for tables that might contain canonical data
    const result = await pgClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'musicbrainz' 
        AND (
          table_name LIKE '%canonical%' 
          OR table_name LIKE '%redirect%'
          OR table_name LIKE '%mapping%'
        )
      ORDER BY table_name;
    `);
    
    if (result.rows.length > 0) {
      console.log('Found potential canonical tables:');
      result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    } else {
      console.log('❌ No canonical data tables found');
      console.log('\nThe canonical data needs to be downloaded separately from:');
      console.log('https://data.metabrainz.org/pub/musicbrainz/canonical_data/');
      console.log('\nFiles needed:');
      console.log('- canonical_release_redirect.csv.gz');
      console.log('- canonical_recording_redirect.csv.gz');
    }
    
    // Also check all tables just to see what's available
    console.log('\n\n📋 All MusicBrainz tables (first 20):');
    const allTables = await pgClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'musicbrainz'
      ORDER BY table_name
      LIMIT 20;
    `);
    
    allTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgClient.end();
  }
}

checkCanonicalTables().catch(console.error);