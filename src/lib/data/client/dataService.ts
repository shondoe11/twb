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
  properties: Record<string, unknown>; //~ unknown fr type safety, cast properly whn accessing
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
  
  //~ extract feat data & organize by src
  for (const feature of geoData.features) {
    //~ process ALL features, not just subsets
    const props = feature.properties || {};
    const source = props.source || 'unknown';
    const name = props.name || props.Name || '';
    const address = typeof props.address === 'string' ? props.address : 
                  typeof props.Address === 'string' ? props.Address : '';
    
    //~ extract coords, handle geojson formatted coords
    let coords: [number, number] = [0, 0];
    if (feature.geometry?.type === 'Point' && 
        Array.isArray(feature.geometry.coordinates) && 
        feature.geometry.coordinates.length >= 2) {
      coords = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
    }
    
    //~ relax reqs fr what gets processed
    if (source === 'google-sheets') {
      //~ all sheets features are valuable, even w/o address
      if (typeof name === 'string') {
        sheetsFeatures.push({
          name, 
          address, 
          coords, 
          properties: props
        });
      }
    } else if (source === 'google-maps' || !source) {
      //~ include ALL maps feats regardless of address
      if (typeof name === 'string') {
        mapsFeatures.push({
          name, 
          address, 
          coords, 
          properties: props
        });
      }
    } else {
      //~ catch any other srcs
      console.log(`🔄 Processing feature from source: ${source}`);
      if (name && typeof name === 'string') {
        //~ determine which category to input
        if (address && typeof address === 'string' && address.trim() !== '') {
          sheetsFeatures.push({
            name, 
            address, 
            coords, 
            properties: props
          });
        } else {
          mapsFeatures.push({
            name, 
            address, 
            coords, 
            properties: props
          });
        }
      }
    }
  }

  console.log(`🔍 Extracted ${sheetsFeatures.length} sheets features and ${mapsFeatures.length} maps features`);

  //~ build lookup tables fr sheets addr to use in maps feats
  const exactAddressMap: Record<string, string> = {};
  const normalizedAddressMap: Record<string, string> = {};

  //~ populate lookup tables frm sheets
  sheetsFeatures.forEach(feat => {
    if (feat.address && typeof feat.address === 'string' && feat.address.trim() !== '') {
      //~ add to exact lookup tbl
      exactAddressMap[feat.name] = feat.address;
      
      //~ normalize name & add to norm lookup tbl
      const normalizedName = normalizeLocationName(feat.name);
      if (normalizedName) {
        normalizedAddressMap[normalizedName] = feat.address;
      }
    }
  });
  
  console.log(`🔍 Built address lookup tables with ${Object.keys(exactAddressMap).length} exact matches and ${Object.keys(normalizedAddressMap).length} normalized matches`);
  
  //~ final locations arr
  const uniqueLocations: ToiletLocation[] = [];
  const processedKeys = new Set<string>();
  
  console.log('📈 PROCESSING STATS:');
  console.log(`🧾 Total Google Sheets features: ${sheetsFeatures.length}`);
  console.log(`🗺️ Total Google Maps features: ${mapsFeatures.length}`);
  
  //~ process Google Sheets feats 1st (preferred src fr most data)
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
    
    let tempAddress = address && typeof address === 'string' ? address.trim() : '';
    
    //~ only clear address if exactly name AND shorter than 25 chars
    //~ AND nt contain postal code / SG
    if (tempAddress.toLowerCase() === safeName.toLowerCase() && 
        tempAddress.length < 25 &&
        !tempAddress.toLowerCase().includes('singapore') &&
        !/\d{5,}/.test(tempAddress)) {
      console.log(`⚠️ Address matches name for "${safeName}", clearing address to prevent duplication`);
      tempAddress = '';
    }
    const safeAddress = tempAddress;
    
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
      },
      rating: typeof properties.rating === 'number' || typeof properties.rating === 'string' ? 
        Number(properties.rating) : undefined,
      imageUrl: typeof properties.imageUrl === 'string' ? properties.imageUrl : undefined,
      openingHours: typeof properties.openingHours === 'string' ? properties.openingHours : undefined,
      lastUpdated: typeof properties.lastUpdated === 'string' ? properties.lastUpdated : '',
      source: 'google-sheets',
      description: typeof properties.description === 'string' ? properties.description : '',
      sheetsRemarks: typeof properties.remarks === 'string' ? properties.remarks : '',
      dataCompleteness: 0 //todo: calculate later
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
    
    let address = '';
    let matchType = '';
    
    //~ be more selective abt when to ignore addresses that match names
    if (existingAddress) {
      const isNameAsAddress = existingAddress.toLowerCase() === name.toLowerCase();
      const isShortAddress = existingAddress.length < 25;
      const hasPostalCode = /\d{5,}/.test(existingAddress);
      const hasSingapore = existingAddress.toLowerCase().includes('singapore');
      
      //~ only ignore address that exactly match name AND short AND lack SG/postal code
      //~ real addresses typically include SG, postal code, / are longer
      if (!isNameAsAddress || !isShortAddress || hasPostalCode || hasSingapore) {
        address = existingAddress;
        matchType = 'property value';
      } else {
        //~ address exactly match name & short w no postal code / SG, likely nt real address
        console.log(`⚠️ Maps feature "${name}" has address same as name, ignoring it`);
      }
    }
    
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
  uniqueLocations.forEach((location: ToiletLocation) => {
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
