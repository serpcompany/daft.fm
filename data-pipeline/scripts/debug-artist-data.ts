#!/usr/bin/env tsx

// Quick script to see raw MusicBrainz data for The Beatles
async function debugArtistData() {
  const mbid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'; // The Beatles
  // Try with ALL possible includes to see what we get
  const includes = [
    'url-rels',
    'artist-rels',
    'area-rels',
    'recording-rels',
    'release-rels',
    'release-group-rels',
    'work-rels',
    'tags',
    'aliases',
    'ratings',
    'genres',
    'annotation'
  ].join('+');
  
  const url = `https://musicbrainz.org/ws/2/artist/${mbid}?fmt=json&inc=${includes}`;
  
  console.log('Fetching:', url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
    }
  });
  const data = await response.json();
  
  console.log('\n=== ALL RELATIONS ===');
  data.relations?.forEach((rel: any, i: number) => {
    console.log(`\n[${i}] Type: ${rel.type}`);
    console.log('    Direction:', rel.direction);
    console.log('    Target:', rel.artist?.name || rel.url?.resource || 'N/A');
    if (rel.url?.resource) {
      console.log('    URL:', rel.url.resource);
    }
  });
  
  console.log('\n=== RAW JSON ===');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== LOOKING FOR WIKIDATA ===');
  const wikidataRel = data.relations?.find((rel: any) => 
    rel.url?.resource?.includes('wikidata') || 
    rel.type?.includes('wikidata') ||
    rel.type === 'wikidata'
  );
  console.log('Found:', wikidataRel);
}

debugArtistData().catch(console.error);