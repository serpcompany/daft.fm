import 'dotenv/config';

interface DiscogsImageResponse {
  mainImage: string | null;
  imageCount: number;
}

/**
 * Enriches artist with main image from Discogs
 * @param discogsId - Discogs artist ID (without brackets)
 * @returns Main image URL or null
 */
export async function enrichArtistImageFromDiscogs(
  discogsId: string
): Promise<DiscogsImageResponse | null> {
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  
  if (!key || !secret) {
    console.error('Discogs credentials not found');
    return null;
  }
  
  try {
    const response = await fetch(`https://api.discogs.com/artists/${discogsId}`, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const artist = await response.json();
    
    // Get the first/main image
    const mainImage = artist.images?.[0];
    
    return {
      mainImage: mainImage?.resource_url || null,
      imageCount: artist.images?.length || 0
    };
    
  } catch (error) {
    console.error('Discogs image fetch error:', error);
    return null;
  }
}