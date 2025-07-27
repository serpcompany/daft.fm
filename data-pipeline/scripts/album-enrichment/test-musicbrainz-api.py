#!/usr/bin/env python3

import musicbrainzngs
import sqlite3
from datetime import datetime

# Set up the user agent (required)
musicbrainzngs.set_useragent("DaftFM-DataPipeline", "1.0", "https://daft.fm")

def get_artist_release_groups(artist_mbid, artist_name):
    """Fetch all release groups (albums) for an artist"""
    print(f"\n{'='*60}")
    print(f"🎤 {artist_name}")
    print(f"{'='*60}")
    
    try:
        # Get release groups, filtering for albums only
        result = musicbrainzngs.browse_release_groups(
            artist=artist_mbid,
            release_type=["album"],
            limit=100
        )
        
        release_groups = result['release-group-list']
        print(f"\nFound {len(release_groups)} release groups (albums)")
        
        # Sort by first release date
        release_groups.sort(key=lambda x: x.get('first-release-date', '9999'))
        
        albums = []
        for rg in release_groups:
            album = {
                'mbid': rg['id'],
                'title': rg['title'],
                'type': rg.get('primary-type', 'Unknown'),
                'first_release_date': rg.get('first-release-date', None),
                'year': rg.get('first-release-date', '')[:4] if rg.get('first-release-date') else None
            }
            albums.append(album)
            
        return albums
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

def compare_with_spotify():
    """Compare MusicBrainz albums with our Spotify data"""
    # Connect to staging database
    conn = sqlite3.connect('staging.db')
    cursor = conn.cursor()
    
    # Get artists with MusicBrainz IDs
    cursor.execute("""
        SELECT DISTINCT a.id, a.name, a.musicbrainz_artist_id 
        FROM artists a
        JOIN albums al ON a.id = al.artist_id
        WHERE a.musicbrainz_artist_id IS NOT NULL
        LIMIT 5
    """)
    
    artists = cursor.fetchall()
    
    comparison_results = []
    
    for artist_id, artist_name, mbid in artists:
        print(f"\n\n{'*'*80}")
        print(f"Comparing albums for: {artist_name}")
        print(f"{'*'*80}")
        
        # Get albums from MusicBrainz
        mb_albums = get_artist_release_groups(mbid, artist_name)
        
        # Get albums from our Spotify data
        cursor.execute("""
            SELECT title, release_date, spotify_album_id 
            FROM albums 
            WHERE artist_id = ?
            ORDER BY release_date
        """, (artist_id,))
        
        spotify_albums = cursor.fetchall()
        
        print(f"\n📊 Comparison:")
        print(f"MusicBrainz albums: {len(mb_albums)}")
        print(f"Spotify albums in DB: {len(spotify_albums)}")
        
        # Show side by side
        print(f"\n{'MusicBrainz':<40} | {'Spotify (in our DB)':<40}")
        print(f"{'-'*40} | {'-'*40}")
        
        # Create sets for comparison
        mb_titles = {album['title'].lower() for album in mb_albums}
        spotify_titles = {album[0].lower() for album in spotify_albums}
        
        # Show first 10 from each
        for i in range(max(len(mb_albums[:10]), len(spotify_albums[:10]))):
            mb_text = ""
            spotify_text = ""
            
            if i < len(mb_albums):
                mb_album = mb_albums[i]
                mb_text = f"{mb_album['year'] or '????'} - {mb_album['title'][:30]}"
            
            if i < len(spotify_albums):
                sp_album = spotify_albums[i]
                sp_text = f"{sp_album[1] or '????'} - {sp_album[0][:30]}"
            
            print(f"{mb_text:<40} | {spotify_text:<40}")
        
        # Analysis
        print(f"\n📈 Analysis:")
        only_mb = mb_titles - spotify_titles
        only_spotify = spotify_titles - mb_titles
        
        if only_mb:
            print(f"\nOnly in MusicBrainz ({len(only_mb)}):")
            for title in list(only_mb)[:5]:
                print(f"  - {title}")
            if len(only_mb) > 5:
                print(f"  ... and {len(only_mb) - 5} more")
        
        if only_spotify:
            print(f"\nOnly in Spotify ({len(only_spotify)}):")
            for title in list(only_spotify)[:5]:
                print(f"  - {title}")
            if len(only_spotify) > 5:
                print(f"  ... and {len(only_spotify) - 5} more")
        
        comparison_results.append({
            'artist': artist_name,
            'mb_count': len(mb_albums),
            'spotify_count': len(spotify_albums),
            'only_mb': len(only_mb),
            'only_spotify': len(only_spotify)
        })
    
    # Summary
    print(f"\n\n{'='*80}")
    print("📊 OVERALL SUMMARY")
    print(f"{'='*80}")
    
    for result in comparison_results:
        print(f"\n{result['artist']}:")
        print(f"  MusicBrainz: {result['mb_count']} albums")
        print(f"  Spotify: {result['spotify_count']} albums")
        print(f"  Only in MB: {result['only_mb']}")
        print(f"  Only in Spotify: {result['only_spotify']}")
    
    conn.close()

def test_single_artist():
    """Test with a single well-known artist"""
    # The Beatles
    artist_mbid = "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d"
    albums = get_artist_release_groups(artist_mbid, "The Beatles")
    
    print("\n📀 Albums found:")
    for album in albums:
        print(f"  {album['year'] or '????'} - {album['title']}")

if __name__ == "__main__":
    print("🎯 Testing MusicBrainz API with musicbrainzngs\n")
    
    # First test with single artist
    # test_single_artist()
    
    # Then compare with our Spotify data
    compare_with_spotify()