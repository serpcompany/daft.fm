#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function searchMusicBrainzRecording(title: string, artist: string, duration?: number, isrc?: string) {
  const baseUrl = 'https://musicbrainz.org/ws/2/recording';
  
  // Clean up title - remove remaster tags and other suffixes
  const cleanTitle = title
    .replace(/ - \d{4} Remaster(ed)?$/i, '')
    .replace(/ \(\d{4} Remaster(ed)?\)$/i, '')
    .replace(/ - Remaster(ed)?$/i, '')
    .replace(/ \(Remaster(ed)?\)$/i, '')
    .replace(/ - Single Version$/i, '')
    .replace(/ - Radio Edit$/i, '')
    .trim();
  
  // Try ISRC first if available
  if (isrc) {
    const isrcUrl = `${baseUrl}?query=isrc:${isrc}&fmt=json`;
    const response = await fetch(isrcUrl, {
      headers: { 'User-Agent': 'DaftFM/1.0' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.recordings?.length > 0) {
        return data.recordings[0];
      }
    }
  }
  
  // Fallback to title/artist search with cleaned title
  let query = `recording:"${cleanTitle}" AND artist:"${artist}"`;
  if (duration) {
    // Add duration with some tolerance (±5 seconds)
    const durMs = duration * 1000;
    query += ` AND dur:[${durMs - 5000} TO ${durMs + 5000}]`;
  }
  
  const searchUrl = `${baseUrl}?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'DaftFM/1.0' }
  });
  
  if (!response.ok) {
    throw new Error(`MusicBrainz error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Find best match
  const recordings = data.recordings || [];
  for (const recording of recordings) {
    // Check if artist matches
    const hasMatchingArtist = recording['artist-credit']?.some((credit: any) => 
      credit.artist.name.toLowerCase() === artist.toLowerCase()
    );
    
    if (hasMatchingArtist) {
      return recording;
    }
  }
  
  return recordings[0] || null;
}

async function reconcileSpotifyMusicBrainzSongs() {
  console.log('🔄 Reconciling Spotify Songs with MusicBrainz\n');
  
  const db = new Database('staging.db');
  
  // Get songs that don't have MusicBrainz IDs yet
  const songs = db.prepare(`
    SELECT 
      s.id,
      s.title,
      s.duration,
      s.isrc,
      s.spotify_track_id,
      ar.name as artist_name,
      ar.musicbrainz_id as artist_mbid,
      al.title as album_title
    FROM songs s
    JOIN artists ar ON s.artist_id = ar.id
    JOIN albums al ON s.album_id = al.id
    WHERE s.musicbrainz_recording_id IS NULL
    ORDER BY ar.name, al.release_date, s.track_number
    LIMIT 50
  `).all() as any[];
  
  console.log(`Found ${songs.length} songs to reconcile\n`);
  
  const updateStmt = db.prepare(`
    UPDATE songs 
    SET musicbrainz_recording_id = ?, 
        updated_at = datetime('now')
    WHERE id = ?
  `);
  
  let matched = 0;
  let failed = 0;
  
  for (const song of songs) {
    console.log(`\n🎵 ${song.artist_name} - ${song.title}`);
    
    // Show cleaned title if different
    const cleanTitle = song.title
      .replace(/ - \d{4} Remaster(ed)?$/i, '')
      .replace(/ \(\d{4} Remaster(ed)?\)$/i, '')
      .replace(/ - Remaster(ed)?$/i, '')
      .replace(/ \(Remaster(ed)?\)$/i, '')
      .replace(/ - Single Version$/i, '')
      .replace(/ - Radio Edit$/i, '')
      .trim();
    
    if (cleanTitle !== song.title) {
      console.log(`   🧹 Clean title: ${cleanTitle}`);
    }
    
    try {
      const recording = await searchMusicBrainzRecording(
        song.title,
        song.artist_name,
        song.duration,
        song.isrc
      );
      
      if (recording) {
        console.log(`   ✅ Found: ${recording.title} by ${recording['artist-credit']?.[0]?.artist?.name}`);
        console.log(`   📝 MBID: ${recording.id}`);
        console.log(`   ⏱️  Duration: ${Math.floor(recording.length / 1000)}s (vs ${song.duration}s)`);
        
        if (recording.isrcs?.length > 0) {
          console.log(`   🔢 ISRCs: ${recording.isrcs.join(', ')}`);
        }
        
        // Update the database
        updateStmt.run(recording.id, song.id);
        matched++;
      } else {
        console.log(`   ❌ No match found`);
        failed++;
      }
      
      // Be nice to MusicBrainz rate limits (1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  db.close();
  
  console.log('\n\n✅ Reconciliation complete!');
  console.log(`Matched: ${matched}/${songs.length}`);
  console.log(`Failed: ${failed}/${songs.length}`);
  
  // Show updated stats
  const statsDb = new Database('staging.db');
  const stats = statsDb.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(musicbrainz_recording_id) as with_mb,
      COUNT(spotify_track_id) as with_spotify,
      COUNT(isrc) as with_isrc
    FROM songs
  `).get() as any;
  
  console.log('\n📊 Overall Song Stats:');
  console.log(`Total songs: ${stats.total}`);
  console.log(`With MusicBrainz ID: ${stats.with_mb} (${Math.round(stats.with_mb / stats.total * 100)}%)`);
  console.log(`With Spotify ID: ${stats.with_spotify} (${Math.round(stats.with_spotify / stats.total * 100)}%)`);
  console.log(`With ISRC: ${stats.with_isrc} (${Math.round(stats.with_isrc / stats.total * 100)}%)`);
  
  statsDb.close();
}

reconcileSpotifyMusicBrainzSongs().catch(console.error);