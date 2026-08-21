//* client-side data service fr fetching & processing toilet location data
import { ToiletLocation } from '../shared/types';

/*
& fetch all toilet locations frm API
 */
export async function fetchLocations(): Promise<ToiletLocation[]> {
  try {
    //~ the api now returns fully processed ToiletLocation[] - the heavy geojson dedup/matching work moved server-side into /api/locations
    const response = await fetch('/api/locations');
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    const locations: ToiletLocation[] = await response.json();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Fetched ${locations.length} locations from API`);
    }
    
    return locations;
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
}

/**
 * & filter locations based on region, type & amenities
 */
export function filterLocations(
  locations: ToiletLocation[], 
  filters: {
    region?: string;
    type?: string;
    amenities?: {
      wheelchairAccess?: boolean;
      babyChanging?: boolean;
      unisex?: boolean;
    }
  }
): ToiletLocation[] {
  return locations.filter(location => {
    //~ filter by region
    if (filters.region && location.region !== filters.region) {
      return false;
    }
    
    //~ filter by type
    if (filters.type) {
      //~ match against either the types arr or the single type property - an empty (types arr previously excluded the location frm every type filter)
      const matchesTypesArray = Array.isArray(location.types) && location.types.includes(filters.type);
      const matchesSingleType = location.type === filters.type;
      if (!matchesTypesArray && !matchesSingleType) {
        return false;
      }
    }
    
    //~ filter by amenities if any specified
    if (filters.amenities) {
      if (filters.amenities.wheelchairAccess && !location.amenities?.wheelchairAccess) {
        return false;
      }
      
      if (filters.amenities.babyChanging && !location.amenities?.babyChanging) {
        return false;
      }
      
      if (filters.amenities.unisex && !location.amenities?.unisex) {
        return false;
      }
    }
    
    return true;
  });
}
