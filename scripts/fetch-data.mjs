#!/usr/bin/env node

//* script: fetch data frm google sheets & maps & save to data dir
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import csvParser from 'csv-parser';
import { DOMParser } from 'xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { setTimeout } from 'timers/promises';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& Google data source IDs
const SHEETS_ID = '1jAMaD3afMfA19U2u1aRLkL0M-ufFvz1fKDpT_BraOfY';
const MAPS_ID = '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0';

//& URLs fr data srcs
const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/export?format=csv`;
const MAPS_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${MAPS_ID}`;

//& output file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const SHEETS_OUTPUT = path.join(DATA_DIR, 'toilets.json');
const MAPS_OUTPUT = path.join(DATA_DIR, 'toilets.geojson');
const COMBINED_OUTPUT = path.join(DATA_DIR, 'combined.geojson');
const ENRICHED_OUTPUT = path.join(DATA_DIR, 'enriched.geojson');
const CACHE_METADATA = path.join(CACHE_DIR, 'metadata.json');

//& max age fr cached data in ms (24h)
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; 

//& alt sheets url formats try if primary fail
const SHEETS_URL_ALTERNATIVES = [
  `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/export?format=csv&id=${SHEETS_ID}`,
  `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/gviz/tq?tqx=out:csv`,
  `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/pub?output=csv`
];

//& cache management functions
async function setupCache() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    
    //~ try to read existing metadata
    try {
      const metadataRaw = await fs.readFile(CACHE_METADATA, 'utf8');
      return JSON.parse(metadataRaw);
    } catch {
      //~ create new metadata if it doesn't exist (ignoring error - expected on first run)
      const initialMetadata = { lastUpdated: 0, dataHashes: {} };
      await fs.writeFile(CACHE_METADATA, JSON.stringify(initialMetadata, null, 2));
      return initialMetadata;
    }
  } catch (error) {
    console.error('Error setting up cache:', error);
    return { lastUpdated: 0, dataHashes: {} };
  }
}

async function saveToCache(key, data) {
  try {
    const dataStr = JSON.stringify(data);
    const dataHash = createHash('md5').update(dataStr).digest('hex');
    const cacheFilePath = path.join(CACHE_DIR, `${key}.json`);
    
    //~ save data to cache
    await fs.writeFile(cacheFilePath, dataStr);
    
    //~ update metadata
    const metadata = await setupCache();
    metadata.dataHashes[key] = dataHash;
    metadata.lastUpdated = Date.now();
    await fs.writeFile(CACHE_METADATA, JSON.stringify(metadata, null, 2));
    
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to cache:`, error);
    return false;
  }
}

async function getFromCache(key) {
  try {
    const metadata = await setupCache();
    
    //~ check if cache is valid
    if (!metadata.dataHashes[key]) {
      return null; //~ no cached data
    }
    
    //~ check if cache is too old
    if (Date.now() - metadata.lastUpdated > CACHE_MAX_AGE) {
      console.log('Cache is too old, fetching fresh data...');
      return null;
    }
    
    //~ read cached data
    const cacheFilePath = path.join(CACHE_DIR, `${key}.json`);
    const cachedDataRaw = await fs.readFile(cacheFilePath, 'utf8');
    const cachedData = JSON.parse(cachedDataRaw);
    
    console.log(`Using cached ${key} data from ${new Date(metadata.lastUpdated).toLocaleString()}`);
    return cachedData;
  } catch (error) {
    console.error(`Error reading ${key} from cache:`, error);
    return null;
  }
}

//& fetch csv data frm google sheets & parse into json with fallbacks
async function fetchSheets() {
  //~ try get data frm cache 1st
  const cachedData = await getFromCache('sheets');
  if (cachedData && cachedData.length > 0) {
    return cachedData;
  }
  
  //~ try primary url 1st
  try {
    const data = await tryFetchSheets(SHEETS_URL);
    if (data && data.length > 0) {
      await saveToCache('sheets', data);
      return data;
    }
  } catch (error) {
    console.warn(`Primary sheets URL failed: ${error.message}`);
  }
  
  //~ try alternative urls if primary fails
  for (const altUrl of SHEETS_URL_ALTERNATIVES) {
    try {
      console.log(`Trying alternative URL: ${altUrl}`);
      const data = await tryFetchSheets(altUrl);
      if (data && data.length > 0) {
        await saveToCache('sheets', data);
        return data;
      }
    } catch (error) {
      console.warn(`Alternative sheets URL failed: ${error.message}`);
    }
  }
  
  //~ all attempts failed, use sample data
  console.warn('All Google Sheets URLs failed, using sample data');
  const sampleData = createSampleLocations();
  await saveToCache('sheets', sampleData);
  return sampleData;
}

//& helper function to try fetching sheets from a specific url
async function tryFetchSheets(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TWB-DataFetcher/1.0)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sheets data: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    throw new Error('Google Sheets returned HTML instead of CSV');
  }
  
  const csvText = await response.text();
  if (!csvText || csvText.trim().length === 0) {
    throw new Error('Empty CSV response');
  }
  
  return parseCSV(csvText);
}

//& create sample locations whn google sheets access fails
function createSampleLocations() {
  //~ current date fr last updated field
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      id: 'sample-1',
      name: 'Jewel Changi Airport',
      address: '78 Airport Blvd, Singapore 819666',
      region: 'east',
      type: 'mall',
      lat: 1.3601,
      lng: 103.9890,
      hasBidet: true,
      amenities: {
        wheelchairAccess: true,
        babyChanging: true,
        freeEntry: true,
      },
      notes: 'Level 2, near the Rain Vortex',
      lastUpdated: today,
    },
    {
      id: 'sample-2',
      name: 'VivoCity',
      address: '1 HarbourFront Walk, Singapore 098585',
      region: 'south',
      type: 'mall',
      lat: 1.2640,
      lng: 103.8219,
      hasBidet: true,
      amenities: {
        wheelchairAccess: true,
        babyChanging: true,
        freeEntry: true,
      },
      lastUpdated: today,
    },
    {
      id: 'sample-3',
      name: 'Marina Bay Sands',
      address: '10 Bayfront Avenue, Singapore 018956',
      region: 'central',
      type: 'hotel',
      lat: 1.2834,
      lng: 103.8607,
      hasBidet: true,
      amenities: {
        wheelchairAccess: true,
        babyChanging: false,
        freeEntry: false,
      },
      notes: 'Luxurious restrooms on the casino floor and shopping levels',
      lastUpdated: today,
    },
    {
      id: 'sample-4',
      name: 'Botanic Gardens Visitor Centre',
      address: '1 Cluny Road, Singapore 259569',
      region: 'central',
      type: 'public',
      lat: 1.3138,
      lng: 103.8159,
      hasBidet: false,
      amenities: {
        wheelchairAccess: true,
        babyChanging: false,
        freeEntry: true,
      },
      lastUpdated: today,
    },
    {
      id: 'sample-5',
      name: 'Northpoint City',
      address: '930 Yishun Ave 2, Singapore 769098',
      region: 'north',
      type: 'mall',
      lat: 1.4294,
      lng: 103.8354,
      hasBidet: true,
      amenities: {
        wheelchairAccess: true,
        babyChanging: true,
        freeEntry: true,
      },
      lastUpdated: today,
    },
    {
      id: 'sample-6',
      name: 'Jurong East MRT Station',
      address: '10 Jurong East Street 12, Singapore 609690',
      region: 'west',
      type: 'public',
      lat: 1.3331,
      lng: 103.7422,
      hasBidet: false,
      amenities: {
        wheelchairAccess: true,
        babyChanging: false,
        freeEntry: true,
      },
      lastUpdated: today,
    },
  ];
}

//& parse csv text into arr of objs w validation
function parseCSV(csvText) {
  return new Promise((resolve, reject) => {
    //~ check fr empty CSV
    if (!csvText || csvText.trim().length === 0) {
      console.error('Empty CSV data received');
      return resolve([]);
    }
    
    const results = [];
    const stream = Readable.from(csvText);
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`Parsed ${results.length} rows from CSV`);
        
        //~ check if have any data
        if (results.length === 0) {
          console.warn('No data rows in CSV');
          return resolve([]);
        }
        
        //~ convert to toilet location format w data validation
        const locations = results.map((record, index) => {
          //~ validate req fields
          const name = record.name || record.Name || record.LOCATION || '';
          const lat = parseFloat(record.latitude || record.lat || record.Latitude || record.LAT || 0);
          const lng = parseFloat(record.longitude || record.lng || record.Longitude || record.LNG || 0);
          
          //~ normalize region values to lowercase
          let region = (record.region || record.Region || '').toLowerCase();
          //~ map region aliases to standard vals
          if (region.includes('north')) region = 'north';
          if (region.includes('south')) region = 'south';
          if (region.includes('east')) region = 'east';
          if (region.includes('west')) region = 'west';
          if (region.includes('central')) region = 'central';
          
          //~ normalize type values to lowercase
          let type = (record.type || record.Type || '').toLowerCase();
          
          //~ parse bool values w multiple formats
          const parseBool = (value) => {
            if (!value) return false;
            const v = String(value).toLowerCase();
            return v === 'true' || v === 'yes' || v === '1' || v === 'y';
          };
          
          return {
            id: record.id || `location-${index}`,
            name,
            address: record.address || record.Address || '',
            region,
            type,
            lat,
            lng,
            hasBidet: parseBool(record.hasBidet || record.HasBidet),
            amenities: {
              wheelchairAccess: parseBool(record.wheelchairAccess || record.WheelchairAccess),
              babyChanging: parseBool(record.babyChanging || record.BabyChanging),
              freeEntry: parseBool(record.freeEntry || record.FreeEntry),
            },
            notes: record.notes || record.Notes || '',
            lastUpdated: record.lastUpdated || record.LastUpdated || new Date().toISOString().split('T')[0],
            openingHours: record.openingHours || record.OpeningHours || '',
            rating: parseFloat(record.rating || record.Rating || 0) || 0
          };
        });
        
        //~ filter out invalid entries (must have name & coords)
        const validLocations = locations.filter(loc => 
          loc.name.trim() && 
          (loc.lat !== 0 || loc.lng !== 0) &&
          !isNaN(loc.lat) && 
          !isNaN(loc.lng)
        );
        
        console.log(`Filtered to ${validLocations.length} valid locations`);
        resolve(validLocations);
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error);
        reject(error);
      });
  });
}

//& fetch kml data frm google my maps & convert to geojson
async function fetchMaps() {
  //~ try get data frm cache 1st
  const cachedData = await getFromCache('maps');
  if (cachedData && cachedData.features && cachedData.features.length > 0) {
    return cachedData;
  }
  
  try {
    console.log('Fetching fresh KML data from Google My Maps...');
    const response = await fetch(MAPS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TWB-DataFetcher/1.0)'
      },
      timeout: 10000 //~ 10s timeout
    });
    
    if (!response.ok) {
      throw new Error(`failed to fetch kml data: ${response.status}`);
    }
    
    const kmlText = await response.text();
    if (!kmlText || kmlText.trim().length === 0) {
      throw new Error('empty kml response');
    }
    
    //~ validate that it is actual kml data
    if (!kmlText.includes('<kml') && !kmlText.includes('<KML')) {
      throw new Error('invalid kml format received');
    }
    
    const geojsonData = convertKMLtoGeoJSON(kmlText);
    
    //~ validate converted data
    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
      throw new Error('no features found in kml data');
    }
    
    //~ save cache if valid
    await saveToCache('maps', geojsonData);
    return geojsonData;
  } catch (error) {
    console.error('error fetching google my maps data:', error);
    
    //~ return empty collection / cached data if avail
    if (cachedData) {
      console.warn('using older cached maps data due to fetch error');
      return cachedData;
    }
    
    return { type: 'FeatureCollection', features: [] };
  }
}

//& convert kml text to geojson using togeojson lib
function convertKMLtoGeoJSON(kmlText) {
  try {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const geojson = toGeoJSON.kml(kmlDoc);
    
    //~ process GeoJSON to extract & standardize props
    const processedFeatures = geojson.features.map(feature => {
      const { properties } = feature;
      const name = properties.name || 'Unknown Location';
      
      //~ extract type, region, & other details frm description if avail
      let type = 'unknown';
      let region = 'unknown';
      let hasBidet = true; //~ assume all locations in the KML have bidets
      let address = '';
      let notes = '';
      
      //~ try extract more deets frm description / extended data
      if (properties.description) {
        //~ ensure description is a string
        const descStr = String(properties.description);
        
        //~ parse HTML content frm description to extract structured data
        if (descStr.includes('Type:')) {
          type = extractPropertyFromDescription(descStr, 'Type:') || type;
        }
        if (descStr.includes('Region:')) {
          region = extractPropertyFromDescription(descStr, 'Region:') || region;
        }
        if (descStr.includes('Address:')) {
          address = extractPropertyFromDescription(descStr, 'Address:') || address;
        }
        if (descStr.includes('Notes:')) {
          notes = extractPropertyFromDescription(descStr, 'Notes:') || notes;
        }
      }
      
      return {
        ...feature,
        properties: {
          ...properties,
          id: properties.id || `map-${Math.random().toString(36).substring(2, 9)}`,
          name,
          address,
          region: region.toLowerCase(),
          type: type.toLowerCase(),
          hasBidet,
          amenities: {
            wheelchairAccess: properties.wheelchairAccess === 'true' || properties.wheelchairAccess === 'yes' || false,
            babyChanging: properties.babyChanging === 'true' || properties.babyChanging === 'yes' || false,
            freeEntry: properties.freeEntry === 'true' || properties.freeEntry === 'yes' || true,
          },
          notes,
          lastUpdated: new Date().toISOString().split('T')[0],
          source: 'google-maps'
        }
      };
    });
    
    console.log(`Converted KML to GeoJSON with ${processedFeatures.length} features`);
    return {
      type: 'FeatureCollection',
      features: processedFeatures
    };
  } catch (error) {
    console.error('Error converting KML to GeoJSON:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

//& extract property frm kml description html content
function extractPropertyFromDescription(description, propertyName) {
  const regex = new RegExp(`${propertyName}\\s*([^<]+)`);
  const match = description.match(regex);
  return match ? match[1].trim() : null;
}

//& convert toilet locations to geojson format
function locationsToGeoJSON(locations) {
  return {
    type: 'FeatureCollection',
    features: locations.map(location => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [location.lng, location.lat] //~ GeoJSON uses [longitude, latitude]
      },
      properties: {
        id: location.id,
        name: location.name,
        address: location.address,
        region: location.region,
        type: location.type,
        hasBidet: location.hasBidet,
        amenities: location.amenities,
        notes: location.notes,
        lastUpdated: location.lastUpdated,
        source: 'google-sheets'
      }
    }))
  };
}

//& merge data frm sheets & maps into single geojson file
function mergeSheetsAndMapsData(sheetsData, mapsData) {
  //~ mark src of each feature frm maps data
  const mapsFeatures = mapsData.features.map(feature => ({
    ...feature,
    properties: {
      ...feature.properties,
      source: 'google-maps'
    }
  }));
  
  //~ convert sheets data to geojson
  const sheetsGeoJSON = locationsToGeoJSON(sheetsData);
  
  //~ combine both sources
  return {
    type: 'FeatureCollection',
    features: [...sheetsGeoJSON.features, ...mapsFeatures]
  };
}

//~ reverse geocoding fr addresses & region data using nominatim api
async function reverseGeocode(lat, lng) {
  try {
    //~ check if have valid coords
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return null;
    }
    
    //~ cache key based on coords
    const cacheKey = `geocode_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    
    //~ try get frm cache 1st
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    //~ respect api rate limits (1 req/s)
    await setTimeout(1000);
    
    //~ call nominatim api
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
      {
        headers: {
          'User-Agent': 'TWB-Singapore/1.0',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`geocoding api error: ${response.status}`);
    }
    
    const data = await response.json();
    
    //~ extract useful address components
    const result = {
      address: data.display_name || '',
      region: ''
    };
    
    //~ determine region based on address/coords
    if (data.address) {
      //~ extract region from various possible address fields
      const regionFromAddress = determineRegionFromAddress(data.address);
      if (regionFromAddress) {
        result.region = regionFromAddress;
      } else {
        //~ fallback determining region frm coords
        result.region = determineRegionFromCoordinates(lat, lng);
      }
    } else {
      result.region = determineRegionFromCoordinates(lat, lng);
    }
    
    //~ cache result
    await saveToCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`reverse geocoding failed: ${error.message}`);
    return null;
  }
}

//& determine region frm address components
function determineRegionFromAddress(address) {
  //~ normalize all values to lowercase fr matching
  const addressString = JSON.stringify(address).toLowerCase();
  
  //~ check fr region keywords in address
  if (addressString.includes('north') || 
      addressString.includes('woodlands') || 
      addressString.includes('yishun') || 
      addressString.includes('sembawang')) {
    return 'north';
  }
  
  if (addressString.includes('west') || 
      addressString.includes('jurong') || 
      addressString.includes('clementi') || 
      addressString.includes('bukit batok')) {
    return 'west';
  }
  
  if (addressString.includes('east') || 
      addressString.includes('tampines') || 
      addressString.includes('pasir ris') || 
      addressString.includes('changi')) {
    return 'east';
  }
  
  if (addressString.includes('central') || 
      addressString.includes('orchard') || 
      addressString.includes('novena') || 
      addressString.includes('toa payoh')) {
    return 'central';
  }
  
  if (addressString.includes('south') || 
      addressString.includes('sentosa') || 
      addressString.includes('bukit merah') || 
      addressString.includes('marina')) {
    return 'south';
  }
  
  //~ no region found in address
  return '';
}

//& determine region based on coords
function determineRegionFromCoordinates(lat, lng) {
  //~ sg regions by rough coords
  //~ central (approximate)
  if (lat > 1.28 && lat < 1.35 && lng > 103.80 && lng < 103.88) {
    return 'central';
  }
  
  //~ east (approximate)
  if (lng > 103.88) {
    return 'east';
  }
  
  //~ west (approximate)
  if (lng < 103.78) {
    return 'west';
  }
  
  //~ north (approximate)
  if (lat > 1.38) {
    return 'north';
  }
  
  //~ south (approximate)
  if (lat < 1.28) {
    return 'south';
  }
  
  //~ default central if unsure
  return 'central';
}

//& enrich toilet location data w additional metadata
async function enrichLocationData(locations) {
  console.log('\n🔍 Enriching location data with additional information...');
  const enriched = [];
  const total = locations.length;
  let processed = 0;
  
  for (const location of locations) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${total} locations processed`);
    }
    
    //~ create copy to avoid modifying original
    const enrichedLocation = { ...location };
    
    //~ fill in missing address/region using reverse geocoding
    if ((!location.address || !location.region) && location.lat && location.lng) {
      try {
        const geoData = await reverseGeocode(location.lat, location.lng);
        if (geoData) {
          //~ only use address if original missing
          if (!enrichedLocation.address && geoData.address) {
            enrichedLocation.address = geoData.address;
          }
          
          //~ only use region if original missing
          if (!enrichedLocation.region && geoData.region) {
            enrichedLocation.region = geoData.region;
          }
        }
      } catch (error) {
        console.warn(`could not enrich location ${location.name}: ${error.message}`);
      }
    }
    
    //~ add default values fr req fields if still missing
    if (!enrichedLocation.region) {
      enrichedLocation.region = 'unknown';
    }
    
    if (!enrichedLocation.type) {
      //~ guess type based on name if possible
      const name = enrichedLocation.name.toLowerCase();
      if (name.includes('mall') || name.includes('shopping')) {
        enrichedLocation.type = 'mall';
      } else if (name.includes('mrt') || name.includes('station')) {
        enrichedLocation.type = 'public';
      } else if (name.includes('hotel')) {
        enrichedLocation.type = 'hotel';
      } else {
        enrichedLocation.type = 'other';
      }
    }
    
    //~ add normalized opening hours if available
    if (enrichedLocation.openingHours) {
      try {
        enrichedLocation.normalizedHours = normalizeOpeningHours(enrichedLocation.openingHours);
      } catch {
        //~ keep original if normalization fails
      }
    }
    
    //~ add placeholder image URLs if have info
    if (!enrichedLocation.imageUrl) {
      enrichedLocation.imageUrl = getPlaceholderImage(enrichedLocation);
    }
    
    enriched.push(enrichedLocation);
  }
  
  console.log(`✅ Enriched ${enriched.length} locations with additional data`);
  return enriched;
}

//~ normalize opening hours into standard format
//& normalize opening hours into standard format
function normalizeOpeningHours(hours) {
  //~ simple conversion - more sophisticated parsing could be added
  return hours.trim();
}

//& get placeholder image URL based on location type
function getPlaceholderImage(location) {
  const type = location.type.toLowerCase();
  const hasBidet = location.hasBidet;
  
  //~ return placeholder URL based on type & bidet availability
  //~ replaced w actual image URLs in prod
  if (type === 'mall') {
    return hasBidet ? '/images/placeholders/mall-bidet.jpg' : '/images/placeholders/mall-standard.jpg';
  } else if (type === 'hotel') {
    return hasBidet ? '/images/placeholders/hotel-bidet.jpg' : '/images/placeholders/hotel-standard.jpg';
  } else if (type === 'public') {
    return hasBidet ? '/images/placeholders/public-bidet.jpg' : '/images/placeholders/public-standard.jpg';
  } else {
    return hasBidet ? '/images/placeholders/toilet-bidet.jpg' : '/images/placeholders/toilet-standard.jpg';
  }
}

//& main func w enhanced err handling & verbose logging
async function fetchData() {
  try {
    //~ setup data dirs
    console.log('Setting up data directories...');
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    
    //~ initialize stats object fr tracking results
    const stats = {
      sheetsLocations: 0,
      mapsFeatures: 0,
      combinedFeatures: 0,
      enrichedFeatures: 0,
      warnings: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    //~ fetch & process google sheets data
    console.log('\n📊 Fetching data from Google Sheets...');
    let sheetsData = [];
    try {
      sheetsData = await fetchSheets();
      stats.sheetsLocations = sheetsData.length;
      await fs.writeFile(SHEETS_OUTPUT, JSON.stringify(sheetsData, null, 2));
      console.log(`✅ Saved ${sheetsData.length} locations to ${SHEETS_OUTPUT}`);
    } catch (error) {
      console.error(`❌ Error with Google Sheets data: ${error.message}`);
      stats.errors++;
      //~ continue w empty data rather than failing completely
      sheetsData = [];
    }
    
    //~ fetch & process google my maps data
    console.log('\n🗺️ Fetching data from Google My Maps...');
    let mapsData = { type: 'FeatureCollection', features: [] };
    try {
      mapsData = await fetchMaps();
      stats.mapsFeatures = mapsData.features.length;
      await fs.writeFile(MAPS_OUTPUT, JSON.stringify(mapsData, null, 2));
      console.log(`✅ Saved GeoJSON with ${mapsData.features.length} features to ${MAPS_OUTPUT}`);
    } catch (error) {
      console.error(`❌ Error with Google My Maps data: ${error.message}`);
      stats.errors++;
      //~ continue w empty data rather than failing completely
    }
    
    //~ merge data frm both sources
    console.log('\n🔄 Merging data from both sources...');
    let combinedData = { type: 'FeatureCollection', features: [] };
    try {
      combinedData = mergeSheetsAndMapsData(sheetsData, mapsData);
      stats.combinedFeatures = combinedData.features.length;
      await fs.writeFile(COMBINED_OUTPUT, JSON.stringify(combinedData, null, 2));
      console.log(`✅ Saved combined GeoJSON with ${combinedData.features.length} features to ${COMBINED_OUTPUT}`);
    } catch (error) {
      console.error(`❌ Error merging data: ${error.message}`);
      stats.errors++;
      //~ try save what we can
      try {
        const fallbackData = {
          type: 'FeatureCollection',
          features: [...(sheetsData ? locationsToGeoJSON(sheetsData).features : []), ...(mapsData ? mapsData.features : [])]
        };
        await fs.writeFile(COMBINED_OUTPUT, JSON.stringify(fallbackData, null, 2));
        console.log(`⚠️ Saved fallback combined data with ${fallbackData.features.length} features`);
        stats.combinedFeatures = fallbackData.features.length;
        stats.warnings++;
      } catch (fallbackError) {
        console.error(`❌ Failed to save fallback data: ${fallbackError.message}`);
        stats.errors++;
      }
    }
    
    //~ enrich data w extra metadata if have combined features
    if (stats.combinedFeatures > 0) {
      try {
        console.log('\n🔍 Enriching data with additional metadata...');
        
        //~ extract locations data fr enrichment
        const locationsToEnrich = [];
        combinedData.features.forEach(feature => {
          if (feature.geometry && feature.properties) {
            const location = {
              ...feature.properties,
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0]
            };
            locationsToEnrich.push(location);
          }
        });
        
        //~ perform enrichment
        const enrichedLocations = await enrichLocationData(locationsToEnrich);
        
        //~ convert back to geojson
        const enrichedGeoJSON = locationsToGeoJSON(enrichedLocations);
        stats.enrichedFeatures = enrichedGeoJSON.features.length;
        
        //~ save enriched data
        await fs.writeFile(ENRICHED_OUTPUT, JSON.stringify(enrichedGeoJSON, null, 2));
        console.log(`✅ Saved enriched GeoJSON with ${enrichedGeoJSON.features.length} features to ${ENRICHED_OUTPUT}`);
        
        //~ replace combined data w enriched version fr app to use
        await fs.copyFile(ENRICHED_OUTPUT, COMBINED_OUTPUT);
        console.log(`✅ Updated combined.geojson with enriched data`);
      } catch (error) {
        console.error(`❌ Error enriching data: ${error.message}`);
        stats.errors++;
        stats.warnings++;
      }
    }
    
    //~ data validation check
    if (stats.combinedFeatures === 0) {
      console.warn('⚠️ WARNING: No features in combined data - application may not work correctly');
      stats.warnings++;
    }
    
    //~ output final stats
    const elapsedTime = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    console.log(`\n📈 Data sync completed in ${elapsedTime}s with:`);
    console.log(`   - ${stats.sheetsLocations} locations from Google Sheets`);
    console.log(`   - ${stats.mapsFeatures} features from Google My Maps`);
    console.log(`   - ${stats.combinedFeatures} combined features`);
    console.log(`   - ${stats.enrichedFeatures} enriched features`);
    console.log(`   - ${stats.warnings} warnings, ${stats.errors} errors`);
    
    //~ exit w error code if errs encountered
    if (stats.errors > 0) {
      console.error('\n⚠️ Data sync completed with errors - data may be incomplete');
      process.exit(stats.combinedFeatures > 0 ? 0 : 1); //~ only exit w err if no data
    } else {
      console.log('\n✅ Data sync completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Fatal error syncing data:', error);
    process.exit(1);
  }
}

fetchData();
