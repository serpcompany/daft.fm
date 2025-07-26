#!/usr/bin/env tsx

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'daft.fm/1.0.0 (https://daft.fm)';
const RATE_LIMIT_MS = 1000;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function getArtistWithRelations(mbid: string): Promise<any> {
  try {
    // Include artist-rels to get member relationships
    const url = `${MUSICBRAINZ_BASE_URL}/artist/${mbid}?fmt=json&inc=url-rels+artist-rels+tags+aliases+ratings+genres`;
    console.log(`  → Fetching: ${url}`);
    return await rateLimitedFetch(url);
  } catch (error) {
    console.error(`Error fetching artist ${mbid}:`, error);
    return null;
  }
}

function extractExternalIds(relations: any[]): Record<string, string> {
  const externalIds: Record<string, string> = {};
  
  if (!relations) return externalIds;
  
  for (const relation of relations) {
    // Check for specific relation types first
    if (relation.type === 'wikidata' && relation.url?.resource) {
      externalIds.wikidataEntityId = relation.url.resource.split('wikidata.org/wiki/')[1];
    } else if (relation.url?.resource) {
      const url = relation.url.resource;
      
      if (url.includes('spotify.com/artist/')) {
        externalIds.spotifyArtistId = url.split('spotify.com/artist/')[1].split('?')[0];
      } else if (url.includes('discogs.com/artist/')) {
        const artistId = url.split('discogs.com/artist/')[1].split('-')[0];
        externalIds.discogsArtistId = `[a${artistId}]`;  // Format as [a82730]
      } else if (url.includes('genius.com/artists/')) {
        externalIds.geniusArtistId = url.split('genius.com/artists/')[1];
      } else if (url.includes('last.fm/music/')) {
        externalIds.lastfmUrl = url;
      } else if (url.includes('youtube.com/channel/')) {
        externalIds.youtubeChannelId = url.split('youtube.com/channel/')[1];
      } else if (url.includes('twitter.com/')) {
        externalIds.twitter = url.split('twitter.com/')[1];
      } else if (url.includes('facebook.com/')) {
        externalIds.facebook = url.split('facebook.com/')[1];
      } else if (url.includes('instagram.com/')) {
        externalIds.instagram = url.split('instagram.com/')[1].replace('/', '');
      }
    }
  }
  
  return externalIds;
}

function extractMembers(relations: any[]): any[] {
  const members = [];
  
  if (!relations) return members;
  
  for (const relation of relations) {
    if (relation.type === 'member of band' && relation.direction === 'backward') {
      const member = {
        name: relation.artist?.name,
        mbid: relation.artist?.id,
        instruments: relation.attributes?.join(', ') || null,
        beginDate: relation.begin || null,
        endDate: relation.end || null,
        ended: relation.ended || false
      };
      members.push(member);
    }
  }
  
  return members;
}

/**
 * Fetches artists from MusicBrainz sorted by popularity
 * 
 * Returns artist objects with:
 * - Basic info: name, country, formedYear, genres
 * - Members: array of band members with instruments and dates
 * - External IDs: Spotify, Discogs, Wikidata, Last.fm, Genius, social media
 * - Metadata: popularity score, relationship counts
 * 
 * Does NOT return (needs other APIs):
 * - Artist biography
 * - Artist images
 * - Some streaming IDs (Apple Music, Tidal, Deezer)
 */
export async function fetchArtistsByPopularity(limit: number = 3): Promise<any[]> {
  console.log(`📊 Fetching ${limit} popular artists from MusicBrainz...\n`);
  
  const allArtists: Map<string, any> = new Map();
  
  const searchQueries = [
    'tag:rock AND tag:pop',
    'tag:electronic',
    'tag:hip-hop',
    'recording_count:[100 TO *]',
    'release_count:[10 TO *]',
  ];
  
  for (const query of searchQueries) {
    if (allArtists.size >= limit * 5) break;
    
    try {
      const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
      const data = await rateLimitedFetch(url);
      
      if (data.artists) {
        for (const artist of data.artists) {
          if (!allArtists.has(artist.id) && allArtists.size < limit * 5) {
            const fullArtist = await getArtistWithRelations(artist.id);
            if (fullArtist) {
              allArtists.set(artist.id, fullArtist);
              console.log(`  Found: ${fullArtist.name} (${fullArtist.relations?.length || 0} relationships)`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error with query "${query}":`, error);
    }
  }
  
  const sortedArtists = Array.from(allArtists.values())
    .filter(artist => {
      const name = artist.name.toLowerCase();
      return !name.includes('various artists') && 
             !name.includes('[unknown]') &&
             artist.relations && artist.relations.length > 0;
    })
    .sort((a, b) => {
      const aScore = (a.relations?.length || 0) + (a.tags?.length || 0) * 2;
      const bScore = (b.relations?.length || 0) + (b.tags?.length || 0) * 2;
      return bScore - aScore;
    })
    .slice(0, limit);
  
  console.log(`\n✅ Selected top ${sortedArtists.length} artists by popularity score\n`);
  
  return sortedArtists.map(artist => {
    const externalIds = extractExternalIds(artist.relations);
    const members = extractMembers(artist.relations);
    const formedYear = artist['life-span']?.begin 
      ? parseInt(artist['life-span'].begin.split('-')[0]) 
      : null;
    
    return {
      name: artist.name,
      country: artist.country || null,
      formedYear,
      genres: artist.tags?.map((tag: any) => tag.name) || [],
      members,
      musicbrainzArtistId: artist.id,
      wikidataEntityId: externalIds.wikidataEntityId || null,
      discogsArtistId: externalIds.discogsArtistId || null,
      spotifyArtistId: externalIds.spotifyArtistId || null,
      lastfmUrl: externalIds.lastfmUrl || null,
      isni: artist.isnis?.[0] || null,
      externalIds,
      popularityScore: (artist.relations?.length || 0) + (artist.tags?.length || 0) * 2,
      relationshipsCount: artist.relations?.length || 0,
      tagsCount: artist.tags?.length || 0
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artistCount = parseInt(process.argv[2]) || 3;
  
  fetchArtistsByPopularity(artistCount)
    .then(artists => {
      console.log('\n=== DETAILED ARTIST REPORT ===\n');
      artists.forEach((artist, index) => {
        console.log(`${index + 1}. ${artist.name}`);
        console.log(`   MusicBrainz ID: ${artist.musicbrainzArtistId}`);
        console.log(`   Country: ${artist.country || 'Unknown'}`);
        console.log(`   Formed: ${artist.formedYear || 'Unknown'}`);
        console.log(`   Genres: ${artist.genres.slice(0, 5).join(', ')}${artist.genres.length > 5 ? '...' : ''}`);
        console.log(`   Popularity Score: ${artist.popularityScore} (${artist.relationshipsCount} relationships + ${artist.tagsCount} tags × 2)`);
        console.log(`   External IDs Found:`);
        Object.entries(artist.externalIds).forEach(([key, value]) => {
          console.log(`     - ${key}: ${value}`);
        });
        console.log(`   ISNI: ${artist.isni || 'Not found'}`);
        if (artist.members && artist.members.length > 0) {
          console.log(`   Members:`);
          artist.members.forEach(member => {
            const period = member.beginDate ? ` (${member.beginDate}${member.endDate ? ' - ' + member.endDate : ''})` : '';
            console.log(`     - ${member.name}${member.instruments ? ': ' + member.instruments : ''}${period}`);
          });
        }
        console.log('');
      });
    })
    .catch(console.error);
}