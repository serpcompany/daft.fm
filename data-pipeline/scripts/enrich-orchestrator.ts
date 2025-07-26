import { enrichArtistBioFromLastFm } from './enrich-lastfm';
import { enrichArtistImagesFromSpotify, enrichArtistGenresFromSpotify } from './enrich-spotify';
import { enrichArtistImageFromDiscogs } from './enrich-discogs';

// Rate limiting helpers
const rateLimiters = {
  lastfm: { lastCall: 0, minInterval: 200 },     // 5 req/sec = 200ms between
  spotify: { lastCall: 0, minInterval: 333 },    // 180 req/min = 333ms between
  discogs: { lastCall: 0, minInterval: 1000 }    // 60 req/min = 1000ms between
};

async function respectRateLimit(service: keyof typeof rateLimiters) {
  const limiter = rateLimiters[service];
  const now = Date.now();
  const timeSinceLastCall = now - limiter.lastCall;
  
  if (timeSinceLastCall < limiter.minInterval) {
    const waitTime = limiter.minInterval - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  limiter.lastCall = Date.now();
}

export interface EnrichmentResult {
  bio: string | null;
  bioSummary: string | null;
  images: {
    profile: string | null;
    banner: string | null;
    main: string | null;
  };
  genres: string[];
  popularity: number | null;
  stats: {
    listeners: number | null;
    playcount: number | null;
  };
  dataSourcesUsed: string[];
}

export interface ArtistToEnrich {
  name: string;
  musicbrainzId: string;
  spotifyArtistId?: string | null;
  discogsArtistId?: string | null;
  genres?: string[];  // Existing genres from MusicBrainz
}

/**
 * Orchestrates enrichment from multiple sources
 * @param artist - Artist object with identifiers
 * @returns Enriched data from available sources
 */
export async function enrichArtist(artist: ArtistToEnrich): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    bio: null,
    bioSummary: null,
    images: {
      profile: null,
      banner: null,
      main: null
    },
    genres: [...(artist.genres || [])],  // Start with existing genres
    popularity: null,
    stats: {
      listeners: null,
      playcount: null
    },
    dataSourcesUsed: []
  };
  
  // Fetch bio from Last.fm
  await respectRateLimit('lastfm');
  const lastfmData = await enrichArtistBioFromLastFm(artist.name, artist.musicbrainzId);
  
  if (lastfmData) {
    result.bio = lastfmData.bio;
    result.bioSummary = lastfmData.summary;
    result.stats.listeners = lastfmData.listeners;
    result.stats.playcount = lastfmData.playcount;
    result.dataSourcesUsed.push('lastfm');
  }
  
  // Fetch from Spotify if we have the ID
  if (artist.spotifyArtistId) {
    // Get images
    await respectRateLimit('spotify');
    const spotifyImages = await enrichArtistImagesFromSpotify(artist.spotifyArtistId);
    
    if (spotifyImages) {
      result.images.profile = spotifyImages.profile;
      result.images.banner = spotifyImages.banner;
      if (!result.dataSourcesUsed.includes('spotify')) {
        result.dataSourcesUsed.push('spotify');
      }
    }
    
    // Get genres (separate call, same rate limit)
    await respectRateLimit('spotify');
    const spotifyGenres = await enrichArtistGenresFromSpotify(artist.spotifyArtistId);
    
    if (spotifyGenres) {
      // Merge genres, avoiding duplicates
      const newGenres = spotifyGenres.genres.filter(g => !result.genres.includes(g));
      result.genres.push(...newGenres);
      result.popularity = spotifyGenres.popularity;
      if (!result.dataSourcesUsed.includes('spotify')) {
        result.dataSourcesUsed.push('spotify');
      }
    }
  }
  
  // Fetch from Discogs if we have the ID
  if (artist.discogsArtistId) {
    // Extract numeric ID from format like "[a82730]"
    const discogsId = artist.discogsArtistId.replace(/[\[\]a]/g, '');
    
    await respectRateLimit('discogs');
    const discogsImage = await enrichArtistImageFromDiscogs(discogsId);
    
    if (discogsImage && discogsImage.mainImage) {
      result.images.main = discogsImage.mainImage;
      result.dataSourcesUsed.push('discogs');
    }
  }
  
  return result;
}