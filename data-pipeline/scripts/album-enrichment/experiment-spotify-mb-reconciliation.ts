#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

// Test different approaches to reconcile Spotify albums to MusicBrainz

async function experimentReconciliation() {
  console.log('🧪 Experimenting with Spotify → MusicBrainz reconciliation\n');
  
  const db = new Database('staging.db');
  
  // Get a few test albums
  const testAlbums = db.prepare(`
    SELECT a.title, a.spotify_album_id, ar.name as artist_name, ar.musicbrainz_id as artist_mbid
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.spotify_album_id IS NOT NULL
    LIMIT 5
  `).all() as any[];
  
  console.log(`Testing with ${testAlbums.length} albums:\n`);
  
  for (const album of testAlbums) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎵 ${album.artist_name} - ${album.title}`);
    console.log(`Spotify ID: ${album.spotify_album_id}`);
    console.log(`Artist MBID: ${album.artist_mbid || 'N/A'}`);
    console.log('='.repeat(80));
    
    // Approach 1: Search by Spotify URL
    console.log('\n📍 Approach 1: Search MusicBrainz by Spotify URL');
    try {
      const spotifyUrl = `https://open.spotify.com/album/${album.spotify_album_id}`;
      const mbUrlSearch = `https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(spotifyUrl)}&inc=release-rels&fmt=json`;
      
      const response = await fetch(mbUrlSearch, {
        headers: {
          'User-Agent': 'DaftFM/1.0 (https://daft.fm)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.relations && data.relations.length > 0) {
          console.log(`✅ Found ${data.relations.length} release(s) linked to this Spotify album!`);
          for (const rel of data.relations) {
            if (rel.release) {
              console.log(`   - Release: ${rel.release.title} (${rel.release.id})`);
              console.log(`     Date: ${rel.release.date || 'Unknown'}`);
            }
          }
        } else {
          console.log('❌ No MusicBrainz releases linked to this Spotify URL');
        }
      } else {
        console.log(`❌ Failed to search by URL: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Error searching by Spotify URL:', error);
    }
    
    // Wait to respect rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Approach 2: Search by album title and artist
    console.log('\n📍 Approach 2: Search by Album Title + Artist');
    try {
      const query = `release:"${album.title.replace(/"/g, '\\"')}" AND artist:"${album.artist_name.replace(/"/g, '\\"')}"`;
      const mbSearch = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&limit=5&fmt=json`;
      
      const response = await fetch(mbSearch, {
        headers: {
          'User-Agent': 'DaftFM/1.0 (https://daft.fm)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.releases && data.releases.length > 0) {
          console.log(`✅ Found ${data.releases.length} potential matches:`);
          for (const release of data.releases) {
            console.log(`   - ${release.title} (${release.id})`);
            console.log(`     Status: ${release.status || 'Unknown'}`);
            console.log(`     Date: ${release.date || 'Unknown'}`);
            console.log(`     Country: ${release.country || 'Unknown'}`);
            console.log(`     Label: ${release['label-info']?.[0]?.label?.name || 'Unknown'}`);
          }
        } else {
          console.log('❌ No releases found by title/artist search');
        }
      } else {
        console.log(`❌ Failed to search by title: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Error searching by title/artist:', error);
    }
    
    // Wait to respect rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Approach 3: If we have artist MBID, search release groups
    if (album.artist_mbid) {
      console.log('\n📍 Approach 3: Search Release Groups by Artist MBID');
      try {
        const rgSearch = `https://musicbrainz.org/ws/2/release-group?artist=${album.artist_mbid}&type=album&limit=100&fmt=json`;
        
        const response = await fetch(rgSearch, {
          headers: {
            'User-Agent': 'DaftFM/1.0 (https://daft.fm)'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data['release-groups']) {
            // Try to find matching album by title
            const matches = data['release-groups'].filter((rg: any) => {
              const rgTitle = rg.title.toLowerCase();
              const albumTitle = album.title.toLowerCase();
              return rgTitle === albumTitle || 
                     rgTitle.includes(albumTitle) || 
                     albumTitle.includes(rgTitle);
            });
            
            if (matches.length > 0) {
              console.log(`✅ Found ${matches.length} matching release group(s):`);
              for (const rg of matches) {
                console.log(`   - ${rg.title} (${rg.id})`);
                console.log(`     Type: ${rg['primary-type']}`);
                console.log(`     First release: ${rg['first-release-date'] || 'Unknown'}`);
              }
            } else {
              console.log(`❌ No matching release groups found among ${data['release-groups'].length} albums`);
            }
          }
        } else {
          console.log(`❌ Failed to search release groups: ${response.status}`);
        }
      } catch (error) {
        console.log('❌ Error searching release groups:', error);
      }
    }
    
    // Wait before next album
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  
  db.close();
  
  console.log('\n\n📊 Summary:');
  console.log('- Spotify URL search: Most accurate when available');
  console.log('- Title/Artist search: Many duplicates, need filtering');
  console.log('- Release Group search: Good if we have artist MBID');
}

experimentReconciliation().catch(console.error);