import { ToiletLocation, GeoJSONData } from './types';
import fetchSheetsData from './sheetsFetcher';
import fetchMapsData from './mapsFetcher';

//* utility funcs: combine & process data frm different sources
export async function fetchAllData(): Promise<{
  locations: ToiletLocation[];
  geoJSON: GeoJSONData;
}> {
  try {
    //~ fetch data frm both sources in parallel
    const [locations, geoJSON] = await Promise.all([
      fetchSheetsData(),
      fetchMapsData(),
    ]);

    //~ in real implementation, might merge / reconcile data frm both sources based on some identifier; etc location name / coordinates

    return {
      locations,
      geoJSON,
    };
  } catch (error) {
    console.error('Error fetching combined data:', error);
    return {
      locations: [],
      geoJSON: { type: 'FeatureCollection', features: [] },
    };
  }
}

//& filter locations based on search criteria
export function filterLocations(
  locations: ToiletLocation[],
  filters: {
    searchText?: string;
    region?: string;
    type?: string;
    amenities?: string[];
  }
): ToiletLocation[] {
  return locations.filter((location) => {
    //~ text search
    if (
      filters.searchText &&
      !location.name.toLowerCase().includes(filters.searchText.toLowerCase()) &&
      !location.address.toLowerCase().includes(filters.searchText.toLowerCase())
    ) {
      return false;
    }

    //~ region filter
    if (filters.region && location.region !== filters.region) {
      return false;
    }

    //~ type filter
    if (filters.type && location.type !== filters.type) {
      return false;
    }

    //~ amenities filter
    if (filters.amenities && filters.amenities.length > 0) {
      for (const amenity of filters.amenities) {
        if (!location.amenities[amenity]) {
          return false;
        }
      }
    }

    return true;
  });
}

//& sort locations by distance frm a given point
export function sortLocationsByDistance(
  locations: ToiletLocation[],
  lat: number,
  lng: number
): ToiletLocation[] {
  return [...locations].sort((a, b) => {
    const distA = calculateDistance(lat, lng, a.lat, a.lng);
    const distB = calculateDistance(lat, lng, b.lat, b.lng);
    return distA - distB;
  });
}

//& calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  //~ haversine formula: calculate great-circle distance between two points: https://www.geeksforgeeks.org/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
  const R = 6371; //~ earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
