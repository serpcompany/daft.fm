#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function fetchDiscogsArtistAlbums() {
  console.log('🎯 Fetching Albums from Discogs Artist Releases Endpoint\n');
  
  const db = new Database('discogs-artist-albums.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS artist_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_name TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      type TEXT, -- 'master' or 'release'
      role TEXT, -- 'Main', 'Appearance', etc.
      format TEXT,
      label TEXT,
      country TEXT,
      master_id INTEGER,
      release_id INTEGER,
      thumb TEXT,
      resource_url TEXT,
      is_album BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Clear existing data
  db.prepare('DELETE FROM artist_albums').run();
  
  const artists = [
    { name: 'The Beatles', id: '82730' },
    { name: 'Pink Floyd', id: '45467' },
    { name: 'David Bowie', id: '10263' }
  ];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 Fetching releases for ${artist.name}`);
    console.log('='.repeat(60));
    
    try {
      let page = 1;
      let hasMore = true;
      let totalReleases = 0;
      let albumCount = 0;
      
      const stmt = db.prepare(`
        INSERT INTO artist_albums (
          artist_name, artist_id, title, year, type, role, 
          format, label, country, master_id, release_id, 
          thumb, resource_url, is_album
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      while (hasMore) {
        const url = `https://api.discogs.com/artists/${artist.id}/releases?page=${page}&per_page=100&sort=year&sort_order=asc`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        });
        
        const data = await response.json();
        
        if (!data.releases || data.releases.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const release of data.releases) {
          totalReleases++;
          
          // Check if it's an album based on format
          const format = release.format || '';
          const isAlbum = 
            release.type === 'master' && 
            release.role === 'Main' &&
            (format.includes('Album') || 
             format.includes('LP') || 
             format.includes('CD') ||
             format === '');
          
          if (isAlbum) {
            albumCount++;
          }
          
          stmt.run(
            artist.name,
            artist.id,
            release.title,
            release.year || null,
            release.type,
            release.role,
            release.format,
            release.label,
            release.country || null,
            release.type === 'master' ? (release.id || release.main_release) : null,
            release.type === 'release' ? release.id : null,
            release.thumb || null,
            release.resource_url,
            isAlbum ? 1 : 0
          );
        }
        
        // Check pagination
        if (data.pagination && page < data.pagination.pages) {
          page++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Total releases: ${totalReleases}`);
      console.log(`Albums (type=master, role=Main, format includes Album/LP/CD): ${albumCount}`);
      
    } catch (error) {
      console.error(`Error fetching ${artist.name}:`, error);
    }
  }
  
  // Show summary
  console.log('\n\n📊 SUMMARY - Albums by Artist:');
  console.log('─'.repeat(60));
  
  const summary = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as total_releases,
      SUM(CASE WHEN is_album = 1 THEN 1 ELSE 0 END) as albums,
      SUM(CASE WHEN type = 'master' THEN 1 ELSE 0 END) as masters,
      SUM(CASE WHEN role = 'Main' THEN 1 ELSE 0 END) as main_role
    FROM artist_albums
    GROUP BY artist_name
  `).all();
  
  console.log('Artist         | Total | Albums | Masters | Main Role');
  console.log('---------------|-------|--------|---------|----------');
  
  for (const row of summary as any[]) {
    console.log(
      `${row.artist_name.padEnd(14)} | ${String(row.total_releases).padStart(5)} | ${String(row.albums).padStart(6)} | ${String(row.masters).padStart(7)} | ${String(row.main_role).padStart(9)}`
    );
  }
  
  // Show Beatles UK albums
  console.log('\n\n📀 BEATLES UK ALBUMS (filtered):');
  console.log('─'.repeat(60));
  
  const beatlesUKAlbums = db.prepare(`
    SELECT DISTINCT title, year, format, country
    FROM artist_albums
    WHERE artist_name = 'The Beatles'
      AND is_album = 1
      AND type = 'master'
      AND (country = 'UK' OR country IS NULL)
    ORDER BY year, title
  `).all();
  
  for (const album of beatlesUKAlbums as any[]) {
    console.log(`${album.year || '????'} - ${album.title}`);
    console.log(`      Format: ${album.format}`);
    console.log(`      Country: ${album.country || 'Not specified'}`);
  }
  
  db.close();
  console.log('\n✅ Data saved to discogs-artist-albums.db');
}

fetchDiscogsArtistAlbums().catch(console.error);