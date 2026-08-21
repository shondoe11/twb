#!/usr/bin/env node

//* script fr fetching data frm multiple Google Sheets & combining w/ maps data
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& define data source config directly
const DATA_SOURCES = {
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
};

//& define URLs
DATA_SOURCES.SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/${DATA_SOURCES.GOOGLE_SHEETS_ID}/export?format=csv`;
DATA_SOURCES.ALL_SHEETS_CSV_URLS = DATA_SOURCES.SHEET_TABS.map(tab =>
  `https://docs.google.com/spreadsheets/d/${DATA_SOURCES.GOOGLE_SHEETS_ID}/export?format=csv&gid=${tab.gid}`
);
DATA_SOURCES.MAPS_KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${DATA_SOURCES.GOOGLE_MAPS_ID}`;

//& paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const MAPS_CACHE = path.join(CACHE_DIR, 'maps.json');
const SHEETS_CACHE = path.join(CACHE_DIR, 'sheets.json');
const COMBINED_OUTPUT = path.join(DATA_DIR, 'combined.geojson');
const GEOCODE_CACHE = path.join(CACHE_DIR, 'geocode.json');

//& ensure directories exist
async function setupDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('Directories created successfully');
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

//& fetch data frm Google Sheets using CSV export URLs
async function fetchAllSheetsData() {
  console.log('Fetching data from online Google Sheets');

  try {
    //~ check fr cached sheets data that nt too old
    try {
      const cacheStats = await fs.stat(SHEETS_CACHE);
      const cacheAge = Date.now() - cacheStats.mtime;
      //~ use cache if less than 1h old
      if (cacheAge < 3600000) {
        console.log(`Using cached sheets data (${Math.round(cacheAge / 60000)} minutes old)`);
        const cachedData = JSON.parse(await fs.readFile(SHEETS_CACHE, 'utf8'));
        console.log(`Loaded ${cachedData.length} records from cache`);
        return cachedData;
      }
      console.log('Sheets cache is too old, fetching fresh data...');
    } catch {
      console.log('No valid sheets cache found, fetching fresh data...');
    }

    //~ fetch each sheet tab & process
    const allRecords = [];

    for (const tab of DATA_SOURCES.SHEET_TABS) {
      console.log(`Fetching sheet: ${tab.name} (gid: ${tab.gid})`);

      const url = `https://docs.google.com/spreadsheets/d/${DATA_SOURCES.GOOGLE_SHEETS_ID}/export?format=csv&gid=${tab.gid}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TWB-DataFetcher/1.0)'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch sheet ${tab.name}: ${response.status} ${response.statusText}`);
        continue;
      }

      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) {
        console.error(`Empty CSV response for sheet ${tab.name}`);
        continue;
      }

      //~ parse CSV content. determine correct header row based on sheet tab
      const fromLine = tab.name === 'HOTEL ROOMS W BIDET' ? 2 : 1; //~ 0-indexed
      console.log(`Using header row ${fromLine + 1} for sheet "${tab.name}"`);

      const records = parse(csvText, {
        columns: true,
        from_line: fromLine + 1, //~ csv-parse uses 1-indexed line nums
        skip_empty_lines: true,
        trim: true
      });

      //~ add src tab info to each record
      const recordsWithSource = records.map(record => ({
        ...record,
        _sourceTab: tab.name
      }));

      console.log(`Fetched ${recordsWithSource.length} records from sheet "${tab.name}"`);

      //~ display column headers frm 1st record if avail
      if (recordsWithSource.length > 0) {
        console.log(`Columns found in "${tab.name}": ${Object.keys(recordsWithSource[0]).join(', ')}`);
      }

      allRecords.push(...recordsWithSource);
    }

    //~ cache data
    await fs.writeFile(SHEETS_CACHE, JSON.stringify(allRecords, null, 2));
    console.log(`Cached ${allRecords.length} records to ${SHEETS_CACHE}`);

    console.log(`Total fetched records from all sheets: ${allRecords.length}`);
    return allRecords;

  } catch (error) {
    console.error('Error fetching sheets data:', error);
    console.error('Falling back to empty data set');
    return [];
  }
}

//& convert sheets records to GeoJSON
function sheetsToGeoJSON(records) {
  console.log('Converting sheets data to GeoJSON');

  //~ filter out empty records & print debugging info
  records = records.filter(record => {
    const keys = Object.keys(record).filter(k => k !== '_sourceTab');
    return keys.length > 0 && keys.some(k => record[k] && record[k].trim() !== '');
  });

  console.log(`After filtering empty records: ${records.length} records remain`);

  //~ show sample records frm each sheet
  const tabs = [...new Set(records.map(r => r._sourceTab))];
  tabs.forEach(tab => {
    const tabRecords = records.filter(r => r._sourceTab === tab);
    if (tabRecords.length > 0) {
      console.log(`Sheet "${tab}" (${tabRecords.length} records) sample columns:`,
        Object.keys(tabRecords[0]).filter(k => k !== '_sourceTab').join(', '));

      //~ show 1st record as sample
      if (tabRecords.length > 0) {
        const sample = tabRecords[0];
        console.log(`Sample data from ${tab}:`, JSON.stringify(sample, null, 2));
      }
    }
  });

  //~ process records frm each sheet
  const processedRecords = [];

  //~ region column only filled on 1st row of each visual group in the sheet - forward-fill it so grouped rows inherit their group's region (faithful to source semantics)
  const lastRegionByTab = {};

  records.forEach(record => {
    //~ skip records w/o proper data
    if (!record || Object.keys(record).filter(k => k !== '_sourceTab').length === 0) return;

    const tab = record._sourceTab;
    let processed = { _sourceTab: tab };

    //~ process based sheet tab struct
    if (tab === 'MALE TOILETS' || tab === 'FEMALE TOILETS') {
      processed.Name = record['Location'] || '';
      //~ make sure getting correct Address column
      processed.Address = record['Address'] || '';
      processed.Notes = record['Remarks'] || '';
      const rawRegion = (record['Region'] || '').trim();
      if (rawRegion) {
        lastRegionByTab[tab] = rawRegion;
      }
      processed.Region = rawRegion || lastRegionByTab[tab] || '';
      //~ check FEMALE before MALE - 'FEMALE TOILETS'.includes('MALE') is true, so male check must come last
      processed.Type = tab.includes('FEMALE') ? 'female' : tab.includes('MALE') ? 'male' : 'other';

      //? debug actual record content fr address
      console.log(`Processing ${tab} record: ${processed.Name} | Address from sheet: "${processed.Address}"`);
    } else if (tab === 'HOTEL ROOMS W BIDET') {
      processed.Name = record['Hotel'] || '';
      //~ confirm Location column contains address fr hotels
      processed.Address = record['Location'] || '';
      processed.Notes = record['Room Name w bidet (if applicable)'] || '';
      processed.Type = 'hotel';

      //? debug actual record content fr address
      console.log(`Processing ${tab} record: ${processed.Name} | Address from sheet: "${processed.Address}"`);
    }

    //~ ensure all fields are strings & nt empty
    Object.keys(processed).forEach(key => {
      processed[key] = String(processed[key] || '');
    });

    //~ keep any row w a name - address-less rows now get coords via kml name-match / onemap geocode
    if (processed.Name && processed.Name.trim() !== '') {
      processedRecords.push(processed);
    }
  });

  console.log(`After processing: ${processedRecords.length} valid records with a name`);

  //& deterministic IDs based on name & address
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; //~ convert 32bit int
    }
    return hash;
  }

  //~ convert GeoJSON feats
  const features = processedRecords.map(record => {
    const name = record.Name.trim();
    const address = record.Address.trim();
    const sourceTab = record._sourceTab;
    //~ check FEMALE before MALE - 'FEMALE'.includes('MALE') is true, so male check must come last
    const gender = sourceTab.includes('FEMALE') ? 'female' :
      sourceTab.includes('MALE') ? 'male' : 'any';
    const type = record.Type || (sourceTab.includes('HOTEL') ? 'hotel' : 'public');

    //~ create deterministic id
    const idBase = `${name}${address}`;
    const id = `sheets-${Math.abs(hashCode(idBase)).toString(16).substring(0, 8)}`;

    //? debug logging
    console.log(`Processing: ${name} (${address?.substring(0, 30)}${address?.length > 30 ? '...' : ''})`);

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        //~ no placeholder coords - null until real coords r matched frm google maps,
        //~ unmatched features should get dropped instead of appearing at random spots
        coordinates: null
      },
      properties: {
        id,
        name,
        address,
        region: record.Region || 'Unknown',
        type,
        gender,
        hasBidet: true,
        source: 'google-sheets',
        sourceTab,
        remarks: record.Notes || '',
        sourceComments: {
          sheets: record.Notes && record.Notes.trim() !== '' ? [record.Notes] : [],
          maps: []
        }
      }
    };
  });

  console.log(`Created ${features.length} GeoJSON features from sheets data`);
  return features;
}

//& extract address frm description using multiple patterns
function extractAddressFromDescription(description) {
  if (!description) return null;

  //~ handle CDATA if already processed earlier
  const cleanDesc = description;

  //~ try various patterns to extract address - loose catch-all patterns removed - they turned arbitrary description text ('unisex toilet') into fake addresses
  const patterns = [
    /Address:\s*(.*?)(?:<br>|$)/i,
    /Location:\s*(.*?)(?:<br>|$)/i,
    /(\d+[\w\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|lane|ln|drive|dr|terrace|ter|place|pl|court|ct)[,\s]+\w+)/i
  ];

  for (const pattern of patterns) {
    const match = cleanDesc.match(pattern);
    if (match && match[1]) {
      console.log(`Successfully extracted address using pattern: ${pattern}`);
      return match[1].trim();
    }
  }

  console.log(`Failed to extract address from description: "${description.substring(0, 100)}..."`);
  return null;
}

//& fetch Google Maps KML data & cache it
async function fetchMapsData() {
  //~ ensure hav correct coords
  const forceRefresh = true;

  try {
    //~ check if cache exists & is fresh (less than 1d old)
    if (!forceRefresh) {
      try {
        const stats = await fs.stat(MAPS_CACHE);
        const cacheAge = Date.now() - stats.mtimeMs;

        if (cacheAge < 24 * 60 * 60 * 1000) {
          console.log('Using cached maps data');
          const cachedData = JSON.parse(await fs.readFile(MAPS_CACHE, 'utf8'));
          console.log(`Cached maps data has ${cachedData.features?.length || 0} features`);
          if (cachedData.features?.length > 0) {
            return cachedData;
          } else {
            console.log('Cached maps data has 0 features, fetching fresh data');
          }
        }
      } catch (error) {
        console.log('Maps cache access error:', error.message);
        //~ cache doesn't exist or is invalid - proceed to fetch
      }
    } else {
      console.log('Forced refresh of maps data enabled');
    }

    console.log('Fetching data from Google Maps');
    const response = await fetch(DATA_SOURCES.MAPS_KML_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const kmlText = await response.text();
    console.log(`KML data fetched successfully (${kmlText.length} bytes)`);

    //~ parse KML (simple regex approach - could use xml parser for more robust solution)
    const placemarks = [];
    const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    let match;

    //~ google my maps wraps <name>/<description> values in cdata - strip it here so raw '<![CDATA[...]]>' never leaks into output
    const stripCdata = (text) => {
      if (!text) return '';
      const cdataMatch = /<!\[CDATA\[([\s\S]*?)\]\]>/i.exec(text);
      return (cdataMatch ? cdataMatch[1] : text).trim();
    };

    //? debugging: 1st part of KML-> see tag structure
    const kmlPreview = kmlText.substring(0, 500);
    console.log(`\ud83d\udcd1 KML preview: ${kmlPreview}`);

    while ((match = regex.exec(kmlText)) !== null) {
      const placemark = match[1];

      //~ extract name - try both <name> & <n> tags -> ensure get all names
      let name = '';
      const nameMatch = /<name>(.*?)<\/name>/i.exec(placemark);
      const nMatch = /<n>(.*?)<\/n>/i.exec(placemark);

      if (nameMatch) {
        name = stripCdata(nameMatch[1]);
        console.log(`Found <name> tag: ${name}`);
      } else if (nMatch) {
        name = stripCdata(nMatch[1]);
        console.log(`Found <n> tag: ${name}`);
      } else {
        console.log('No name found in placemark');
      }

      //~ extract description (CDATA alr stripped)
      const descMatch = /<description>(.*?)<\/description>/i.exec(placemark);
      const description = stripCdata(descMatch ? descMatch[1] : '');

      //~ extract coords
      const coordsMatch = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(placemark);

      if (coordsMatch) {
        const coordsStr = coordsMatch[1].trim();
        console.log(`Found coordinates string: "${coordsStr}" for ${name}`);

        //~ KML format is lon,lat,altitude w possible whitespace
        const coords = coordsStr.split(',').map(s => s.trim()).map(Number);
        const lng = coords[0];
        const lat = coords[1];

        if (!isNaN(lat) && !isNaN(lng)) {
          placemarks.push({ name, description, lat, lng });
          console.log(`Added placemark: ${name} at [${lat}, ${lng}]`);
        } else {
          console.log(`Invalid coordinates for ${name}: ${coordsStr}`);
        }
      } else {
        console.log(`No coordinates found for placemark: ${name}`);
      }
    }

    console.log(`Extracted ${placemarks.length} placemarks from KML`);

    //~ regex extract folder/region name - try both <name> and <n> tags
    const folderRegex = /<Folder>[\s\S]*?<(name|n)>(.*?)<\/(name|n)>([\s\S]*?)<\/Folder>/g;

    while ((match = folderRegex.exec(kmlText)) !== null) {
      const regionName = stripCdata(match[2]);
      const folderContent = match[4];
      const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
      let placemarkMatch;

      while ((placemarkMatch = placemarkRegex.exec(folderContent)) !== null) {
        //~ use proper tag pattern for this KML format - try both <name> and <n> tags
        const nameMatch = /<(name|n)>(.*?)<\/(name|n)>/i.exec(placemarkMatch[1]);
        if (nameMatch) {
          const name = stripCdata(nameMatch[2]);
          for (const placemark of placemarks) {
            if (placemark.name === name) {
              placemark.region = regionName;
            }
          }
        }
      }
    }
    //~ convert to GeoJSON w proper name
    const features = placemarks.map(placemark => {
      //~ ensure placemark name trimmed & non-empty
      const nameValue = placemark.name?.trim() || '';

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [placemark.lng, placemark.lat]
        },
        properties: {
          id: `maps-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: nameValue,
          Name: nameValue,
          description: placemark.description,
          Female: placemark.description && placemark.description.includes('Female:') ?
            placemark.description.match(/Female:\s*([^,\n]+)/i)?.[1] || 'Yes' :
            placemark.description && placemark.description.includes('female') ? 'Yes' : null,
          Male: placemark.description && placemark.description.includes('Male:') ?
            placemark.description.match(/Male:\s*([^,\n]+)/i)?.[1] || 'Yes' :
            placemark.description && placemark.description.includes('male') ? 'Yes' : null,
          Handicap: placemark.description && placemark.description.includes('Handicap:') ?
            placemark.description.match(/Handicap:\s*([^,\n]+)/i)?.[1] || 'Yes' :
            placemark.description && placemark.description.includes('handicap') ? 'Yes' : null,
          Address: extractAddressFromDescription(placemark.description),
          region: placemark.region || 'Unknown',
          source: 'google-maps'
        }
      };
    });

    //~ cache result
    const geojson = {
      type: 'FeatureCollection',
      features
    };

    await fs.writeFile(MAPS_CACHE, JSON.stringify(geojson));
    console.log(`Cached maps data (${features.length} features)`);

    return geojson;
  } catch (mapFetchError) {
    console.error('Error fetching Google Maps data:', mapFetchError);
    //~ try to use cache if available
    try {
      console.log('Attempting to use cached maps data as fallback');
      const cachedData = JSON.parse(await fs.readFile(MAPS_CACHE, 'utf8'));
      return cachedData;
    } catch {
      console.error('Fallback failed, returning empty collection');
      return { type: 'FeatureCollection', features: [] };
    }
  }
}

//& now using onemap sg geocoding - official free geocoder, no api key needed fr search endpoints
let geocodeCache = {};
let geocodeCacheDirty = false;

async function loadGeocodeCache() {
  try {
    geocodeCache = JSON.parse(await fs.readFile(GEOCODE_CACHE, 'utf8'));
    console.log(`Loaded ${Object.keys(geocodeCache).length} cached geocode results`);
  } catch {
    geocodeCache = {};
  }
}

async function saveGeocodeCache() {
  if (!geocodeCacheDirty) return;
  await fs.writeFile(GEOCODE_CACHE, JSON.stringify(geocodeCache, null, 2));
  console.log(`Saved ${Object.keys(geocodeCache).length} geocode results to cache`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

//& query onemap search api fr a single search string -> [lng, lat] / null
async function geocodeQuery(query) {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (key in geocodeCache) return geocodeCache[key];

  //~ onemap's anonymous rate limit is aggressive - retry 429s w backoff & only cache genuine "no results"
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'TWB-DataFetcher/1.0' } });

      if (response.status === 429) {
        const waitMs = 5000 * attempt;
        console.warn(`OneMap rate limited (429) for "${query}" - retrying in ${waitMs / 1000}s (attempt ${attempt}/${maxAttempts})`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        //~ transient server error - dont cache, so next sync retries it
        console.warn(`OneMap responded ${response.status} for "${query}" - not caching, will retry next sync`);
        await sleep(1000);
        return null;
      }

      const data = await response.json();
      const hit = data?.results?.[0];
      let result = null;
      if (hit) {
        const lat = parseFloat(hit.LATITUDE);
        const lng = parseFloat(hit.LONGITUDE);
        //~ sanity: results must land inside sg bounds - anything else is a bad hit, nt a real location
        if (!isNaN(lat) && !isNaN(lng) && lat >= 1.15 && lat <= 1.5 && lng >= 103.5 && lng <= 104.15) {
          result = [lng, lat];
        }
      }

      //~ only genuine lookups (success / no results) get cached - never transient failures
      geocodeCache[key] = result;
      geocodeCacheDirty = true;
      await sleep(1000); //~ anonymous access 429s well below the documented 250 req/min - 1s spacing is reliable
      return result;
    } catch (error) {
      console.warn(`OneMap request failed for "${query}": ${error.message} (attempt ${attempt}/${maxAttempts})`);
      await sleep(2000 * attempt);
    }
  }

  console.warn(`OneMap gave up on "${query}" after ${maxAttempts} attempts - not caching, will retry next sync`);
  return null;
}

//& simplifying messy sheet addresses to clean 'block street' query onemap can resolve
//~ handles unit numbers, level refs, block ranges (28-30 -> 28), slashed suffixes (76A/B -> 76A) & abbreviations
function simplifyAddress(address) {
  if (!address || !address.trim()) return '';
  let cleaned = address
    .replace(/#\s*\d+(-\d+)?/g, '')
    .replace(/\b(level|lvl)\s*\d+\b/gi, '')
    .replace(/\bsingapore\b\s*\d*/gi, '')
    .replace(/\b(\d{4,6})\b\s*$/g, '')
    .replace(/\b(\d+[A-Za-z]?)\/[A-Za-z]\b/g, '$1')
    .replace(/\b(\d+[A-Za-z]?)\s*-\s*\d+[A-Za-z]?\b/g, '$1');

  const abbreviations = {
    rd: 'Road', ave: 'Avenue', st: 'Street', blvd: 'Boulevard',
    cres: 'Crescent', ln: 'Lane', hwy: 'Highway', jln: 'Jalan',
    lor: 'Lorong', tg: 'Tanjong', bt: 'Bukit', upp: 'Upper',
    ecp: 'East Coast Parkway',
  };
  cleaned = cleaned.replace(/\b([a-z]+)\b\.?/gi, (match, word) => abbreviations[word.toLowerCase()] || match);

  //~ keep 1st comma-segment that looks like 'number street' - drop trailing clutter
  const segment = cleaned.split(',').map(s => s.trim()).find(s => /^\d+[A-Za-z]?\s+\D/.test(s));
  return (segment || cleaned.split(',')[0] || '').replace(/\s{2,}/g, ' ').trim();
}

//& geocode a location: postal code first (most precise), then full address, then simplified address, then name, then street-only
async function geocodeLocation(name, address) {
  const postal = (address || '').match(/\b(\d{6})\b/);
  if (postal) {
    const coords = await geocodeQuery(postal[1]);
    if (coords) return coords;
  }
  if (address && address.trim()) {
    const coords = await geocodeQuery(address);
    if (coords) return coords;
  }
  const simplified = simplifyAddress(address);
  if (simplified && simplified !== (address || '').trim()) {
    const coords = await geocodeQuery(simplified);
    if (coords) return coords;
  }
  if (name && name.trim()) {
    const coords = await geocodeQuery(name);
    if (coords) return coords;
  }
  //~ last resort: street name alone (block number stripped) - street-level accuracy beats dropping the row
  const streetOnly = simplified.replace(/^\d+[A-Za-z]?\s+/, '').trim();
  if (streetOnly && streetOnly !== simplified) {
    const coords = await geocodeQuery(streetOnly);
    if (coords) {
      console.warn(`Geocoded "${name}" via street-only fallback ("${streetOnly}") - street-level accuracy`);
      return coords;
    }
  }
  return null;
}

//& normalize region casing ('NORTH-EAST' -> 'North-East') so filters don't split on case
function normalizeRegionName(region) {
  if (!region || typeof region !== 'string') return '';
  const trimmed = region.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return '';
  return trimmed
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

//& deterministic region classification frm real coords (approx ura planning regions) - only used whn src sheet/kml provides no region - derived, no fabrication
function regionFromCoords(lng, lat) {
  if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return '';
  if (lng >= 103.93 && lat <= 1.39) return 'East';
  if (lat >= 1.36 && lng >= 103.84) return 'North-East';
  if (lat >= 1.4) return 'North';
  if (lng <= 103.77) return 'West';
  return 'Central';
}

//& combine sheets & maps data to single GeoJSON
async function combineData() {
  await loadGeocodeCache();
  //~ fetch all data srcs
  const sheetsRecords = await fetchAllSheetsData();

  //~ fail loudly instead of silently publishing an empty/degraded dataset - a non-zero exit fails the ci run & the vercel build, keeping the previous deployment live
  if (!sheetsRecords || sheetsRecords.length === 0) {
    console.error('No sheets records fetched - aborting so stale data is not overwritten');
    process.exit(1);
  }

  await fs.writeFile(SHEETS_CACHE, JSON.stringify(sheetsRecords));
  console.log('Cached sheets data');

  const sheetsFeatures = sheetsToGeoJSON(sheetsRecords);
  const mapsData = await fetchMapsData();
  const mapsFeatures = mapsData.features || [];

  //? debug Google Maps data
  console.log(`Extracting Google Maps features for matching: ${mapsFeatures.length} features`);

  //? debug sample feats
  for (let i = 0; i < Math.min(3, mapsFeatures.length); i++) {
    const feature = mapsFeatures[i];
    console.log(`Maps Feature ${i + 1} Sample:`);
    console.log(`   Name: ${JSON.stringify(feature.properties?.Name || feature.properties?.name)}`);
    console.log(`   Coords: ${JSON.stringify(feature.geometry?.coordinates)}`);
    console.log(`   Properties: ${Object.keys(feature.properties || {}).join(', ')}`);
  }

  //~ comprehensive mapping location names to coords frm Google Maps data
  const mapsCoordinatesMap = {};

  mapsFeatures.forEach(feature => {
    if (feature.properties && feature.geometry?.coordinates?.length === 2) {
      //
      //~ extract name frm properties (try both Name and name props)
      const name = feature.properties.Name || feature.properties.name || '';

      if (name && typeof name === 'string' && name.trim() !== '') {
        const trimmedName = name.trim();
        const coords = feature.geometry.coordinates;

        //~ store using multiple variations of name fr better matching
        //~ 1. original name as-is
        mapsCoordinatesMap[trimmedName] = coords;

        //~ 2. lowercase ver
        const lowerName = trimmedName.toLowerCase();
        if (lowerName !== trimmedName) {
          mapsCoordinatesMap[lowerName] = coords;
        }

        //~ 3. simplified name (no parenthetical content)
        const simplifiedName = trimmedName.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (simplifiedName !== trimmedName && simplifiedName.length > 3) {
          mapsCoordinatesMap[simplifiedName] = coords;
          mapsCoordinatesMap[simplifiedName.toLowerCase()] = coords;
        }

        //~ 4. ultra normalized (no special chars, spaces, lowercase)
        const normalizedName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedName.length > 3) { //~ only if meaningful
          mapsCoordinatesMap[normalizedName] = coords;
        }

        //? debug output fr first few entries
        if (Object.keys(mapsCoordinatesMap).length < 10) {
          console.log(`Adding coordinates mapping for "${trimmedName}": [${coords}]`);
        }
      }
    }
  });

  console.log(`Created coordinates mapping for ${Object.keys(mapsCoordinatesMap).length} name variants from ${mapsFeatures.length} Google Maps locations`);

  //? debug Google Sheets feats
  for (let i = 0; i < Math.min(3, sheetsFeatures.length); i++) {
    const feature = sheetsFeatures[i];
    console.log(`Sheets Feature ${i + 1} Sample:`);
    console.log(`   Name: ${feature.properties?.name || 'Not found'}`);
    console.log(`   Address: ${feature.properties?.address || 'Not found'}`);
    console.log(`   Properties: ${Object.keys(feature.properties || {}).join(', ')}`);
  }

  //~ enhance Google Sheets feats w coords frm Google Maps using name matching
  let enhancedCount = 0;
  let droppedCount = 0;
  //~ apply maps coords to sheets data if matched - create enhanced features array
  const matchedSheetsFeatures = sheetsFeatures.map(feature => {
    if (!feature.properties?.name) {
      return feature;
    }

    const name = feature.properties.name.trim();
    console.log(`Processing: ${name}`);

    //~ try multiple matching strats
    let coords = null;

    //~ 1. direct exact match
    if (mapsCoordinatesMap[name]) {
      coords = mapsCoordinatesMap[name];
      console.log(`Found exact match for "${name}": [${coords}]`);
      enhancedCount++;
    }
    //~ 2. lowercase match
    else if (mapsCoordinatesMap[name.toLowerCase()]) {
      coords = mapsCoordinatesMap[name.toLowerCase()];
      console.log(`Found lowercase match for "${name}": [${coords}]`);
      enhancedCount++;
    }
    //~ 3. simplified match (no parentheses)
    else {
      const simpleName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (simpleName !== name && mapsCoordinatesMap[simpleName]) {
        coords = mapsCoordinatesMap[simpleName];
        console.log(`Found simplified match for "${name}": [${coords}]`);
        enhancedCount++;
      }
      //~ 4. ultra normalized match
      else {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedName.length > 3 && mapsCoordinatesMap[normalizedName]) {
          coords = mapsCoordinatesMap[normalizedName];
          console.log(`Found normalized match for "${name}": [${coords}]`);
          enhancedCount++;
        }

        else {
          console.log(`No KML name match for "${name}" - will attempt OneMap geocode`);
        }
      }
    }

    //~ replace feature coords w matched coords frm the community's own map pins
    if (coords) {
      return {
        ...feature,
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    }

    return feature;
  });

  //~ geocode features w/o a kml pin via onemap (official sg geocoder) - real coords, no fabrication
  let geocodedCount = 0;
  for (const feature of matchedSheetsFeatures) {
    if (feature.geometry?.coordinates?.length === 2) continue;
    const { name, address } = feature.properties;
    const coords = await geocodeLocation(name, address);
    if (coords) {
      feature.geometry = { type: 'Point', coordinates: coords };
      feature.properties.coordsSource = 'onemap-geocode';
      geocodedCount++;
    } else {
      console.warn(`Geocoding failed for "${name}" - excluding from output rather than fabricating coords`);
      droppedCount++;
    }
  }
  await saveGeocodeCache();

  //~ drop only features whose coords genuinely could nt be resolved anywhere
  const enhancedSheetsFeatures = matchedSheetsFeatures.filter(feature => feature.geometry?.coordinates?.length === 2);

  console.log(`Coords resolved: ${enhancedCount} frm KML name-match, ${geocodedCount} frm OneMap geocode, ${droppedCount} dropped as unresolvable`);

  //& normalize hotel name: rm common prefixes/suffixes & cleaning
  function normalizeLocationName(name) {
    if (!name || typeof name !== 'string') return '';
    
    //~ convert lowercase
    let normalized = name.toLowerCase();
    
    //~ rm common hotel prefixes
    const prefixes = ['hotel', 'the', 'the hotel', 'ibis', 'holiday inn', 'hotel ibis', 'hotel holiday inn'];
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.slice(prefix.length).trim();
      }
    }
    
    //~ rm parenthetical content
    normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ');
    
    //~ replace common separator phrases
    normalized = normalized.replace(/\s+by\s+/g, ' ');
    normalized = normalized.replace(/\s+at\s+/g, ' ');
    normalized = normalized.replace(/\s+[&-]\s+/g, ' ');
    
    //~ Remove all punctuation and extra spaces
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }
  
  //~ nameSimilarity char-bag metric removed - counting shared characters made almost any 2 names
  //~ 'similar' & was the root cause of the fabricated coordinate merges

  console.log('Merging Google Sheets and Google Maps data with improved name matching...');
  
  const mapsByCoords = {};
  const mapsByName = {};
  const mapsByNormalizedName = {};
  const mapsKeys = new Set(); //~ track which maps features added
  
  //~ prep all lookup tables fr maps features
  mapsFeatures.forEach(feature => {
    const fProps = feature.properties;
    const mapName = fProps.name || fProps.Name || '';
    
    //~ skip features w no useful name
    if (!mapName || mapName.length < 2) return;
    
    //~ generate unique key fr this feature
    let mapKey;
    if (feature.geometry?.coordinates?.length === 2) {
      mapKey = feature.geometry.coordinates.join(',');
      mapsByCoords[mapKey] = feature;
    } else {
      mapKey = `map-${mapName}`;
    }
    
    //~ store by original name
    mapsByName[mapName.toLowerCase()] = feature;
    
    //~ store by normalized name
    const normalizedName = normalizeLocationName(mapName);
    if (normalizedName && normalizedName !== mapName.toLowerCase()) {
      mapsByNormalizedName[normalizedName] = feature;
    }
  });
  
  //~ 2. create unified feature collection w best data frm each source
  const mergedFeatures = [];
  
  //~ first process all sheet features & try match w map features
  enhancedSheetsFeatures.forEach(sheetFeature => {
    const sheetProps = sheetFeature.properties;
    const sheetName = sheetProps.name || sheetProps.Name || '';
    
    if (!sheetName || sheetName.length < 2) {
      console.log(`Skipping sheet feature w no name`);
      return;
    }
    
    //~ track all match attempts fr debugging
    const matchAttempts = {};
    
    //~ match strategy 1: try match by coords (most reliable)
    let matchedMapFeature = null;
    let matchType = null;
    let matchConfidence = 0;
    
    const sheetCoords = sheetFeature.geometry?.coordinates;
    if (sheetCoords?.length === 2) {
      const coordKey = sheetCoords.join(',');
      if (mapsByCoords[coordKey]) {
        matchedMapFeature = mapsByCoords[coordKey];
        matchType = 'coordinates';
        matchConfidence = 1.0;
        matchAttempts.coordinates = 'Match by coordinates';
      } else {
        matchAttempts.coordinates = 'No coordinate match';
      }
    }
    
    //~ match strategy 2: try exact name match
    if (!matchedMapFeature) {
      const nameLower = sheetName.toLowerCase();
      if (mapsByName[nameLower]) {
        matchedMapFeature = mapsByName[nameLower];
        matchType = 'exact-name';
        matchConfidence = 1.0;
        matchAttempts.exactName = 'Match by exact name';
      } else {
        matchAttempts.exactName = 'No exact name match';
      }
    }
    
    //~ match strategy 3: try normalized name match
    if (!matchedMapFeature) {
      const normalizedName = normalizeLocationName(sheetName);
      if (normalizedName && mapsByNormalizedName[normalizedName]) {
        matchedMapFeature = mapsByNormalizedName[normalizedName];
        matchType = 'normalized-name';
        matchConfidence = 0.9;
        matchAttempts.normalizedName = 'Match by normalized name';
      } else {
        matchAttempts.normalizedName = 'No normalized name match';
      }
    }
    
    //~ unmatched features keep their kml-matched / onemap-geocoded coords instead of prev fuzzy char-bag matching
    
    //~ match found, create merged feature w best frm both srcs
    if (matchedMapFeature) {
      const mapProps = matchedMapFeature.properties;
      const mapKey = matchedMapFeature.geometry?.coordinates?.join(',') || `map-${mapProps.name || mapProps.Name || ''}`;
      mapsKeys.add(mapKey); //~ mark as used
      
      //~ prefer the community's own kml pin geometry, fall back to the sheet's geocoded coords
      const mergedFeature = {
        type: 'Feature',
        geometry: matchedMapFeature.geometry || sheetFeature.geometry,
        properties: {
          ...sheetProps,
          region: mapProps.region && mapProps.region !== 'Unknown' ? mapProps.region : (sheetProps.region || 'Unknown'),
          ...Object.keys(mapProps)
            .filter(k => !['name', 'Name', 'address', 'Address', 'id', 'source'].includes(k) && 
                      !sheetProps.hasOwnProperty(k))
            .reduce((acc, k) => {
              acc[k] = mapProps[k];
              return acc;
            }, {}),
          source: 'merged',
          matchType,
          matchConfidence
        }
      };
      
      console.log(`Merged: "${sheetName}" (${matchType}, confidence: ${matchConfidence.toFixed(2)})`);
      mergedFeatures.push(mergedFeature);
    } else {
      //~ no match found, use sheet feature as-is
      console.log(`ℹ️ No match found for: "${sheetName}". Attempts: ${Object.values(matchAttempts).join(', ')}`);
      mergedFeatures.push(sheetFeature);
    }
  });
  
  //~ add any maps features that weren't matched w sheets data
  let unmatchedMapFeatures = 0;
  mapsFeatures.forEach(mapFeature => {
    const mapProps = mapFeature.properties;
    const mapName = mapProps.name || mapProps.Name || '';
    const mapKey = mapFeature.geometry?.coordinates?.join(',') || `map-${mapName}`;
    
    if (!mapsKeys.has(mapKey)) {
      mergedFeatures.push(mapFeature);
      unmatchedMapFeatures++;
    }
  });
  
  //~ report stats on merging results
  console.log(`Merged data statistics:`);
  console.log(`Total features after merging: ${mergedFeatures.length}`);
  console.log(`Original Google Sheets features: ${sheetsFeatures.length}`);
  console.log(`Original Google Maps features: ${mapsFeatures.length}`);
  console.log(`Unmatched Maps features added: ${unmatchedMapFeatures}`);
  console.log(`Duplicates eliminated: ${sheetsFeatures.length + mapsFeatures.length - mergedFeatures.length}`);

  //~ ensure property name consistency (address vs Address)
  mergedFeatures.forEach(feature => {
    const props = feature.properties;

    //~ make sure both address & Address are present
    if (props.address && !props.Address) {
      props.Address = props.address;
      console.log(`Normalized address property to Address for ${props.name || props.Name}`);
    } else if (props.Address && !props.address) {
      props.address = props.Address;
      console.log(`Normalized Address property to address for ${props.name || props.Name}`);
    }
    
    //~ preserve addresses even if match name but real addresses
    //~ (address w Singapore, postal code, / longer than 25 chars = likely legitimate)
    const nameStr = (props.name || props.Name || '').toLowerCase();
    let addrStr = (props.address || props.Address || '').toLowerCase();
    
    if (addrStr === nameStr && addrStr.length < 25 && 
        !addrStr.includes('singapore') && !/\d{5,}/.test(addrStr)) {
      //~ likely just name being used as address, so rm
      console.log(`Removing name-as-address for "${props.name || props.Name}"`); 
      props.address = '';
      props.Address = '';
    }

    //~ make sure both name & Name are present
    if (props.name && !props.Name) {
      props.Name = props.name;
    } else if (props.Name && !props.name) {
      props.name = props.Name;
    }

    //~ region: normalize casing frm the source ('NORTH-EAST' -> 'North-East'), & only whn the
    //~ source provides no region at all, derive it deterministically frm the real coords
    const normalizedRegion = normalizeRegionName(props.region);
    if (normalizedRegion) {
      props.region = normalizedRegion;
    } else {
      const [lng, lat] = feature.geometry?.coordinates || [];
      props.region = regionFromCoords(lng, lat) || 'Unknown';
    }
  });

  //~ validate & log address extraction stats
  const withAddress = mergedFeatures.filter(f => f.properties.Address || f.properties.address).length;
  const missingAddress = mergedFeatures.length - withAddress;
  console.log(`Address statistics: ${withAddress} features with address, ${missingAddress} features without address`);

  //~ write combined data to disk via defined constant
  await fs.writeFile(COMBINED_OUTPUT, JSON.stringify({ type: 'FeatureCollection', features: mergedFeatures }, null, 2));
  console.log(`Wrote combined data to ${COMBINED_OUTPUT}`);

  return { type: 'FeatureCollection', features: mergedFeatures };
}

//& main execution
async function main() {
  try {
    //~ check if forced refresh enabled
    const forceRefresh = process.argv.includes('--force-refresh');
    if (forceRefresh) {
      console.log('Forced refresh enabled - will fetch fresh data');
    }

    //~ ensure dirs exist bef processing
    await setupDirectories();

    //~ process & combine data
    await combineData();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message || error);
  process.exit(1);
});
