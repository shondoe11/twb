//* server-side processing of raw geojson into ToiletLocation objects
//* moved frm the client data service so browsers no longer pay fr dedup/matching work
import { ToiletLocation, GeoJSONData } from '../shared/types';

//& verbose processing diagnostics only run in dev - prod logs stay clean
const isDev = process.env.NODE_ENV === 'development';
const dlog = (...args: unknown[]): void => {
  if (isDev) console.log(...args);
};

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

//& keyword patterns fr deriving amenities frm free-text remarks - the source sheets
//& hav no structured amenity columns, only the Remarks column hints at these
const WHEELCHAIR_PATTERN = /handicap|wheelchair|disabled|accessib/;
const BABY_CHANGING_PATTERN = /baby|nursing|diaper/;
const UNISEX_PATTERN = /unisex/;
const ALL_CUBICLES_PATTERN = /all (?:the )?(?:cubicles|toilets|stalls)|every (?:cubicle|stall)/;

/**
 * & derive amenity flags frm free-text remarks/description/comments
 */
function deriveAmenities(properties: Record<string, unknown>): ToiletLocation['amenities'] {
  const texts: string[] = [];
  
  if (typeof properties.remarks === 'string') texts.push(properties.remarks);
  if (typeof properties.notes === 'string') texts.push(properties.notes);
  
  //~ description can be a string / kml object w a value field
  if (typeof properties.description === 'string') {
    texts.push(properties.description);
  } else if (
    properties.description && typeof properties.description === 'object' &&
    'value' in properties.description && typeof (properties.description as { value: unknown }).value === 'string'
  ) {
    texts.push((properties.description as { value: string }).value);
  }
  
  //~ merged features carry per-source comment arrays
  const sourceComments = properties.sourceComments as { sheets?: unknown[]; maps?: unknown[] } | undefined;
  if (sourceComments && typeof sourceComments === 'object') {
    [...(sourceComments.sheets ?? []), ...(sourceComments.maps ?? [])].forEach(comment => {
      if (typeof comment === 'string') texts.push(comment);
    });
  }
  
  const text = texts.join(' ').toLowerCase();
  
  return {
    wheelchairAccess: WHEELCHAIR_PATTERN.test(text),
    babyChanging: BABY_CHANGING_PATTERN.test(text),
    unisex: UNISEX_PATTERN.test(text),
    bidetInAllCubicles: ALL_CUBICLES_PATTERN.test(text)
  };
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
  //~ ensure input is valid geoJSON
  if (!geoData || !geoData.features || !Array.isArray(geoData.features)) {
    console.error('Invalid GeoJSON data');
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

  dlog(`Processing GeoJSON - features count: ${geoData.features?.length || 0}`);
  dlog(`- Google Sheets features: ${sheetsFeatures.length}`);
  dlog(`- Google Maps features: ${mapsFeatures.length}`);
  
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
  
  dlog(`Built address lookup tables with ${Object.keys(exactAddressMap).length} exact matches and ${Object.keys(normalizedAddressMap).length} normalized matches`);
  
  //~ final locations arr
  const uniqueLocations: ToiletLocation[] = [];
  const processedKeys = new Set<string>();
  
  //~ process Google Sheets feats 1st (preferred src fr most data)
  sheetsFeatures.forEach(feature => {
    const { name, address, coords, properties } = feature;
    const [lng, lat] = coords;
    
    if (!name || isNaN(Number(lat)) || isNaN(Number(lng))) return;
    
    //~ unique key
    const locationKey = `${name}-${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    if (processedKeys.has(locationKey)) return;
    processedKeys.add(locationKey);
    
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
      tempAddress = '';
    }
    const safeAddress = tempAddress;
    
    const safeRegion = typeof properties.region === 'string' ? properties.region : 'Unknown';
    
    //~ determine facility types based on source tab & existing type
    let safeType = typeof properties.type === 'string' ? properties.type : 'Other';
    //~ normalize to title case so 'male' & 'Male' don't show up as separate filter options
    safeType = safeType.charAt(0).toUpperCase() + safeType.slice(1).toLowerCase();
    
    //~ build arr of facility types this location supports
    const facilityTypes = new Set<string>();
    
    //~ add original type if exists
    if (typeof safeType === 'string' && safeType !== 'Other') {
      facilityTypes.add(safeType);
    }
    
    //~ gender derived frm sourceTab since the generated gender property is unreliable
    let safeGender: 'male' | 'female' | 'any' | undefined;
    
    //~ check if frm female sheet - sourceTab contains this info
    if (typeof properties.sourceTab === 'string') {
      const sourceTab = properties.sourceTab.toLowerCase();
      //~ check 'female' before 'male' - 'female'.includes('male') is true, so use else-if
      if (sourceTab.includes('female')) {
        //~ sourceTab is source of truth: drop the mistagged 'Male' type frm buggy generated data
        facilityTypes.delete('Male');
        facilityTypes.add('Female');
        safeType = 'Female';
        safeGender = 'female';
      } else if (sourceTab.includes('male')) {
        facilityTypes.add('Male');
        safeGender = 'male';
      }
      if (sourceTab.includes('hotel')) {
        facilityTypes.add('Hotel');
        if (!safeGender) safeGender = 'any';
      }
    }
    
    //~ add fallback before converting the set, otherwise 'Other' never lands in the types arr
    if (facilityTypes.size === 0) {
      facilityTypes.add('Other');
    }
    //~ convert set to array fr types property
    const typesArray = Array.from(facilityTypes);
    
    //~ if no specific type set, use 1st type as main type
    if (safeType === 'Other' && typesArray.length > 0) {
      safeType = typesArray[0];
    }

    
    uniqueLocations.push({
      id: safeId,
      name: safeName,
      address: safeAddress,
      region: safeRegion,
      type: safeType,
      //~ types arr was never included fr sheets locations - this broke the female filter
      types: typesArray,
      gender: safeGender,
      lat: Number(lat),
      lng: Number(lng),
      hasBidet: typeof properties.hasBidet === 'boolean' ? properties.hasBidet : true, //~ assume all hav bidets unless specified
      notes: typeof properties.notes === 'string' ? properties.notes : '',
      //~ sheets hav no structured amenity columns - derive flags frm remarks keywords instead
      amenities: deriveAmenities(properties),
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
    
    let address = '';
    
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
      }
      //~ else: address exactly match name & short w no postal code / SG, likely nt real address
    }
    
    //~ skip lookup if alr have address
    if (!address) {
      //~ try exact name match in sheets data
      if (exactAddressMap[name]) {
        address = exactAddressMap[name];
      } 
      //~ try name w/o parentheses
      else {
        const simplifiedName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (exactAddressMap[simplifiedName] && simplifiedName.length > 3) {
          address = exactAddressMap[simplifiedName];
        }
        //~ try normalized name match
        else {
          const normalizedName = normalizeLocationName(name);
          
          if (normalizedAddressMap[normalizedName]) {
            address = normalizedAddressMap[normalizedName];
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
    
    //~ determine facility types based on src tab & existing type
    let safeType = typeof properties.type === 'string' ? properties.type : 'Other';
    //~ normalize to title case so 'male' & 'Male' don't show up as separate filter options
    safeType = safeType.charAt(0).toUpperCase() + safeType.slice(1).toLowerCase();
    
    //~ build arr of facility types fr maps features also
    const facilityTypes = new Set<string>();
    
    //~ add original type if exists
    if (typeof safeType === 'string' && safeType !== 'Other') {
      facilityTypes.add(safeType);
    }
    
    //~ gender derived frm sourceTab first since the generated gender property is unreliable
    let safeGender: 'male' | 'female' | 'any' | undefined;
    
    //~ check if sourceTab info is avail in maps features too
    if (typeof properties.sourceTab === 'string') {
      const sourceTab = properties.sourceTab.toLowerCase();
      //~ check 'female' before 'male' - 'female'.includes('male') is true, so use else-if
      if (sourceTab.includes('female')) {
        //~ sourceTab is source of truth: drop the mistagged 'Male' type frm buggy generated data
        facilityTypes.delete('Male');
        facilityTypes.add('Female');
        safeType = 'Female';
        safeGender = 'female';
      } else if (sourceTab.includes('male')) {
        facilityTypes.add('Male');
        safeGender = 'male';
      }
      if (sourceTab.includes('hotel')) {
        facilityTypes.add('Hotel');
        if (!safeGender) safeGender = 'any';
      }
    }
    
    //~ check gender property fr additional type info
    //~ only trust the gender property whn sourceTab gave nothing (generated gender data was buggy)
    if (!safeGender && typeof properties.gender === 'string') {
      const gender = properties.gender.toLowerCase();
      if (gender === 'male') {
        facilityTypes.add('Male');
        safeGender = 'male';
      } else if (gender === 'female') {
        facilityTypes.add('Female');
        safeGender = 'female';
      } else if (gender === 'any') {
        safeGender = 'any';
      }
    }
    
    //~ add fallback before converting the set, otherwise 'Other' never lands in the types arr
    if (facilityTypes.size === 0) {
      facilityTypes.add('Other');
    }
    //~ convert set to arr fr types property
    const typesArray = Array.from(facilityTypes);
    
    //~ if no specific type set, use 1st type as main type
    if (safeType === 'Other' && typesArray.length > 0) {
      safeType = typesArray[0];
    }
    
    uniqueLocations.push({
      id: safeId,
      name: safeName,
      address: safeAddress,
      region: safeRegion,
      type: safeType,
      types: typesArray,
      gender: safeGender,
      lat: Number(lat),
      lng: Number(lng),
      hasBidet: typeof properties.hasBidet === 'boolean' ? properties.hasBidet : true,
      notes: typeof properties.notes === 'string' ? properties.notes : '',
      //~ maps features also carry free-text descriptions - derive amenity flags frm keywords
      amenities: deriveAmenities(properties),
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
  
  dlog(`Final processed location count: ${uniqueLocations.length}`);
  
  //~ concise dev summary: locations per facility type
  if (isDev) {
    const typeCounts: Record<string, number> = {};
    uniqueLocations.forEach(location => {
      if (location.type) {
        typeCounts[location.type] = (typeCounts[location.type] || 0) + 1;
      }
    });
    dlog('Facility type counts:', typeCounts);
  }
  
  return uniqueLocations;
}

