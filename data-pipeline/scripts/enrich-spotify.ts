import 'dotenv/config';

interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyImagesResponse {
  profile: string | null;
  banner: string | null;
  allImages: SpotifyImage[];
}

interface SpotifyGenresResponse {
  genres: string[];
  popularity: number | null;
}

// Cache token to avoid unnecessary requests
let cachedToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  // Check cache
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }
  
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('Spotify credentials not found');
    return null;
  }
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      // Cache for slightly less than the expires_in time
      cachedToken = {
        token: data.access_token,
        expires: Date.now() + (data.expires_in - 60) * 1000
      };
      return data.access_token;
    }
    
    return null;
  } catch (error) {
    console.error('Spotify token error:', error);
    return null;
  }
}

/**
 * Enriches artist with images from Spotify
 * @param spotifyId - Spotify artist ID
 * @returns Image URLs (profile, banner) or null
 */
export async function enrichArtistImagesFromSpotify(
  spotifyId: string
): Promise<SpotifyImagesResponse | null> {
  const token = await getSpotifyToken();
  
  if (!token) {
    return null;
  }
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const artist = await response.json();
    
    if (!artist.images || artist.images.length === 0) {
      return null;
    }
    
    // Sort by size (largest first)
    const sortedImages = artist.images.sort((a: SpotifyImage, b: SpotifyImage) => 
      (b.width * b.height) - (a.width * a.height)
    );
    
    return {
      profile: sortedImages[0]?.url || null,  // Largest image
      banner: sortedImages[1]?.url || null,   // Second largest (if available)
      allImages: sortedImages
    };
    
  } catch (error) {
    console.error('Spotify images fetch error:', error);
    return null;
  }
}

/**
 * Enriches artist with genres from Spotify
 * @param spotifyId - Spotify artist ID
 * @returns Genres array or null
 */
export async function enrichArtistGenresFromSpotify(
  spotifyId: string
): Promise<SpotifyGenresResponse | null> {
  const token = await getSpotifyToken();
  
  if (!token) {
    return null;
  }
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const artist = await response.json();
    
    return {
      genres: artist.genres || [],
      popularity: artist.popularity || null
    };
    
  } catch (error) {
    console.error('Spotify genres fetch error:', error);
    return null;
  }
}