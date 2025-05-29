//* types fr toilet locations & data

export interface ToiletLocation {
  id: string;
  name: string;
  address: string;
  region: string;
  type: string;
  lat: number;
  lng: number;
  hasBidet: boolean;
  amenities: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    freeEntry: boolean;
    [key: string]: boolean;
  };
  notes?: string;
  lastUpdated: string;
  
  //~ enriched data fields
  openingHours?: string;
  normalizedHours?: string; //~ formatted opening hrs
  imageUrl?: string; //~ toilet img url
  rating?: number; //~ rating score (0-5)
  source?: string; //~ data src (google-sheets/google-maps)
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; //~ [longitude, latitude]
  };
  properties: Omit<ToiletLocation, 'lat' | 'lng'>;
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}
