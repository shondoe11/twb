//* client-side data service fr fetching & processing toilet location data
import { ToiletLocation, GeoJSONData } from '../shared/types';

/*
& fetch all toilet locations frm API
 */
export async function fetchLocations(): Promise<ToiletLocation[]> {
  try {
    console.log('🔍 STEP 1: Fetching raw data from API...');
    const response = await fetch('/api/locations');
    const data: GeoJSONData = await response.json();
    
    console.log('🔍 STEP 2: Analyzing raw API data...');
    //~ count feats w addresses
    const featuresWithAddress = data.features.filter(f => 
      f.properties?.address && f.properties.address.trim() !== '');
    console.log(`📊 STATS: Raw data has ${featuresWithAddress.length} out of ${data.features.length} features with addresses`);
    
    //? show all feats w addresses fr debugging
    console.log('📋 FULL ADDRESS LIST FROM API:');
    featuresWithAddress.forEach(f => {
      console.log(`📍 "${f.properties?.name}" → "${f.properties?.address}"`);
    });
    
    console.log('🔍 STEP 3: Processing data into locations...');
    const locations = geoJSONToLocations(data);
    
    console.log('🔍 STEP 4: Analyzing processed locations...');
    //~ count locations w addresses aft processing
    const locationsWithAddress = locations.filter(loc => loc.address && loc.address.trim() !== '');
    console.log(`📊 STATS: Processed data has ${locationsWithAddress.length} out of ${locations.length} locations with addresses`);
    
    //? display 1st 10 locations w addresses
    console.log('📋 SAMPLE OF PROCESSED LOCATIONS WITH ADDRESSES:');
    locationsWithAddress.slice(0, 10).forEach(loc => {
      console.log(`📍 "${loc.name}" → "${loc.address}"`);
    });
    
    //? display 1st 10 locations missing addresses
    console.log('📋 SAMPLE OF PROCESSED LOCATIONS MISSING ADDRESSES:');
    const missingAddresses = locations.filter(loc => !loc.address || loc.address.trim() === '');
    missingAddresses.slice(0, 10).forEach(loc => {
      console.log(`❌ "${loc.name}" has no address`);
    });
    
    return locations;
  } catch (error) {
    console.error('❌ Error fetching locations:', error);
    return [];
  }
}

/**
 * & Interface fr extracted features w consistent props
 */
interface LocationFeature {
  name: string;
  address?: string;
  coords: [number, number]; //~ [lng, lat]
  properties: Record<string, unknown>;
}

/**
 * & normalize location names fr better matching
 */
function normalizeLocationName(name: string): string {
  let normalized = name.toLowerCase();
  
  //~ rm any content in parentheses, brackets
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, '');
  normalized = normalized.replace(/\s*\[[^\]]*\]\s*/g, '');
  
  //~ rm common prefixes/suffixes & venue types
  normalized = normalized.replace(/^(the|at|in|by)\s+/i, '');
  normalized = normalized.replace(/\s+(centre|center|mall|plaza|station|park|hub|mrt|cc)$/i, '');
  
  //~ rm punctuation & special characters
  normalized = normalized.replace(/[&@\'",\.\?!:\-–—]/g, ' ');
  
  //~ standardize whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  //~ handle common abbreviations
  normalized = normalized.replace(/\bst\b/g, 'street');
  normalized = normalized.replace(/\bave\b/g, 'avenue');
  normalized = normalized.replace(/\bblvd\b/g, 'boulevard');
  normalized = normalized.replace(/\botb\b/g, 'our tampines hub');
  normalized = normalized.replace(/\both\b/g, 'our tampines hub');
  
  //~ rm common location type words
  normalized = normalized.replace(/\b(coffee|food|food court|hawker|market|shopping|community|club|sports)\b/g, '');
  
  //~ clean up any double spaces frm removals
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

/**
 * & calculate data completeness score
 */
function getDataCompleteness(loc: ToiletLocation): number {
  const fields = [
    !!loc.address, 
    !!loc.region, 
    !!loc.rating,
    !!loc.imageUrl,
    !!loc.openingHours,
    !!loc.notes,
    !!loc.description
  ];
  
  return fields.filter(Boolean).length / fields.length;
}

/**
 * & Convert GeoJSON data to ToiletLocation objs
 */
export function geoJSONToLocations(geoData: GeoJSONData): ToiletLocation[] {
  if (!geoData.features || !Array.isArray(geoData.features)) {
    console.log('❌ No features found in data');
    return [];
  }
  
  //~ separate features by source (google sheets w/ addresses vs google maps)
  const sheetsFeatures: LocationFeature[] = [];
  const mapsFeatures: LocationFeature[] = [];
  
  //~ extract data frm feats
  for (const feature of geoData.features) {
    const properties = feature.properties || {};
    const name = properties.name;
    const address = properties.address;
    const source = properties.source;
    
    //~ skip if no name
    if (!name) continue;
    
    //~ extract coords - handle diff data formats
    let coords: [number, number] = [0, 0];
    
    if (Array.isArray(feature.geometry?.coordinates)) {
      const [lng, lat] = feature.geometry.coordinates;
      if (!isNaN(Number(lng)) && !isNaN(Number(lat))) {
        coords = [lng, lat];
      }
    }
    
    //~ categorize feats by src
    if (source === 'google-sheets' && address && address.trim() !== '') {
      sheetsFeatures.push({ name, address, coords, properties });
    } else if (source === 'google-maps') {
      mapsFeatures.push({ name, coords, properties });
    }
  }
  
  console.log(`📊 Found ${sheetsFeatures.length} features with addresses from Google Sheets`);
  console.log(`📊 Found ${mapsFeatures.length} features from Google Maps`);
  
  //~ create maps fr address lookup
  const exactAddressMap: {[name: string]: string} = {};
  const normalizedAddressMap: {[name: string]: string} = {};
  
  //~ build address maps from feats w addresses
  for (const feature of sheetsFeatures) {
    //~ skip if name/address missing / if same (likely invalid address)
    if (!feature.address || !feature.name || 
        feature.name.toLowerCase() === feature.address.toLowerCase()) {
      continue;
    }
    
    //~ exact name mapping
    exactAddressMap[feature.name] = feature.address;
    console.log(`📝 Added exact mapping: "${feature.name}" -> "${feature.address}"`);
    
    //~ also add case-insensitive mapping
    exactAddressMap[feature.name.toLowerCase()] = feature.address;
    
    //~ normalized name mapping (lowercase, no parentheses, normalized spaces/symbols)
    const normalizedName = normalizeLocationName(feature.name);
    normalizedAddressMap[normalizedName] = feature.address;
    console.log(`📝 Added normalized mapping: "${normalizedName}" -> "${feature.address}"`);
    
    //~ simplified name mapping (name w/o parentheses content)
    const simplifiedName = feature.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (simplifiedName !== feature.name && simplifiedName.length > 3) {
      exactAddressMap[simplifiedName] = feature.address;
      console.log(`📝 Added simplified mapping: "${simplifiedName}" -> "${feature.address}"`);
    }
    
    //~ words-only version (remove all non-alphanumeric chars)
    const wordsOnlyName = feature.name.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
    if (wordsOnlyName !== feature.name.toLowerCase() && wordsOnlyName.length > 3) {
      exactAddressMap[wordsOnlyName] = feature.address;
      console.log(`📝 Added words-only mapping: "${wordsOnlyName}" -> "${feature.address}"`);
    }
  }
  
  console.log(`📊 Address maps contain ${Object.keys(exactAddressMap).length} exact entries and ${Object.keys(normalizedAddressMap).length} normalized entries`);
  
  //~ final locations arr
  const uniqueLocations: ToiletLocation[] = [];
  const processedKeys = new Set<string>();
  
  //~ process Google Sheets feats (have addresses)
  sheetsFeatures.forEach(feature => {
    const { name, address, coords, properties } = feature;
    const [lng, lat] = coords;
    
    if (!name || isNaN(Number(lat)) || isNaN(Number(lng))) return;
    
    //~ unique key
    const locationKey = `${name}-${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    if (processedKeys.has(locationKey)) return;
    processedKeys.add(locationKey);
    
    //? debug address field
    console.log(`📍 Sheets feature address check for "${name}": "${address || '(missing)'}"`);
    
    //~ safely extract props w type checking
    const safeId = typeof properties.id === 'string' ? 
      properties.id : `loc-${Math.random().toString(36).substring(2, 9)}`;
    const safeName = typeof name === 'string' ? name : '';
    //~ ensure address properly extracted & defaulted
    const safeAddress = address && typeof address === 'string' && address.trim() !== '' ? address.trim() : '';
    const safeRegion = typeof properties.region === 'string' ? properties.region : 'Unknown';
    const safeType = typeof properties.type === 'string' ? properties.type : 'Other';
    
    uniqueLocations.push({
      id: safeId,
      name: safeName,
      address: safeAddress,
      region: safeRegion,
      type: safeType,
      lat: Number(lat),
      lng: Number(lng),
      hasBidet: typeof properties.hasBidet === 'boolean' ? properties.hasBidet : true, //~ assume all hav bidets unless specified
      notes: typeof properties.notes === 'string' ? properties.notes : '',
      amenities: {
        wheelchairAccess: typeof properties.hasWheelchair === 'boolean' ? properties.hasWheelchair : false,
        babyChanging: typeof properties.hasBabyChanging === 'boolean' ? properties.hasBabyChanging : false,
        freeEntry: typeof properties.hasFreeEntry === 'boolean' ? properties.hasFreeEntry : false
        //~ extra properties add to ToiletLocation type if need
      },
      rating: typeof properties.rating === 'number' || typeof properties.rating === 'string' ? 
        Number(properties.rating) : undefined,
      imageUrl: typeof properties.imageUrl === 'string' ? properties.imageUrl : undefined,
      openingHours: typeof properties.openingHours === 'string' ? properties.openingHours : undefined,
      lastUpdated: typeof properties.lastUpdated === 'string' ? properties.lastUpdated : '',
      source: 'google-sheets',
      description: typeof properties.description === 'string' ? properties.description : '',
      sheetsRemarks: typeof properties.remarks === 'string' ? properties.remarks : '',
      dataCompleteness: 0
    });
  });
  
  //~ process Google Maps feats & only use addresses frm sheets
  mapsFeatures.forEach(feature => {
    const { name, coords, properties = {} } = feature;
    //~ check if alr address in maps feat
    const existingAddress = typeof properties.address === 'string' && properties.address.trim() !== '' ? 
      properties.address.trim() : '';
    
    const [lng = 0, lat = 0] = coords;
    
    if (!name || isNaN(Number(lat)) || isNaN(Number(lng))) return;
    
    //~ unique key
    const locationKey = `${name}-${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    if (processedKeys.has(locationKey)) return;
    processedKeys.add(locationKey);
    
    //? debug if existing address found in maps feat
    if (existingAddress) {
      console.log(`📍 Maps feature already has address: "${name}" -> "${existingAddress}"`);
    }
    
    //? debug info fr maps feats
    console.log(`🔍 Processing Maps feature: "${name}" at [${lat},${lng}]`);
    
    //~ attempt find address ONLY frm Google Sheets data
    //~ prioritize existing address frm feature props if avail
    let address = existingAddress || '';
    let matchType = existingAddress ? 'property value' : '';
    
    //~ skip lookup if alr have address
    if (!address) {
      //? log lookup attempt
      console.log(`🔍 Looking up Google Sheets address for Maps feature: "${name}"`);
      
      //~ try exact name match in sheets data
      if (exactAddressMap[name]) {
        address = exactAddressMap[name];
        matchType = 'exact match';
        console.log(`✅ Found sheets address for "${name}": "${address}" (${matchType})`);
      } 
      //~ try name w/o parentheses
      else {
      const simplifiedName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (exactAddressMap[simplifiedName] && simplifiedName.length > 3) {
        address = exactAddressMap[simplifiedName];
        matchType = 'simplified match';
        console.log(`✅ Found sheets address for "${name}": "${address}" (${matchType})`);
      }
      //~ try normalized name match
      else {
        const normalizedName = normalizeLocationName(name);
        console.log(`  🔎 Normalized "${name}" to "${normalizedName}"`);
        
        if (normalizedAddressMap[normalizedName]) {
          address = normalizedAddressMap[normalizedName];
          matchType = 'normalized match';
          console.log(`✅ Found sheets address for "${name}": "${address}" (${matchType})`);
        } 
        //~ try fuzzy matching w/ normalized names
        else {
          //~ look fr partial matches in normalized keys
          const normalizedKeys = Object.keys(normalizedAddressMap);
          let bestMatch = '';
          let highestScore = 0;
          
          for (const key of normalizedKeys) {
            if (normalizedName.includes(key) || key.includes(normalizedName)) {
              //~ simple scoring - longer matches better
              const score = Math.min(key.length, normalizedName.length);
              if (score > highestScore) {
                highestScore = score;
                bestMatch = key;
              }
            }
          }
          
          if (bestMatch && highestScore > 4) { //~ min match length avoid false positives
            address = normalizedAddressMap[bestMatch];
            matchType = 'fuzzy match';
            console.log(`✅ Found sheets address for "${name}": "${address}" (${matchType} with "${bestMatch}")`);
          } else {
            console.log(`❌ No Google Sheets address found for "${name}" - this location will have NO address`);
          }
        }
      }
      }
    }
    
    //~ safely extract props w type checking
    const safeId = typeof properties.id === 'string' ? 
      properties.id : `loc-${Math.random().toString(36).substring(2, 9)}`;
    const safeName = typeof name === 'string' ? name : '';
    //~ ensure address properly handled if found
    const safeAddress = address && typeof address === 'string' && address.trim() !== '' ? address.trim() : '';
    const safeRegion = typeof properties.region === 'string' ? properties.region : 'Unknown';
    const safeType = typeof properties.type === 'string' ? properties.type : 'Other';
    
    uniqueLocations.push({
      id: safeId,
      name: safeName,
      address: safeAddress,
      region: safeRegion,
      type: safeType,
      lat: Number(lat),
      lng: Number(lng),
      hasBidet: typeof properties.hasBidet === 'boolean' ? properties.hasBidet : true,
      notes: typeof properties.notes === 'string' ? properties.notes : '',
      amenities: {
        wheelchairAccess: typeof properties.hasWheelchair === 'boolean' ? properties.hasWheelchair : false,
        babyChanging: typeof properties.hasBabyChanging === 'boolean' ? properties.hasBabyChanging : false,
        freeEntry: typeof properties.hasFreeEntry === 'boolean' ? properties.hasFreeEntry : false
      },
      rating: typeof properties.rating === 'number' || typeof properties.rating === 'string' ? 
        Number(properties.rating) : undefined,
      imageUrl: typeof properties.imageUrl === 'string' ? properties.imageUrl : undefined,
      openingHours: typeof properties.openingHours === 'string' ? properties.openingHours : undefined,
      lastUpdated: typeof properties.lastUpdated === 'string' ? properties.lastUpdated : '',
      source: 'google-maps',
      description: typeof properties.description === 'string' ? properties.description : '',
      sheetsRemarks: '',
      dataCompleteness: 0
    });
  });
  
  //~ calculate data completeness fr each location
  uniqueLocations.forEach(location => {
    location.dataCompleteness = getDataCompleteness(location);
  });
  
  console.log(`📊 Final processed location count: ${uniqueLocations.length}`);
  
  return uniqueLocations;
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
      freeEntry?: boolean;
      hasBidet?: boolean;
    }
  }
): ToiletLocation[] {
  return locations.filter(location => {
    //~ filter by region
    if (filters.region && location.region !== filters.region) {
      return false;
    }
    
    //~ filter by type
    if (filters.type && location.type !== filters.type) {
      return false;
    }
    
    //~ filter by amenities if any specified
    if (filters.amenities) {
      if (filters.amenities.wheelchairAccess && !location.amenities?.wheelchairAccess) {
        return false;
      }
      
      if (filters.amenities.babyChanging && !location.amenities?.babyChanging) {
        return false;
      }
      
      if (filters.amenities.freeEntry && !location.amenities?.freeEntry) {
        return false;
      }
      
      if (filters.amenities.hasBidet && !location.hasBidet) {
        return false;
      }
    }
    
    return true;
  });
}
