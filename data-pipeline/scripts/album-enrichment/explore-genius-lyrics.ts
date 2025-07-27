#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function searchGeniusSong(query: string, artistName: string) {
  const token = process.env.GENIUS_API_CLIENT_ACCESS_TOKEN;
  
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Genius API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Filter results to match artist
  const matches = data.response.hits.filter((hit: any) => {
    const primaryArtist = hit.result.primary_artist.name.toLowerCase();
    return primaryArtist.includes(artistName.toLowerCase()) || 
           artistName.toLowerCase().includes(primaryArtist);
  });
  
  return matches[0]?.result || null;
}

async function getGeniusLyrics(songPath: string) {
  // Note: Genius API doesn't provide lyrics directly
  // We'd need to scrape the webpage or use a third-party service
  // For now, we'll just get the metadata and URL
  const token = process.env.GENIUS_API_CLIENT_ACCESS_TOKEN;
  const songId = songPath.split('/').pop();
  
  const url = `https://api.genius.com/songs/${songId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get song details: ${response.status}`);
  }
  
  const data = await response.json();
  return data.response.song;
}

async function exploreGeniusAPI() {
  console.log('🎤 Exploring Genius API for Lyrics\n');
  
  const db = new Database('staging.db');
  
  // Get a sample of songs to test with
  const songs = db.prepare(`
    SELECT 
      s.id,
      s.title,
      s.spotify_track_id,
      s.isrc,
      ar.name as artist_name,
      ar.spotify_artist_id,
      al.title as album_title
    FROM songs s
    JOIN artists ar ON s.artist_id = ar.id
    JOIN albums al ON s.album_id = al.id
    WHERE ar.name IN ('The Beatles', 'Daft Punk', 'Radiohead')
    ORDER BY ar.name, al.release_date, s.track_number
    LIMIT 10
  `).all() as any[];
  
  console.log(`Testing with ${songs.length} songs\n`);
  
  for (const song of songs) {
    console.log(`\n🎵 ${song.artist_name} - ${song.title}`);
    console.log(`   Album: ${song.album_title}`);
    
    try {
      // Search for the song
      const query = `${song.artist_name} ${song.title}`;
      const result = await searchGeniusSong(query, song.artist_name);
      
      if (result) {
        console.log(`   ✅ Found on Genius: ${result.full_title}`);
        console.log(`   📝 Genius ID: ${result.id}`);
        console.log(`   🔗 URL: ${result.url}`);
        console.log(`   📊 Stats: ${result.stats.pageviews || 'N/A'} views`);
        
        // Get more details
        const details = await getGeniusLyrics(result.api_path);
        
        console.log(`   ✍️  Writers: ${details.writer_artists?.map((w: any) => w.name).join(', ') || 'Unknown'}`);
        console.log(`   🎼 Producers: ${details.producer_artists?.map((p: any) => p.name).join(', ') || 'Unknown'}`);
        console.log(`   📅 Release: ${details.release_date || 'Unknown'}`);
        
        // Note about lyrics
        console.log(`   📄 Lyrics available at: ${result.url}`);
        console.log(`   ⚠️  Note: Direct lyrics API not available - would need web scraping`);
        
        // Check for annotations
        if (details.annotation_count > 0) {
          console.log(`   💡 Has ${details.annotation_count} annotations`);
        }
      } else {
        console.log(`   ❌ Not found on Genius`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  db.close();
  
  console.log('\n\n📊 Summary:');
  console.log('1. Genius API provides song metadata and URLs');
  console.log('2. Direct lyrics access requires web scraping');
  console.log('3. Good for credits (writers, producers) and annotations');
  console.log('4. Has unique Genius IDs for entity resolution');
  console.log('\n💡 Alternative: Musixmatch API might provide direct lyrics access');
}

exploreGeniusAPI().catch(console.error);