#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function getDiscogsArtist(discogsId: string) {
  const token = process.env.DISCOGS_API_TOKEN;
  const url = `https://api.discogs.com/artists/${discogsId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Discogs token=${token}`,
      'User-Agent': 'DaftFM/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get artist: ${response.status}`);
  }
  
  return await response.json();
}

async function searchDiscogsRelease(albumTitle: string, artistName: string, year?: number) {
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
    throw new Error(`Search error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Filter to match artist and year (if available)
  const matches = data.results?.filter((result: any) => {
    const resultArtist = result.title?.split(' - ')[0]?.toLowerCase();
    const artistMatch = resultArtist?.includes(artistName.toLowerCase()) || 
                       artistName.toLowerCase().includes(resultArtist || '');
    
    // If we have a year, prefer matches from that year
    if (year && result.year) {
      return artistMatch && Math.abs(result.year - year) <= 1; // Allow 1 year difference
    }
    
    return artistMatch;
  });
  
  return matches?.[0] || data.results?.[0] || null;
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

async function enrichDiscogsData() {
  console.log('💿 Enriching data from Discogs\n');
  
  const db = new Database('staging.db');
  
  // First, enrich artists with bios
  console.log('=== ENRICHING ARTISTS ===\n');
  
  const artists = db.prepare(`
    SELECT id, name, discogs_artist_id
    FROM artists
    WHERE discogs_artist_id IS NOT NULL 
      AND bio IS NULL
    LIMIT 20
  `).all() as any[];
  
  const artistUpdateStmt = db.prepare(`
    UPDATE artists 
    SET bio = ?, 
        bio_summary = ?,
        images = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  
  let artistsEnriched = 0;
  
  for (const artist of artists) {
    console.log(`\n🎤 ${artist.name} (Discogs: ${artist.discogs_artist_id})`);
    
    try {
      const discogsData = await getDiscogsArtist(artist.discogs_artist_id);
      
      const bio = discogsData.profile || null;
      const bioSummary = bio ? bio.substring(0, 200) + '...' : null;
      const images = discogsData.images?.map((img: any) => ({
        type: img.type,
        uri: img.uri,
        width: img.width,
        height: img.height
      })) || [];
      
      artistUpdateStmt.run(
        bio,
        bioSummary,
        JSON.stringify(images),
        artist.id
      );
      
      console.log(`   ✅ Bio: ${bio ? bio.substring(0, 60) + '...' : 'N/A'}`);
      console.log(`   🖼️  Images: ${images.length} added`);
      artistsEnriched++;
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Now enrich albums
  console.log('\n\n=== ENRICHING ALBUMS ===\n');
  
  const albums = db.prepare(`
    SELECT 
      a.id,
      a.title,
      a.release_date,
      ar.name as artist_name
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.genres IS NULL 
       OR a.catalog_number IS NULL
    LIMIT 30
  `).all() as any[];
  
  const albumUpdateStmt = db.prepare(`
    UPDATE albums 
    SET genres = ?,
        catalog_number = ?,
        barcode = ?,
        credits = ?,
        discogs_release_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  
  let albumsEnriched = 0;
  
  for (const album of albums) {
    console.log(`\n📀 ${album.artist_name} - ${album.title}`);
    
    try {
      // Extract year from release_date timestamp
      const year = album.release_date ? new Date(album.release_date * 1000).getFullYear() : undefined;
      
      const searchResult = await searchDiscogsRelease(album.title, album.artist_name, year);
      
      if (searchResult && searchResult.id) {
        const release = await getDiscogsRelease(searchResult.id);
        
        // Combine genres and styles
        const allGenres = [...(release.genres || []), ...(release.styles || [])];
        const genres = allGenres.length > 0 ? JSON.stringify(allGenres) : null;
        
        const catalogNumber = release.labels?.[0]?.catno || null;
        const barcode = release.identifiers?.find((i: any) => i.type === 'Barcode')?.value || null;
        
        // Format credits
        const credits: any = {};
        if (release.extraartists) {
          for (const artist of release.extraartists) {
            const role = artist.role.toLowerCase();
            if (!credits[role]) credits[role] = [];
            credits[role].push(artist.name);
          }
        }
        
        albumUpdateStmt.run(
          genres,
          catalogNumber,
          barcode,
          Object.keys(credits).length > 0 ? JSON.stringify(credits) : null,
          searchResult.id,
          album.id
        );
        
        console.log(`   ✅ Genres: ${allGenres.slice(0, 3).join(', ')}${allGenres.length > 3 ? '...' : ''}`);
        console.log(`   📝 Catalog: ${catalogNumber || 'N/A'}`);
        console.log(`   🔢 Barcode: ${barcode || 'N/A'}`);
        console.log(`   🎼 Credits: ${Object.keys(credits).length} roles`);
        albumsEnriched++;
      } else {
        console.log(`   ❌ Not found on Discogs`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  db.close();
  
  console.log('\n\n✅ Enrichment complete!');
  console.log(`Artists enriched: ${artistsEnriched}/${artists.length}`);
  console.log(`Albums enriched: ${albumsEnriched}/${albums.length}`);
  
  // Show updated stats
  const statsDb = new Database('staging.db');
  
  const artistStats = statsDb.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(bio) as with_bio,
      COUNT(images) as with_images
    FROM artists
  `).get() as any;
  
  const albumStats = statsDb.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(genres) as with_genres,
      COUNT(catalog_number) as with_catalog,
      COUNT(credits) as with_credits,
      COUNT(discogs_release_id) as with_discogs_id
    FROM albums
  `).get() as any;
  
  console.log('\n📊 Overall Stats:');
  console.log('\nArtists:');
  console.log(`  With bio: ${artistStats.with_bio}/${artistStats.total} (${Math.round(artistStats.with_bio / artistStats.total * 100)}%)`);
  console.log(`  With images: ${artistStats.with_images}/${artistStats.total} (${Math.round(artistStats.with_images / artistStats.total * 100)}%)`);
  
  console.log('\nAlbums:');
  console.log(`  With genres: ${albumStats.with_genres}/${albumStats.total} (${Math.round(albumStats.with_genres / albumStats.total * 100)}%)`);
  console.log(`  With catalog #: ${albumStats.with_catalog}/${albumStats.total} (${Math.round(albumStats.with_catalog / albumStats.total * 100)}%)`);
  console.log(`  With credits: ${albumStats.with_credits}/${albumStats.total} (${Math.round(albumStats.with_credits / albumStats.total * 100)}%)`);
  
  statsDb.close();
}

enrichDiscogsData().catch(console.error);