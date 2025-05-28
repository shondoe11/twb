//* client-side data service fr fetching & processing toilet location data
import { ToiletLocation, GeoJSONData, GeoJSONFeature } from '../shared/types';

/*
& fetch all toilet locations frm API
 */
export async function fetchLocations(): Promise<ToiletLocation[]> {
  try {
    //~ fetch combined geojson data frm api endpoint
    const response = await fetch('/api/locations');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const geoData = await response.json();
    
    //~ convert geojson features to toilet location objects
    return geoJSONToLocations(geoData);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
}

/*
& convert GeoJSON data to ToiletLocation objs
 */
export function geoJSONToLocations(geoData: GeoJSONData): ToiletLocation[] {
  if (!geoData.features || !Array.isArray(geoData.features)) {
    return [];
  }
  
  return geoData.features.map((feature: GeoJSONFeature) => {
    const { properties, geometry } = feature;
    
    //~ ensure coordinates are in correct format [lng, lat]
    const [lng, lat] = geometry.coordinates;
    
    return {
      id: properties.id || `loc-${Math.random().toString(36).substring(2, 9)}`,
      name: properties.name || 'Unknown Location',
      address: properties.address || '',
      region: properties.region || 'Unknown',
      type: properties.type || 'Other',
      lat: Number(lat),
      lng: Number(lng),
      hasBidet: properties.hasBidet ?? true,
      amenities: properties.amenities || {
        wheelchairAccess: false,
        babyChanging: false,
        freeEntry: false
      },
      notes: properties.notes || '',
      lastUpdated: properties.lastUpdated || new Date().toISOString(),
      openingHours: properties.openingHours,
      normalizedHours: properties.normalizedHours,
      imageUrl: properties.imageUrl,
      rating: properties.rating,
      source: properties.source
    };
  });
}

/*
& filter locations based on filter criteria
*/
export function filterLocations(
  locations: ToiletLocation[],
  filters: {
    region?: string;
    type?: string;
    amenities?: {
      wheelchairAccess?: boolean;
      babyChanging?: boolean;
      freeEntry?: boolean;
      hasBidet?: boolean;
    };
    searchTerm?: string;
  }
): ToiletLocation[] {
  return locations.filter(location => {
    //~ filter by region if specified
    if (filters.region && location.region !== filters.region) {
      return false;
    }
    
    //~ filter by type if specified
    if (filters.type && location.type !== filters.type) {
      return false;
    }
    
    //~ filter by amenities
    if (filters.amenities) {
      if (filters.amenities.wheelchairAccess && !location.amenities.wheelchairAccess) {
        return false;
      }
      
      if (filters.amenities.babyChanging && !location.amenities.babyChanging) {
        return false;
      }
      
      if (filters.amenities.freeEntry && !location.amenities.freeEntry) {
        return false;
      }
      
      if (filters.amenities.hasBidet && !location.hasBidet) {
        return false;
      }
    }
    
    //~ filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchesName = location.name.toLowerCase().includes(term);
      const matchesAddress = location.address?.toLowerCase().includes(term) || false;
      const matchesRegion = location.region?.toLowerCase().includes(term) || false;
      
      return matchesName || matchesAddress || matchesRegion;
    }
    
    return true;
  });
}

/*
& sort locations by distance frm given point
*/
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

/*
& calculate distance between two points using Haversine formula
*/
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; //~ earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; //~ distance in km
  return d;
}

//& helper func: convert degrees to radians
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
