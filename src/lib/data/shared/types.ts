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
  
  //~ source-specific comments fr display on map
  sourceComments?: {
    maps?: string[];
    sheets?: string[];
  };
  
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
  floor?: string; //~ location floor info
  nearbyLandmarks?: string[]; //~ notable locations nearby
  lastCleaned?: string; //~ last cleaning timestamp
  maintenanceContact?: string; //~ contact fr reporting issues
  waterTemperature?: 'cold' | 'warm' | 'adjustable'; //~ for bidets
  visitCount?: number; //~ popularity metric
  dataCompleteness?: number; //~ score 0-1 showing how complete data is
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
  sourceTab?: string; //~ tab source fr multi-tab data
  //~ google maps description - string / object w/ @type & value
  description?: string | {
    '@type': string;
    value: string;
  };
  //~ google sheets remarks
  sheetsRemarks?: string;
  
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

//& data srcs configs
export const DATA_SOURCES = {
  //~ primary Google Sheets ID
  GOOGLE_SHEETS_ID: '1jAMaD3afMfA19U2u1aRLkL0M-ufFvz1fKDpT_BraOfY',
  
  //~ sheet tabs (gids)
  SHEET_TABS: [
    { name: 'MALE TOILETS', gid: '0' },
    { name: 'FEMALE TOILETS', gid: '1908890944' },
    { name: 'HOTEL ROOMS W BIDET', gid: '1650628758' }
  ],
  
  //~ Google Maps data src
  GOOGLE_MAPS_ID: '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0',
  
  //~ get CSV URL fr main sheet (backwards compatibility)
  get SHEETS_CSV_URL() {
    return `https://docs.google.com/spreadsheets/d/${this.GOOGLE_SHEETS_ID}/export?format=csv`;
  },
  
  //~ get URLs fr all sheet tabs
  get ALL_SHEETS_CSV_URLS() {
    return this.SHEET_TABS.map(tab => 
      `https://docs.google.com/spreadsheets/d/${this.GOOGLE_SHEETS_ID}/export?format=csv&gid=${tab.gid}`
    );
  },
  
  //~ get Google Maps KML URL
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
