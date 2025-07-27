#!/usr/bin/env tsx

import 'dotenv/config';
import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

async function testDiscogsAlbums() {
  console.log('🎵 Testing Discogs Master Releases for Canonical Albums\n');
  
  // Get artists from staging
  const testArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  for (const artist of testArtists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist.name}`);
    console.log(`${'='.repeat(80)}`);
    
    if (!artist.discogsArtistId) {
      console.log('❌ No Discogs ID');
      continue;
    }
    
    // Parse Discogs ID from [a12345] format
    const discogsId = artist.discogsArtistId.match(/\[a(\d+)\]/)?.[1];
    if (!discogsId) {
      console.log('❌ Invalid Discogs ID format');
      continue;
    }
    
    try {
      // Get all releases for artist
      const response = await fetch(
        `https://api.discogs.com/artists/${discogsId}/releases?per_page=100&sort=year`,
        {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        }
      );
      
      const data = await response.json();
      console.log(`Total releases: ${data.pagination?.items || 0}`);
      
      // Filter for master releases only
      const masters = data.releases?.filter((r: any) => 
        r.type === 'master' && 
        r.role === 'Main'
      ) || [];
      
      console.log(`Master releases: ${masters.length}`);
      
      // Categorize masters
      const studioAlbums: any[] = [];
      const liveAlbums: any[] = [];
      const compilations: any[] = [];
      const singles: any[] = [];
      const other: any[] = [];
      
      for (const master of masters) {
        const format = (master.format || '').toLowerCase();
        const title = (master.title || '').toLowerCase();
        
        // Skip if it's a single or EP
        if (format.includes('single') || format.includes('ep') || 
            format.includes('7"') || format.includes('12"')) {
          singles.push(master);
        }
        // Skip compilations
        else if (title.includes('best of') || title.includes('greatest') || 
                 title.includes('collection') || format.includes('comp')) {
          compilations.push(master);
        }
        // Skip live albums
        else if (title.includes('live') || title.includes('concert')) {
          liveAlbums.push(master);
        }
        // Studio albums (what we want!)
        else if (format.includes('album') || format.includes('lp') || 
                 format.includes('cd') || format === '') {
          studioAlbums.push(master);
        }
        else {
          other.push(master);
        }
      }
      
      console.log('\nBreakdown:');
      console.log(`- Studio Albums: ${studioAlbums.length}`);
      console.log(`- Live Albums: ${liveAlbums.length}`);
      console.log(`- Compilations: ${compilations.length}`);
      console.log(`- Singles/EPs: ${singles.length}`);
      console.log(`- Other: ${other.length}`);
      
      console.log('\n📀 STUDIO ALBUMS (Canonical):');
      console.log('─'.repeat(50));
      
      // Sort by year
      studioAlbums.sort((a, b) => (a.year || 9999) - (b.year || 9999));
      
      for (const album of studioAlbums) {
        console.log(`${album.year || '????'} - ${album.title}`);
        console.log(`      Master ID: ${album.id}`);
        console.log(`      Format: ${album.format || 'Unknown'}`);
      }
      
      // Get details for first album to check what data is available
      if (studioAlbums.length > 0) {
        console.log('\n📋 Sample Master Details:');
        console.log('─'.repeat(50));
        
        const firstMaster = studioAlbums[0];
        const masterResponse = await fetch(
          `https://api.discogs.com/masters/${firstMaster.id}`,
          {
            headers: {
              'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
              'User-Agent': 'DaftFmDataPipeline/1.0'
            }
          }
        );
        
        const masterData = await masterResponse.json();
        
        console.log(`Title: ${masterData.title}`);
        console.log(`Year: ${masterData.year}`);
        console.log(`Genres: ${masterData.genres?.join(', ')}`);
        console.log(`Styles: ${masterData.styles?.join(', ')}`);
        console.log(`Tracks: ${masterData.tracklist?.length}`);
        console.log(`Images: ${masterData.images?.length}`);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  console.log('\n\n📊 COMPARISON WITH SPOTIFY:');
  console.log('─'.repeat(50));
  console.log('Spotify gave us 96 albums total (including live, soundtracks, etc.)');
  console.log('Discogs Masters can be filtered to just studio albums');
  console.log('Discogs provides genre/style data that Spotify doesn\'t');
}

testDiscogsAlbums().catch(console.error);