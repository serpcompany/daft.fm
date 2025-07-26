#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from parent directory
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });
import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

// Test getting data from various APIs for enrichment
async function exploreEnrichmentAPIs() {
  console.log('🔍 Exploring enrichment APIs...\n');
  
  // Get a sample artist from our staging DB
  const sampleArtists = await stagingDb
    .select()
    .from(artists)
    .limit(1)
    .all();
  
  if (sampleArtists.length === 0) {
    console.log('No artists in staging DB. Run save-artists-to-staging.ts first.');
    return;
  }
  
  const artist = sampleArtists[0];
  console.log(`Testing with artist: ${artist.name}\n`);
  
  // 1. Test Wikidata for streaming IDs
  if (artist.wikidataEntityId) {
    console.log('=== WIKIDATA TEST ===');
    await testWikidata(artist.wikidataEntityId);
  }
  
  // 2. Test Last.fm for bio and images
  console.log('\n=== LAST.FM TEST ===');
  await testLastFm(artist.name, artist.musicbrainzId);
  
  // 3. Test Spotify for images
  if (artist.spotifyArtistId) {
    console.log('\n=== SPOTIFY TEST ===');
    await testSpotify(artist.spotifyArtistId);
  }
  
  // 4. Test Discogs for images
  if (artist.discogsArtistId) {
    console.log('\n=== DISCOGS TEST ===');
    const discogsId = artist.discogsArtistId.replace(/[\[\]]/g, '').replace('a', '');
    await testDiscogs(discogsId);
  }
}

async function testWikidata(wikidataId: string) {
  try {
    // SPARQL query to get all external identifiers
    const sparqlQuery = `
      SELECT ?property ?value WHERE {
        wd:${wikidataId} ?property ?value .
        ?prop wikibase:directClaim ?property .
        ?prop wikibase:propertyType wikibase:ExternalId .
      }
    `;
    
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Found external IDs from Wikidata:');
    
    // Look for specific streaming IDs
    const streamingIds: Record<string, string> = {};
    for (const binding of data.results.bindings) {
      const prop = binding.property.value;
      const value = binding.value.value;
      
      // Check for streaming platform IDs
      if (prop.includes('P4404')) streamingIds['MusicBrainz'] = value;
      if (prop.includes('P2722')) streamingIds['Deezer'] = value;
      if (prop.includes('P4073')) streamingIds['Tidal'] = value;
      if (prop.includes('P2281')) streamingIds['Apple Music'] = value;
      if (prop.includes('P345')) streamingIds['IMDb'] = value;
      if (prop.includes('P1902')) streamingIds['Spotify'] = value;
    }
    
    console.log('Streaming IDs found:', streamingIds);
    console.log(`Total external IDs: ${data.results.bindings.length}`);
    
  } catch (error) {
    console.error('Wikidata error:', error);
  }
}

async function testLastFm(artistName: string, mbid: string) {
  try {
    const apiKey = process.env.LAST_FM_API_KEY;
    console.log('Using Last.fm API key:', apiKey ? 'Found' : 'Missing');
    
    const params = new URLSearchParams({
      method: 'artist.getinfo',
      artist: artistName,
      mbid: mbid,
      api_key: apiKey!,
      format: 'json'
    });
    
    const url = `https://ws.audioscrobbler.com/2.0/?${params}`;
    console.log('Fetching:', url.replace(apiKey!, 'HIDDEN'));
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.log('Last.fm error:', data.message);
      return;
    }
    
    if (data.artist) {
      console.log('Bio available:', !!data.artist.bio?.content);
      console.log('Bio length:', data.artist.bio?.content?.length || 0);
      console.log('Images available:', data.artist.image?.length || 0);
      
      if (data.artist.image?.length > 0) {
        console.log('Image sizes:');
        data.artist.image.forEach((img: any) => {
          console.log(`  - ${img.size}: ${img['#text'] ? 'URL available' : 'No URL'}`);
        });
      }
      
      console.log('Stats:', {
        listeners: data.artist.stats?.listeners,
        playcount: data.artist.stats?.playcount
      });
    } else {
      console.log('No artist data in response');
    }
  } catch (error) {
    console.error('Last.fm error:', error);
  }
}

async function testSpotify(spotifyId: string) {
  try {
    console.log('Using Spotify ID:', spotifyId);
    console.log('Spotify credentials:', process.env.SPOTIFY_CLIENT_ID ? 'Found' : 'Missing');
    
    // Get access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET!
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.log('Failed to get Spotify token:', tokenData);
      return;
    }
    
    // Get artist data
    const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!artistResponse.ok) {
      console.log('Spotify API error:', artistResponse.status, artistResponse.statusText);
      return;
    }
    
    const artist = await artistResponse.json();
    
    console.log('Images available:', artist.images?.length || 0);
    if (artist.images?.length > 0) {
      console.log('Image sizes:');
      artist.images.forEach((img: any) => {
        console.log(`  - ${img.width}x${img.height}: URL available`);
      });
    }
    
    console.log('Genres:', artist.genres);
    console.log('Popularity:', artist.popularity);
    console.log('Followers:', artist.followers?.total);
    
  } catch (error) {
    console.error('Spotify error:', error);
  }
}

async function testDiscogs(discogsId: string) {
  try {
    console.log('Using Discogs ID:', discogsId);
    console.log('Discogs credentials:', process.env.DISCOGS_CONSUMER_KEY ? 'Found' : 'Missing');
    
    const response = await fetch(`https://api.discogs.com/artists/${discogsId}`, {
      headers: {
        'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
        'User-Agent': 'DaftFmDataPipeline/1.0'
      }
    });
    
    if (!response.ok) {
      console.log('Discogs API error:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error details:', error);
      return;
    }
    
    const data = await response.json();
    
    console.log('Profile (bio):', !!data.profile);
    console.log('Profile length:', data.profile?.length || 0);
    console.log('Images available:', data.images?.length || 0);
    console.log('Real name:', data.realname);
    console.log('Aliases:', data.aliases?.length || 0);
    
  } catch (error) {
    console.error('Discogs error:', error);
  }
}

// Run the exploration
exploreEnrichmentAPIs().catch(console.error);