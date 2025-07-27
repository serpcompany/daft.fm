#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

// Strategy: Try multiple approaches in order of accuracy
async function reconcileSpotifyToMusicBrainz() {
  console.log('🔄 Reconciling Spotify Albums to MusicBrainz\n');
  
  const db = new Database('staging.db');
  
  // Get all albums without MB IDs
  const albums = db.prepare(`
    SELECT 
      a.id,
      a.title,
      a.spotify_album_id,
      ar.name as artist_name,
      ar.musicbrainz_id as artist_mbid,
      a.release_date
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.musicbrainz_release_id IS NULL
    ORDER BY ar.name, a.release_date
  `).all() as any[];
  
  console.log(`Found ${albums.length} albums to reconcile\n`);
  
  const updateStmt = db.prepare(`
    UPDATE albums 
    SET musicbrainz_release_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  
  let reconciled = 0;
  let attempted = 0;
  
  // Process in batches to respect rate limits
  for (const album of albums) {
    attempted++;
    console.log(`\n[${attempted}/${albums.length}] ${album.artist_name} - ${album.title}`);
    
    let mbReleaseId = null;
    let mbReleaseGroupId = null;
    
    // Strategy 1: Try Spotify URL lookup first (most accurate)
    try {
      const spotifyUrl = `https://open.spotify.com/album/${album.spotify_album_id}`;
      const response = await fetch(
        `https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(spotifyUrl)}&inc=release-rels&fmt=json`,
        { headers: { 'User-Agent': 'DaftFM/1.0 (https://daft.fm)' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.relations?.length > 0) {
          // Get the first official release
          const release = data.relations.find((r: any) => 
            r.release?.status === 'Official' || !r.release?.status
          )?.release || data.relations[0].release;
          
          if (release) {
            mbReleaseId = release.id;
            console.log(`  ✅ Found via Spotify URL: ${release.title} (${release.id})`);
          }
        }
      }
    } catch (error) {
      console.log('  ⚠️  Spotify URL lookup failed');
    }
    
    // Strategy 2: If we have artist MBID, search by release group
    if (!mbReleaseId && album.artist_mbid) {
      await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit
      
      try {
        const response = await fetch(
          `https://musicbrainz.org/ws/2/release-group?artist=${album.artist_mbid}&type=album&limit=100&fmt=json`,
          { headers: { 'User-Agent': 'DaftFM/1.0 (https://daft.fm)' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          // Find best match by title similarity
          const cleanAlbumTitle = album.title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          const matches = data['release-groups']?.filter((rg: any) => {
            const cleanRgTitle = rg.title.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            return cleanRgTitle === cleanAlbumTitle;
          }) || [];
          
          if (matches.length > 0) {
            // Get the release group that matches our year best
            const bestMatch = matches.reduce((best: any, current: any) => {
              const bestYear = parseInt(best['first-release-date']?.substring(0, 4) || '0');
              const currentYear = parseInt(current['first-release-date']?.substring(0, 4) || '0');
              const albumYear = album.release_date;
              
              if (Math.abs(currentYear - albumYear) < Math.abs(bestYear - albumYear)) {
                return current;
              }
              return best;
            });
            
            mbReleaseGroupId = bestMatch.id;
            console.log(`  ✅ Found release group: ${bestMatch.title} (${bestMatch.id})`);
            
            // Now get a specific release from this group
            await new Promise(resolve => setTimeout(resolve, 1100));
            const releaseResponse = await fetch(
              `https://musicbrainz.org/ws/2/release?release-group=${mbReleaseGroupId}&status=official&limit=1&fmt=json`,
              { headers: { 'User-Agent': 'DaftFM/1.0 (https://daft.fm)' } }
            );
            
            if (releaseResponse.ok) {
              const releaseData = await releaseResponse.json();
              if (releaseData.releases?.length > 0) {
                mbReleaseId = releaseData.releases[0].id;
                console.log(`    → Got release: ${releaseData.releases[0].id}`);
              }
            }
          }
        }
      } catch (error) {
        console.log('  ⚠️  Release group search failed');
      }
    }
    
    // Strategy 3: Fallback to title/artist search
    if (!mbReleaseId) {
      await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit
      
      try {
        const query = `release:"${album.title.replace(/"/g, '\\"')}" AND artist:"${album.artist_name.replace(/"/g, '\\"')}"`;
        const response = await fetch(
          `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&status=official&limit=5&fmt=json`,
          { headers: { 'User-Agent': 'DaftFM/1.0 (https://daft.fm)' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          // Find best match by year
          if (data.releases?.length > 0) {
            const bestMatch = data.releases.reduce((best: any, current: any) => {
              const bestYear = parseInt(best.date?.substring(0, 4) || '0');
              const currentYear = parseInt(current.date?.substring(0, 4) || '0');
              const albumYear = album.release_date;
              
              if (Math.abs(currentYear - albumYear) < Math.abs(bestYear - albumYear)) {
                return current;
              }
              return best;
            });
            
            mbReleaseId = bestMatch.id;
            console.log(`  ✅ Found via search: ${bestMatch.title} (${bestMatch.id})`);
          }
        }
      } catch (error) {
        console.log('  ⚠️  Title/artist search failed');
      }
    }
    
    // Update database if we found a match
    if (mbReleaseId) {
      updateStmt.run(mbReleaseId, album.id);
      reconciled++;
      console.log(`  💾 Saved MB release ID`);
    } else {
      console.log(`  ❌ No match found`);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Progress update every 10 albums
    if (attempted % 10 === 0) {
      console.log(`\n📊 Progress: ${reconciled}/${attempted} reconciled (${(reconciled/attempted*100).toFixed(1)}%)`);
    }
  }
  
  db.close();
  
  console.log('\n\n✅ Reconciliation complete!');
  console.log(`Total albums: ${albums.length}`);
  console.log(`Successfully reconciled: ${reconciled} (${(reconciled/albums.length*100).toFixed(1)}%)`);
  console.log(`Failed to match: ${albums.length - reconciled}`);
}

reconcileSpotifyToMusicBrainz().catch(console.error);