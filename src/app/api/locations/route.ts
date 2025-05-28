import { NextResponse } from 'next/server';
import { readCombinedGeoJSON } from '@/lib/data/server/dataFetchers';

//& serve location data frm generated geojson files
export async function GET() {
  try {
    //~ get geojson data frm server data util
    const geoData = await readCombinedGeoJSON();
    
    //~ return geojson data
    return NextResponse.json(geoData);
  } catch (error) {
    console.error('Error serving location data:', error);
    
    //~ graceful degradation - return empty collection
    return NextResponse.json({
      type: 'FeatureCollection',
      features: []
    });
  }
}
