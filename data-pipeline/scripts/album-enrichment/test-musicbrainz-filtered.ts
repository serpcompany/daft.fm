#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'DaftFM-DataPipeline/1.0 (https://daft.fm)';

interface ReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string;
  'secondary-type-list'?: string[];
  'first-release-date'?: string;
  releases?: Release[];
}

interface Release {
  id: string;
  title: string;
  status?: string;
  country?: string;
  date?: string;
  'release-events'?: any[];
}

async function fetchFilteredReleaseGroups(artistMbid: string, artistName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎤 ${artistName}`);
  console.log('='.repeat(60));
  
  try {
    // Fetch release groups with more specific filtering
    // Only get albums (no singles, EPs, broadcasts, etc.)
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
    let releaseGroups = data['release-groups'] || [];
    
    // Filter out compilations, live albums, soundtracks
    releaseGroups = releaseGroups.filter((rg: ReleaseGroup) => {
      const secondaryTypes = rg['secondary-type-list'] || [];
      
      // Exclude if it has any of these secondary types
      const excludeTypes = ['Compilation', 'Live', 'Soundtrack', 'Remix', 'DJ-mix', 'Mixtape/Street'];
      return !secondaryTypes.some(type => excludeTypes.includes(type));
    });
    
    console.log(`\nAfter filtering: ${releaseGroups.length} studio albums`);
    
    // Sort by first release date
    releaseGroups.sort((a: ReleaseGroup, b: ReleaseGroup) => 
      (a['first-release-date'] || '9999').localeCompare(b['first-release-date'] || '9999')
    );
    
    return releaseGroups.map((rg: ReleaseGroup) => ({
      mbid: rg.id,
      title: rg.title,
      type: rg['primary-type'] || 'Unknown',
      secondaryTypes: rg['secondary-type-list'] || [],
      firstReleaseDate: rg['first-release-date'] || null,
      year: rg['first-release-date']?.substring(0, 4) || null
    }));
    
  } catch (error) {
    console.error(`Error fetching data: ${error}`);
    return [];
  }
}

async function compareFilteredWithSpotify() {
  console.log('🎯 Comparing FILTERED MusicBrainz with Spotify data\n');
  console.log('Filtering out: Compilations, Live albums, Soundtracks, Remixes, DJ-mixes\n');
  
  const db = new Database('staging.db');
  
  // Get artists with MusicBrainz IDs who have albums
  const artists = db.prepare(`
    SELECT DISTINCT a.id, a.name, a.musicbrainz_id 
    FROM artists a
    JOIN albums al ON a.id = al.artist_id
    WHERE a.musicbrainz_id IS NOT NULL
    LIMIT 3
  `).all() as any[];
  
  const comparisonResults = [];
  
  for (const artist of artists) {
    console.log(`\n\n${'*'.repeat(80)}`);
    console.log(`Comparing albums for: ${artist.name}`);
    console.log('*'.repeat(80));
    
    // Get filtered albums from MusicBrainz
    const mbAlbums = await fetchFilteredReleaseGroups(artist.musicbrainz_id, artist.name);
    
    // Get albums from our Spotify data
    const spotifyAlbums = db.prepare(`
      SELECT title, release_date, spotify_album_id 
      FROM albums 
      WHERE artist_id = ?
      ORDER BY release_date
    `).all(artist.id) as any[];
    
    console.log(`\n📊 Comparison:`);
    console.log(`MusicBrainz studio albums: ${mbAlbums.length}`);
    console.log(`Spotify albums in DB: ${spotifyAlbums.length}`);
    
    // Show side by side
    console.log(`\n${'MusicBrainz (Filtered)'.padEnd(40)} | ${'Spotify (in our DB)'.padEnd(40)}`);
    console.log(`${'-'.repeat(40)} | ${'-'.repeat(40)}`);
    
    // Show all albums side by side
    const maxShow = Math.max(mbAlbums.length, spotifyAlbums.length);
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
    
    // Create normalized title sets for comparison
    const normalizeTitle = (title: string) => 
      title.toLowerCase()
        .replace(/[^a-z0-9]/g, '')  // Remove all non-alphanumeric
        .replace(/remastered/g, '')
        .replace(/deluxe/g, '')
        .replace(/edition/g, '');
    
    const mbTitlesNormalized = new Map(mbAlbums.map(a => [normalizeTitle(a.title), a.title]));
    const spotifyTitlesNormalized = new Map(spotifyAlbums.map(a => [normalizeTitle(a.title), a.title]));
    
    // Find matches and differences
    const matched = [];
    const onlyMb = [];
    const onlySpotify = [];
    
    for (const [norm, title] of mbTitlesNormalized) {
      if (spotifyTitlesNormalized.has(norm)) {
        matched.push(title);
      } else {
        onlyMb.push(title);
      }
    }
    
    for (const [norm, title] of spotifyTitlesNormalized) {
      if (!mbTitlesNormalized.has(norm)) {
        onlySpotify.push(title);
      }
    }
    
    console.log(`\n📈 Analysis:`);
    console.log(`Matched albums: ${matched.length}`);
    
    if (onlyMb.length > 0) {
      console.log(`\nOnly in MusicBrainz (${onlyMb.length}):`);
      onlyMb.forEach(title => console.log(`  - ${title}`));
    }
    
    if (onlySpotify.length > 0) {
      console.log(`\nOnly in Spotify (${onlySpotify.length}):`);
      onlySpotify.forEach(title => console.log(`  - ${title}`));
    }
    
    comparisonResults.push({
      artist: artist.name,
      mbCount: mbAlbums.length,
      spotifyCount: spotifyAlbums.length,
      matched: matched.length,
      onlyMb: onlyMb.length,
      onlySpotify: onlySpotify.length
    });
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(80));
  
  for (const result of comparisonResults) {
    console.log(`\n${result.artist}:`);
    console.log(`  MusicBrainz: ${result.mbCount} studio albums`);
    console.log(`  Spotify: ${result.spotifyCount} albums`);
    console.log(`  Matched: ${result.matched} albums`);
    console.log(`  Only in MB: ${result.onlyMb}`);
    console.log(`  Only in Spotify: ${result.onlySpotify}`);
  }
  
  db.close();
}

// Run the comparison
compareFilteredWithSpotify().catch(console.error);