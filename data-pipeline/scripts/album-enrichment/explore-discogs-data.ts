#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function searchDiscogsArtist(artistName: string, discogsId?: string) {
  const token = process.env.DISCOGS_API_TOKEN;
  const headers = {
    'Authorization': `Discogs token=${token}`,
    'User-Agent': 'DaftFM/1.0'
  };
  
  // If we have a Discogs ID, get directly
  if (discogsId) {
    const url = `https://api.discogs.com/artists/${discogsId}`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      return await response.json();
    }
  }
  
  // Otherwise search
  const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist`;
  const response = await fetch(searchUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Discogs error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.results?.[0] || null;
}

async function getDiscogsRelease(releaseId: string) {
  const token = process.env.DISCOGS_API_TOKEN;
  const url = `https://api.discogs.com/releases/${releaseId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Discogs token=${token}`,
      'User-Agent': 'DaftFM/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get release: ${response.status}`);
  }
  
  return await response.json();
}

async function searchDiscogsAlbum(albumTitle: string, artistName: string) {
  const token = process.env.DISCOGS_API_TOKEN;
  const query = `${artistName} ${albumTitle}`;
  const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=album`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Discogs token=${token}`,
      'User-Agent': 'DaftFM/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Discogs search error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Filter to match artist
  const matches = data.results?.filter((result: any) => {
    const resultArtist = result.title?.split(' - ')[0]?.toLowerCase();
    return resultArtist?.includes(artistName.toLowerCase()) || 
           artistName.toLowerCase().includes(resultArtist || '');
  });
  
  return matches?.[0] || null;
}

async function exploreDiscogsData() {
  console.log('💿 Exploring Discogs API\n');
  
  const db = new Database('staging.db');
  
  // Get a sample of artists and albums
  const artists = db.prepare(`
    SELECT 
      id,
      name,
      discogs_artist_id
    FROM artists
    WHERE name IN ('The Beatles', 'Daft Punk', 'Radiohead')
    ORDER BY name
  `).all() as any[];
  
  console.log('=== ARTIST DATA ===\n');
  
  for (const artist of artists) {
    console.log(`\n🎤 ${artist.name}`);
    
    try {
      const discogsArtist = await searchDiscogsArtist(artist.name, artist.discogs_artist_id);
      
      if (discogsArtist) {
        console.log(`   ✅ Found: ${discogsArtist.name || discogsArtist.title}`);
        console.log(`   📝 ID: ${discogsArtist.id}`);
        
        // If we got search result, fetch full details
        if (!discogsArtist.profile && discogsArtist.id) {
          const fullArtist = await searchDiscogsArtist(artist.name, discogsArtist.id);
          if (fullArtist) {
            console.log(`   📖 Bio: ${fullArtist.profile?.substring(0, 100)}...`);
            console.log(`   🖼️  Images: ${fullArtist.images?.length || 0} available`);
            console.log(`   🏷️  Aliases: ${fullArtist.aliases?.map((a: any) => a.name).join(', ') || 'None'}`);
            console.log(`   👥 Members: ${fullArtist.members?.map((m: any) => m.name).join(', ') || 'N/A'}`);
            console.log(`   🌐 URLs: ${fullArtist.urls?.join(', ') || 'None'}`);
          }
        }
      } else {
        console.log(`   ❌ Not found`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n=== ALBUM DATA ===\n');
  
  // Get sample albums
  const albums = db.prepare(`
    SELECT 
      a.id,
      a.title,
      a.release_date,
      a.spotify_album_id,
      ar.name as artist_name
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE ar.name IN ('The Beatles', 'Daft Punk', 'Radiohead')
    ORDER BY ar.name, a.release_date
    LIMIT 6
  `).all() as any[];
  
  for (const album of albums) {
    console.log(`\n📀 ${album.artist_name} - ${album.title}`);
    
    try {
      const searchResult = await searchDiscogsAlbum(album.title, album.artist_name);
      
      if (searchResult) {
        console.log(`   ✅ Found: ${searchResult.title}`);
        console.log(`   📝 ID: ${searchResult.id}`);
        
        // Get full release details
        if (searchResult.id) {
          const release = await getDiscogsRelease(searchResult.id);
          
          console.log(`   📅 Year: ${release.year}`);
          console.log(`   🏷️  Label: ${release.labels?.[0]?.name} (${release.labels?.[0]?.catno})`);
          console.log(`   🎭 Genres: ${release.genres?.join(', ') || 'None'}`);
          console.log(`   🎨 Styles: ${release.styles?.join(', ') || 'None'}`);
          console.log(`   📊 Format: ${release.formats?.[0]?.name} ${release.formats?.[0]?.descriptions?.join(', ') || ''}`);
          console.log(`   🔢 Catalog #: ${release.labels?.[0]?.catno || 'N/A'}`);
          console.log(`   📊 Barcode: ${release.identifiers?.find((i: any) => i.type === 'Barcode')?.value || 'N/A'}`);
          
          // Credits
          if (release.extraartists?.length > 0) {
            console.log(`   🎼 Credits:`);
            const credits = release.extraartists.slice(0, 5);
            for (const credit of credits) {
              console.log(`      - ${credit.role}: ${credit.name}`);
            }
            if (release.extraartists.length > 5) {
              console.log(`      ... and ${release.extraartists.length - 5} more`);
            }
          }
          
          // Tracklist
          console.log(`   🎵 Tracks: ${release.tracklist?.length || 0}`);
          if (release.tracklist?.length > 0) {
            const firstTrack = release.tracklist[0];
            console.log(`      Example: ${firstTrack.position}. ${firstTrack.title} (${firstTrack.duration || 'N/A'})`);
          }
        }
      } else {
        console.log(`   ❌ Not found`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  db.close();
  
  console.log('\n\n📊 Summary:');
  console.log('✅ Discogs provides:');
  console.log('   - Artist profiles/bios');
  console.log('   - Artist images');
  console.log('   - Album genres & styles');
  console.log('   - Album credits (producers, engineers, etc.)');
  console.log('   - Catalog numbers & barcodes');
  console.log('   - Label information');
  console.log('   - Detailed tracklists with durations');
  console.log('\n❌ Discogs does NOT provide:');
  console.log('   - Lyrics');
  console.log('   - Streaming popularity data');
  console.log('   - Audio previews');
}

exploreDiscogsData().catch(console.error);