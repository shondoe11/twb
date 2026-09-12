//* shared type definitions fr data across client & server
export interface ToiletLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  region?: string;
  type?: string;
  types?: string[];
  hasBidet: boolean;
  //& gender property fr male/female/any toilets w bidets
  gender?: 'male' | 'female' | 'any';
  amenities: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    unisex: boolean;
    bidetInAllCubicles: boolean;
  };
  notes?: string;
  lastUpdated: string;
  
  //& google maps description - kml placemark description text
  description?: string;
  //& popup-ready google maps description: <br> split to lines, template noise dropped, empty whn it just duplicates sheetsRemarks
  mapsRemarks?: string;
  //& google sheets remarks
  sheetsRemarks?: string;
  
  source?: string; //~ data src (google-sheets/google-maps)
}

//& geojson related types
export interface GeoJSONGeometry {
  type: string;
  coordinates: number[];
}

export interface GeoJSONProperties {
  id: string;
  name: string;
  address?: string;
  region?: string;
  type?: string;
  hasBidet?: boolean;
  notes?: string;
  lastUpdated?: string;
  source?: string;
  sourceTab?: string; //~ tab source fr multi-tab data
  //~ google maps description - kml placemark description text
  description?: string;
  //~ google sheets remarks column
  remarks?: string;
  
  //~ allow extra properties
  [key: string]: unknown;
}

export interface GeoJSONFeature {
  type: string;
  geometry: GeoJSONGeometry;
  properties: GeoJSONProperties;
}

export interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

//& constants fr data paths
//^ source ids/urls live only in scripts/fetch-data.mjs now
export const DATA_PATHS = {
  DATA_DIR: '/data',
  COMBINED_OUTPUT: '/data/combined.geojson'
};
