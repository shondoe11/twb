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
