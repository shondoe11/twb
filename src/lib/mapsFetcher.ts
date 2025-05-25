import { GeoJSONData } from './types';

//* util funcs to fetch & parse data frm Google My Maps KML
const GOOGLE_MAPS_ID = '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0';
const MAPS_KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${GOOGLE_MAPS_ID}`;

//& fetch KML data frm Google My Maps & convert to GeoJSON
export async function fetchMapsData(): Promise<GeoJSONData> {
  try {
    const response = await fetch(MAPS_KML_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch KML data: ${response.status}`);
    }
    
    const kmlText = await response.text();
    
    //~ placeholder. in real implementation, use @tmcw/togeojson to convert KML to GeoJSON
    console.log('KML data fetched, length:', kmlText.length);
    
    //~ return empty GeoJSON structure until parser implemented
    return {
      type: 'FeatureCollection',
      features: []
    };
  } catch (error) {
    console.error('Error fetching Google My Maps data:', error);
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
}

//& func will use @tmcw/togeojson: convert KML to GeoJSON
//& placeholder until install req dep
function convertKMLtoGeoJSON(kml: string): GeoJSONData {
  //~ to implement using @tmcw/togeojson
  return {
    type: 'FeatureCollection',
    features: []
  };
}

export default fetchMapsData;
