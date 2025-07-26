import 'dotenv/config';

interface LastFmBioResponse {
  bio: string | null;
  summary: string | null;
  listeners: number | null;
  playcount: number | null;
}

/**
 * Enriches artist with biography from Last.fm
 * @param artistName - Artist name for search
 * @param mbid - MusicBrainz ID (optional but preferred)
 * @returns Biography text or null if not found
 */
export async function enrichArtistBioFromLastFm(
  artistName: string,
  mbid?: string
): Promise<LastFmBioResponse | null> {
  const apiKey = process.env.LAST_FM_API_KEY;
  
  if (!apiKey) {
    console.error('Last.fm API key not found');
    return null;
  }
  
  try {
    const params = new URLSearchParams({
      method: 'artist.getinfo',
      artist: artistName,
      api_key: apiKey,
      format: 'json'
    });
    
    // Add mbid if available for more accurate results
    if (mbid) {
      params.append('mbid', mbid);
    }
    
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    const data = await response.json();
    
    if (data.error || !data.artist) {
      return null;
    }
    
    const artist = data.artist;
    
    return {
      bio: artist.bio?.content || null,
      summary: artist.bio?.summary || null,
      listeners: parseInt(artist.stats?.listeners) || null,
      playcount: parseInt(artist.stats?.playcount) || null
    };
    
  } catch (error) {
    console.error('Last.fm bio fetch error:', error);
    return null;
  }
}