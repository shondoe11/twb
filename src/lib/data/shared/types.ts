//* shared type definitions fr data across client & server
export interface ToiletLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  region?: string;
  type?: string;
  hasBidet: boolean;
  //& gender property fr male/female/any toilets w bidets
  gender?: 'male' | 'female' | 'any';
  amenities: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    freeEntry: boolean;
    handDryer?: boolean;
    soapDispenser?: boolean;
    paperTowels?: boolean;
    toiletPaper?: boolean;
  };
  notes?: string;
  lastUpdated: string;
  
  //& google maps description - string / object w/ @type & value
  description?: string | {
    '@type': string;
    value: string;
  };
  //& google sheets remarks
  sheetsRemarks?: string;
  
  //& enriched data fields
  openingHours?: string;
  normalizedHours?: string; //~ formatted opening hrs
  imageUrl?: string; //~ toilet img url
  rating?: number; //~ rating score (0-5)
  source?: string; //~ data src (google-sheets/google-maps)
  cleanliness?: number; //~ cleanliness rating (1-5)
  accessibility?: {
    hasRamp?: boolean;
    doorWidth?: number; //~ in cm
    grabBars?: boolean;
    emergencyButton?: boolean;
  };
  floor?: string; //~ location floor information
  nearbyLandmarks?: string[]; //~ notable locations nearby
  lastCleaned?: string; //~ timestamp of last cleaning
  maintenanceContact?: string; //~ contact for reporting issues
  waterTemperature?: 'cold' | 'warm' | 'adjustable'; //~ for bidets
  visitCount?: number; //~ popularity metric
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
  amenities?: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    freeEntry: boolean;
  };
  notes?: string;
  lastUpdated?: string;
  openingHours?: string;
  normalizedHours?: string;
  imageUrl?: string;
  rating?: number;
  source?: string;
  //~ google maps description - string / object w/ @type & value
  description?: string | {
    '@type': string;
    value: string;
  };
  //~ google sheets remarks
  sheetsRemarks?: string;
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

//& data srcs configs
export const DATA_SOURCES = {
  GOOGLE_SHEETS_ID: '1jAMaD3afMfA19U2u1aRLkL0M-ufFvz1fKDpT_BraOfY',
  GOOGLE_MAPS_ID: '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0',
  get SHEETS_CSV_URL() {
    return `https://docs.google.com/spreadsheets/d/${this.GOOGLE_SHEETS_ID}/export?format=csv`;
  },
  get MAPS_KML_URL() {
    return `https://www.google.com/maps/d/kml?forcekml=1&mid=${this.GOOGLE_MAPS_ID}`;
  }
};

//& constants fr data paths
export const DATA_PATHS = {
  DATA_DIR: '/data',
  CACHE_DIR: '/data/cache',
  SHEETS_OUTPUT: '/data/toilets.json',
  MAPS_OUTPUT: '/data/toilets.geojson',
  COMBINED_OUTPUT: '/data/combined.geojson'
};

//& sg regions data
export const SINGAPORE_REGIONS = [
  'Central',
  'North',
  'North-East',
  'East',
  'West'
];
