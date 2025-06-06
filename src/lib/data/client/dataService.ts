//* client-side data service fr fetching & processing toilet location data
import { ToiletLocation, GeoJSONData, GeoJSONFeature } from '../shared/types';

/**
 * & type definition fr GeoJSON feature properties
 */
type GeoJSONFeatureProperties = {
  id?: string;
  name?: string;
  address?: string;
  region?: string;
  type?: string;
  hasBidet?: boolean;
  amenities?: {
    wheelchairAccess?: boolean;
    babyChanging?: boolean;
    freeEntry?: boolean;
    [key: string]: boolean | string | number | undefined;
  };
  notes?: string;
  lastUpdated?: string;
  openingHours?: string;
  normalizedHours?: Record<string, string> | string;
  imageUrl?: string;
  rating?: number;
  source?: string;
  //~ google maps description
  description?: string;
  //~ google sheets remarks
  sheetsRemarks?: string;
  [key: string]: string | number | boolean | object | undefined; //~ allow fr other properties
};

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
  
  //~ Map: track unique locations by coordinate hash
  const uniqueLocations = new Map();
  
  //~ Sort features - prioritize features w more complete data fr initial population
  const sortedFeatures = [...geoData.features].sort((a, b) => {
    const aProps = a.properties || {};
    const bProps = b.properties || {};
    
    //~ score based on completeness
    const aScore = scoreCompleteness(aProps as GeoJSONFeatureProperties);
    const bScore = scoreCompleteness(bProps as GeoJSONFeatureProperties);
    
    return bScore - aScore; //~ higher score 1st
  });
  
  //~ 1st pass: collect all locations using sorted features
  sortedFeatures.forEach((feature: GeoJSONFeature) => {
    const { properties, geometry } = feature;
    
    //~ skip invalid features
    if (!geometry || !geometry.coordinates || !properties) return;
    
    //~ ensure coordinates in correct format [lng, lat]
    const [lng, lat] = geometry.coordinates;
    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return;
    
    //~ unique key based on coords (round 5 decimal places)
    const locationKey = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
    
    //~ if alr have this location, merge relevant data
    if (uniqueLocations.has(locationKey)) {
      const existing = uniqueLocations.get(locationKey);
      
      //~ prefer locations w names & addresses over unknowns
      if (shouldUpdateValue(existing.name, properties.name)) {
        existing.name = properties.name;
      }
      
      //~ simplify address handling - always use address w/o name fallback
      if (properties.address && properties.address.trim() !== '') {
        existing.address = properties.address.trim();
      }
      
      //~ update other fields conditionally
      if (shouldUpdateValue(existing.region, properties.region)) {
        existing.region = properties.region;
      }
      
      if (shouldUpdateValue(existing.type, properties.type)) {
        existing.type = properties.type;
      }
      
      //~ merge amenities if avail
      if (properties.amenities) {
        existing.amenities = {
          ...existing.amenities,
          ...properties.amenities,
          //~ explicitly prioritize true values fr boolean amenities
          wheelchairAccess: existing.amenities?.wheelchairAccess || properties.amenities.wheelchairAccess,
          babyChanging: existing.amenities?.babyChanging || properties.amenities.babyChanging,
          freeEntry: existing.amenities?.freeEntry || properties.amenities.freeEntry
        };
      }
      
      //~ merge multiple notes if available
      if (properties.notes) {
        if (!existing.notes) {
          existing.notes = properties.notes;
        } else if (!existing.notes.includes(properties.notes)) {
          //~ combine notes if different
          existing.notes = `${existing.notes}; ${properties.notes}`;
        }
      }
      
      //~ combine source info for tracking
      if (properties.source && properties.source !== existing.source) {
        existing.source = existing.source 
          ? `${existing.source},${properties.source}` 
          : properties.source;
      }
      
      //~ keep track of hasBidet=true from any source
      if (properties.hasBidet === true) {
        existing.hasBidet = true;
      }
      
      //~ preserve description & sheetsRemarks data
      if (properties.description && !existing.description) {
        existing.description = properties.description;
      }
      
      if (properties.sheetsRemarks && !existing.sheetsRemarks) {
        existing.sheetsRemarks = properties.sheetsRemarks;
      }
      
      return;
    }
    
    //~ otherwise add as new location
    uniqueLocations.set(locationKey, {
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
      source: properties.source,
      //~ add missing fields fr remarks display
      description: properties.description || '',
      sheetsRemarks: properties.sheetsRemarks || ''
    });
  });
  
  //~ return arr of unique locations
  return Array.from(uniqueLocations.values());
}

/**
 * & helper func: determine if value shld replace existing value
 */
function shouldUpdateValue(existingValue: string | undefined | null, newValue: string | undefined | null): boolean {
  //~ don't update w undefined/null/empty
  if (newValue === undefined || newValue === null || newValue === '') return false;
  
  //~ always update if existing is empty/unknown
  if (!existingValue || 
      existingValue === '' || 
      existingValue === 'Unknown' || 
      existingValue === 'unknown' || 
      existingValue === 'Other' || 
      existingValue === 'other') {
    return true;
  }
  
  //~ if new value has more info (longer), use
  if (typeof existingValue === 'string' && 
      typeof newValue === 'string' && 
      newValue.length > existingValue.length && 
      !newValue.includes('unknown') && 
      !newValue.toLowerCase().includes('null')) {
    return true;
  }
  
  return false;
}

/**
 *& score feature's properties fr completeness: prioritize better data
 */
function scoreCompleteness(props: GeoJSONFeatureProperties): number {
  let score = 0;
  
  //~ award points fr having complete data
  if (props.name && props.name !== 'Unknown Location') score += 3;
  if (props.address && props.address.length > 5) score += 4;
  if (props.region && props.region !== 'Unknown') score += 2;
  if (props.type && props.type !== 'Other') score += 1;
  if (props.notes && props.notes.length > 0) score += 1;
  if (props.amenities && Object.keys(props.amenities).length > 0) score += 2;
  if (props.source === 'google-sheets') score += 2; //~ pref sheets data (usually more complete)
  
  return score;
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
