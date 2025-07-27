#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'DaftFM-DataPipeline/1.0 (https://daft.fm)';

interface ReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string;
  'first-release-date'?: string;
  'secondary-type-list'?: string[];
}

async function fetchReleaseGroups(artistMbid: string, artistName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎤 ${artistName}`);
  console.log('='.repeat(60));
  
  try {
    // Fetch release groups (albums) for the artist
    const url = `${MB_BASE_URL}/release-group?artist=${artistMbid}&type=album&limit=100&fmt=json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const releaseGroups = data['release-groups'] || [];
    
    console.log(`\nFound ${releaseGroups.length} release groups (albums)`);
    
    // Sort by first release date
    releaseGroups.sort((a: ReleaseGroup, b: ReleaseGroup) => 
      (a['first-release-date'] || '9999').localeCompare(b['first-release-date'] || '9999')
    );
    
    return releaseGroups.map((rg: ReleaseGroup) => ({
      mbid: rg.id,
      title: rg.title,
      type: rg['primary-type'] || 'Unknown',
      firstReleaseDate: rg['first-release-date'] || null,
      year: rg['first-release-date']?.substring(0, 4) || null
    }));
    
  } catch (error) {
    console.error(`Error fetching data: ${error}`);
    return [];
  }
}

async function compareWithSpotify() {
  console.log('🎯 Comparing MusicBrainz with Spotify data\n');
  
  const db = new Database('staging.db');
  
  // Get artists with MusicBrainz IDs who have albums
  const artists = db.prepare(`
    SELECT DISTINCT a.id, a.name, a.musicbrainz_id 
    FROM artists a
    JOIN albums al ON a.id = al.artist_id
    WHERE a.musicbrainz_id IS NOT NULL
    LIMIT 5
  `).all() as any[];
  
  const comparisonResults = [];
  
  for (const artist of artists) {
    console.log(`\n\n${'*'.repeat(80)}`);
    console.log(`Comparing albums for: ${artist.name}`);
    console.log('*'.repeat(80));
    
    // Get albums from MusicBrainz
    const mbAlbums = await fetchReleaseGroups(artist.musicbrainz_id, artist.name);
    
    // Get albums from our Spotify data
    const spotifyAlbums = db.prepare(`
      SELECT title, release_date, spotify_album_id 
      FROM albums 
      WHERE artist_id = ?
      ORDER BY release_date
    `).all(artist.id) as any[];
    
    console.log(`\n📊 Comparison:`);
    console.log(`MusicBrainz albums: ${mbAlbums.length}`);
    console.log(`Spotify albums in DB: ${spotifyAlbums.length}`);
    
    // Show side by side
    console.log(`\n${'MusicBrainz'.padEnd(40)} | ${'Spotify (in our DB)'.padEnd(40)}`);
    console.log(`${'-'.repeat(40)} | ${'-'.repeat(40)}`);
    
    // Create sets for comparison
    const mbTitles = new Set(mbAlbums.map(a => a.title.toLowerCase()));
    const spotifyTitles = new Set(spotifyAlbums.map(a => a.title.toLowerCase()));
    
    // Show first 10 from each
    const maxShow = Math.min(10, Math.max(mbAlbums.length, spotifyAlbums.length));
    for (let i = 0; i < maxShow; i++) {
      let mbText = '';
      let spotifyText = '';
      
      if (i < mbAlbums.length) {
        const mbAlbum = mbAlbums[i];
        mbText = `${mbAlbum.year || '????'} - ${mbAlbum.title.substring(0, 30)}`;
      }
      
      if (i < spotifyAlbums.length) {
        const spAlbum = spotifyAlbums[i];
        spotifyText = `${spAlbum.release_date || '????'} - ${spAlbum.title.substring(0, 30)}`;
      }
      
      console.log(`${mbText.padEnd(40)} | ${spotifyText.padEnd(40)}`);
    }
    
    // Analysis
    console.log(`\n📈 Analysis:`);
    const onlyMb = [...mbTitles].filter(t => !spotifyTitles.has(t));
    const onlySpotify = [...spotifyTitles].filter(t => !mbTitles.has(t));
    
    if (onlyMb.length > 0) {
      console.log(`\nOnly in MusicBrainz (${onlyMb.length}):`);
      onlyMb.slice(0, 5).forEach(title => console.log(`  - ${title}`));
      if (onlyMb.length > 5) {
        console.log(`  ... and ${onlyMb.length - 5} more`);
      }
    }
    
    if (onlySpotify.length > 0) {
      console.log(`\nOnly in Spotify (${onlySpotify.length}):`);
      onlySpotify.slice(0, 5).forEach(title => console.log(`  - ${title}`));
      if (onlySpotify.length > 5) {
        console.log(`  ... and ${onlySpotify.length - 5} more`);
      }
    }
    
    comparisonResults.push({
      artist: artist.name,
      mbCount: mbAlbums.length,
      spotifyCount: spotifyAlbums.length,
      onlyMb: onlyMb.length,
      onlySpotify: onlySpotify.length
    });
    
    // Rate limit (1 request per second as per MB guidelines)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(80));
  
  for (const result of comparisonResults) {
    console.log(`\n${result.artist}:`);
    console.log(`  MusicBrainz: ${result.mbCount} albums`);
    console.log(`  Spotify: ${result.spotifyCount} albums`);
    console.log(`  Only in MB: ${result.onlyMb}`);
    console.log(`  Only in Spotify: ${result.onlySpotify}`);
  }
  
  db.close();
}

// Run the comparison
compareWithSpotify().catch(console.error);