import { NextResponse } from 'next/server';
import { readCombinedGeoJSON } from '@/lib/data/server/dataFetchers';
import { geoJSONToLocations } from '@/lib/data/server/locationProcessor';

//& serve location data frm generated geojson files
export async function GET() {
  try {
    //~ get geojson data frm server data util
    const geoData = await readCombinedGeoJSON();
    
    //~ process geojson into final ToiletLocation[] here on the server instead of in every visitor's browser - response is cached at the edge fr 1h
    const locations = geoJSONToLocations(geoData);
    
    return NextResponse.json(locations, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error serving location data:', error);
    
    //~ graceful degradation - return empty collection
    return NextResponse.json([]);
  }
}
