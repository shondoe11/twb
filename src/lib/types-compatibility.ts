//* compatibility layer fr easy transition between old & new type sys
//* import types frm here instead of frm 'types.ts' to ensure compatibility

import { 
  ToiletLocation as NewToiletLocation,
  GeoJSONFeature as NewGeoJSONFeature,
  GeoJSONData as NewGeoJSONData,
  GeoJSONProperties,
  GeoJSONGeometry
} from './data/shared/types';

//& re-export types w compatibility
export type ToiletLocation = NewToiletLocation;
export type GeoJSONFeature = NewGeoJSONFeature;
export type GeoJSONData = NewGeoJSONData;
export type { GeoJSONProperties, GeoJSONGeometry };

//& helper funcs to convert between old & new formats if need
interface LegacyToiletLocation {
  id: string;
  name: string;
  address?: string;
  region?: string;
  type?: string;
  lat: number;
  lng: number;
  hasBidet?: boolean;
  amenities?: {
    wheelchairAccess?: boolean;
    babyChanging?: boolean;
    freeEntry?: boolean;
    [key: string]: boolean | undefined;
  };
  notes?: string;
  lastUpdated?: string;
  openingHours?: string;
  normalizedHours?: string;
  imageUrl?: string;
  rating?: number;
  source?: string;
}

export function convertToNewFormat(oldLocation: LegacyToiletLocation): ToiletLocation {
  return {
    id: oldLocation.id,
    name: oldLocation.name,
    address: oldLocation.address || '',
    region: oldLocation.region || 'Unknown',
    type: oldLocation.type || 'Other',
    lat: oldLocation.lat,
    lng: oldLocation.lng,
    hasBidet: oldLocation.hasBidet ?? true,
    lastUpdated: oldLocation.lastUpdated || new Date().toISOString(),
    //~ ensure all req fields exist w proper types
    amenities: {
      wheelchairAccess: oldLocation.amenities?.wheelchairAccess ?? false,
      babyChanging: oldLocation.amenities?.babyChanging ?? false,
      freeEntry: oldLocation.amenities?.freeEntry ?? false
    },
    //~ optional fields
    notes: oldLocation.notes,
    openingHours: oldLocation.openingHours,
    normalizedHours: oldLocation.normalizedHours,
    imageUrl: oldLocation.imageUrl,
    rating: oldLocation.rating,
    source: oldLocation.source
  };
}
