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

//& ensure directories exist
async function setupDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('✅ Directories created successfully');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
}

//& fetch data frm Google Sheets using CSV export URLs
async function fetchAllSheetsData() {
  console.log('🔄 Fetching data from online Google Sheets');

  try {
    //~ check fr cached sheets data that nt too old
    try {
      const cacheStats = await fs.stat(SHEETS_CACHE);
      const cacheAge = Date.now() - cacheStats.mtime;
      //~ use cache if less than 1h old
      if (cacheAge < 3600000) {
        console.log(`📋 Using cached sheets data (${Math.round(cacheAge / 60000)} minutes old)`);
        const cachedData = JSON.parse(await fs.readFile(SHEETS_CACHE, 'utf8'));
        console.log(`📊 Loaded ${cachedData.length} records from cache`);
        return cachedData;
      }
      console.log('🔄 Sheets cache is too old, fetching fresh data...');
    } catch {
      console.log('🔄 No valid sheets cache found, fetching fresh data...');
    }

    //~ fetch each sheet tab & process
    const allRecords = [];

    for (const tab of DATA_SOURCES.SHEET_TABS) {
      console.log(`📋 Fetching sheet: ${tab.name} (gid: ${tab.gid})`);

      const url = `https://docs.google.com/spreadsheets/d/${DATA_SOURCES.GOOGLE_SHEETS_ID}/export?format=csv&gid=${tab.gid}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TWB-DataFetcher/1.0)'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch sheet ${tab.name}: ${response.status} ${response.statusText}`);
        continue;
      }

      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) {
        console.error(`❌ Empty CSV response for sheet ${tab.name}`);
        continue;
      }

      //~ parse CSV content. determine correct header row based on sheet tab
      const fromLine = tab.name === 'HOTEL ROOMS W BIDET' ? 2 : 1; //~ 0-indexed
      console.log(`🔍 Using header row ${fromLine + 1} for sheet "${tab.name}"`);

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

      console.log(`📊 Fetched ${recordsWithSource.length} records from sheet "${tab.name}"`);

      //~ display column headers frm 1st record if avail
      if (recordsWithSource.length > 0) {
        console.log(`🗂️ Columns found in "${tab.name}": ${Object.keys(recordsWithSource[0]).join(', ')}`);
      }

      allRecords.push(...recordsWithSource);
    }

    //~ cache data
    await fs.writeFile(SHEETS_CACHE, JSON.stringify(allRecords, null, 2));
    console.log(`💾 Cached ${allRecords.length} records to ${SHEETS_CACHE}`);

    console.log(`📊 Total fetched records from all sheets: ${allRecords.length}`);
    return allRecords;

  } catch (error) {
    console.error('❌ Error fetching sheets data:', error);
    console.error('⚠️ Falling back to empty data set');
    return [];
  }
}

//& convert sheets records to GeoJSON
function sheetsToGeoJSON(records) {
  console.log('🔄 Converting sheets data to GeoJSON');

  //~ filter out empty records & print debugging info
  records = records.filter(record => {
    const keys = Object.keys(record).filter(k => k !== '_sourceTab');
    return keys.length > 0 && keys.some(k => record[k] && record[k].trim() !== '');
  });

  console.log(`📔 After filtering empty records: ${records.length} records remain`);

  //~ show sample records frm each sheet
  const tabs = [...new Set(records.map(r => r._sourceTab))];
  tabs.forEach(tab => {
    const tabRecords = records.filter(r => r._sourceTab === tab);
    if (tabRecords.length > 0) {
      console.log(`🗂️ Sheet "${tab}" (${tabRecords.length} records) sample columns:`,
        Object.keys(tabRecords[0]).filter(k => k !== '_sourceTab').join(', '));

      //~ show 1st record as sample
      if (tabRecords.length > 0) {
        const sample = tabRecords[0];
        console.log(`📝 Sample data from ${tab}:`, JSON.stringify(sample, null, 2));
      }
    }
  });

  //~ process records frm each sheet
  const processedRecords = [];

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
      processed.Region = record['Region'] || '';
      processed.Type = tab.includes('MALE') ? 'male' : tab.includes('FEMALE') ? 'female' : 'other';

      //? debug actual record content fr address
      console.log(`🧐 Processing ${tab} record: ${processed.Name} | Address from sheet: "${processed.Address}"`);
    } else if (tab === 'HOTEL ROOMS W BIDET') {
      processed.Name = record['Hotel'] || '';
      //~ confirm Location column contains address fr hotels
      processed.Address = record['Location'] || '';
      processed.Notes = record['Room Name w bidet (if applicable)'] || '';
      processed.Type = 'hotel';

      //? debug actual record content fr address
      console.log(`🧐 Processing ${tab} record: ${processed.Name} | Address from sheet: "${processed.Address}"`);
    }

    //~ ensure all fields are strings & nt empty
    Object.keys(processed).forEach(key => {
      processed[key] = String(processed[key] || '');
    });

    //~ only add records w/ both name & address
    if (processed.Name && processed.Address &&
      processed.Name.trim() !== '' &&
      processed.Address.trim() !== '') {
      processedRecords.push(processed);
    }
  });

  console.log(`📔 After processing: ${processedRecords.length} valid records with name and address`);

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
    const gender = sourceTab.includes('MALE') ? 'male' :
      sourceTab.includes('FEMALE') ? 'female' : 'any';
    const type = record.Type || (sourceTab.includes('HOTEL') ? 'hotel' : 'public');

    //~ create deterministic id
    const idBase = `${name}${address}`;
    const id = `sheets-${Math.abs(hashCode(idBase)).toString(16).substring(0, 8)}`;

    //? debug logging
    console.log(`📏 Processing: ${name} (${address?.substring(0, 30)}${address?.length > 30 ? '...' : ''})`);

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        //~ using placeholder coords fr sheets data
        coordinates: [103.8 + Math.random() * 0.2, 1.3 + Math.random() * 0.2]
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

  console.log(`✅ Created ${features.length} GeoJSON features from sheets data`);
  return features;
}

//& extract address frm description using multiple patterns
function extractAddressFromDescription(description) {
  if (!description) return null;

  //~ handle CDATA if already processed earlier
  const cleanDesc = description;

  //~ try various patterns to extract address
  const patterns = [
    /Address:\s*(.*?)(?:<br>|$)/i,
    /Location:\s*(.*?)(?:<br>|$)/i,
    /at\s*(.*?)(?:<br>|$)/i,
    /\d+[\w\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|lane|ln|drive|dr|terrace|ter|place|pl|court|ct)[,\s]+\w+/i,
    /(.*?)(?:,\s*Singapore|$)/i
  ];

  for (const pattern of patterns) {
    const match = cleanDesc.match(pattern);
    if (match && match[1]) {
      console.log(`🏠 Successfully extracted address using pattern: ${pattern}`);
      return match[1].trim();
    }
  }

  console.log(`⚠️ Failed to extract address from description: "${description.substring(0, 100)}..."`);
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
          console.log('📋 Using cached maps data');
          const cachedData = JSON.parse(await fs.readFile(MAPS_CACHE, 'utf8'));
          console.log(`📊 Cached maps data has ${cachedData.features?.length || 0} features`);
          if (cachedData.features?.length > 0) {
            return cachedData;
          } else {
            console.log('⚠️ Cached maps data has 0 features, fetching fresh data');
          }
        }
      } catch (error) {
        console.log('⚠️ Maps cache access error:', error.message);
        //~ cache doesn't exist or is invalid - proceed to fetch
      }
    } else {
      console.log('🔄 Forced refresh of maps data enabled');
    }

    console.log('🔄 Fetching data from Google Maps');
    const response = await fetch(DATA_SOURCES.MAPS_KML_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const kmlText = await response.text();
    console.log(`✅ KML data fetched successfully (${kmlText.length} bytes)`);

    //~ parse KML (simple regex approach - could use xml parser for more robust solution)
    const placemarks = [];
    const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    let match;

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
        name = nameMatch[1].trim();
        console.log(`📝 Found <name> tag: ${name}`);
      } else if (nMatch) {
        name = nMatch[1].trim();
        console.log(`📝 Found <n> tag: ${name}`);
      } else {
        console.log('⚠️ No name found in placemark');
      }

      //~ extract description
      const descMatch = /<description>(.*?)<\/description>/i.exec(placemark);
      let description = descMatch ? descMatch[1] : '';

      //~ extract CDATA content if present
      const cdataMatch = /<!\[CDATA\[(.*?)\]\]>/i.exec(description);
      if (cdataMatch) {
        description = cdataMatch[1];
        console.log('📄 Extracted CDATA content from description');
      }

      //~ extract coords
      const coordsMatch = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(placemark);

      if (coordsMatch) {
        const coordsStr = coordsMatch[1].trim();
        console.log(`🔍 Found coordinates string: "${coordsStr}" for ${name}`);

        //~ KML format is lon,lat,altitude w possible whitespace
        const coords = coordsStr.split(',').map(s => s.trim()).map(Number);
        const lng = coords[0];
        const lat = coords[1];

        if (!isNaN(lat) && !isNaN(lng)) {
          placemarks.push({ name, description, lat, lng });
          console.log(`✅ Added placemark: ${name} at [${lat}, ${lng}]`);
        } else {
          console.log(`❌ Invalid coordinates for ${name}: ${coordsStr}`);
        }
      } else {
        console.log(`❓ No coordinates found for placemark: ${name}`);
      }
    }

    console.log(`📊 Extracted ${placemarks.length} placemarks from KML`);

    //~ regex extract folder/region name - try both <name> and <n> tags
    const folderRegex = /<Folder>[\s\S]*?<(name|n)>(.*?)<\/(name|n)>([\s\S]*?)<\/Folder>/g;

    while ((match = folderRegex.exec(kmlText)) !== null) {
      const regionName = match[2].trim();
      const folderContent = match[4];
      const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
      let placemarkMatch;

      while ((placemarkMatch = placemarkRegex.exec(folderContent)) !== null) {
        //~ use proper tag pattern for this KML format - try both <name> and <n> tags
        const nameMatch = /<(name|n)>(.*?)<\/(name|n)>/i.exec(placemarkMatch[1]);
        if (nameMatch) {
          const name = nameMatch[2].trim();
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
          Address: extractAddressFromDescription(placemark.description) ||
            (nameValue && nameValue.includes(',')) ? nameValue :
            nameValue ? `${nameValue}, Singapore` : null,
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
    console.log(`✅ Cached maps data (${features.length} features)`);

    return geojson;
  } catch (mapFetchError) {
    console.error('❌ Error fetching Google Maps data:', mapFetchError);
    //~ try to use cache if available
    try {
      console.log('⚠️ Attempting to use cached maps data as fallback');
      const cachedData = JSON.parse(await fs.readFile(MAPS_CACHE, 'utf8'));
      return cachedData;
    } catch {
      console.error('❌ Fallback failed, returning empty collection');
      return { type: 'FeatureCollection', features: [] };
    }
  }
}

//& combine sheets & maps data to single GeoJSON
async function combineData() {
  //~ fetch all data srcs
  const sheetsRecords = await fetchAllSheetsData();
  await fs.writeFile(SHEETS_CACHE, JSON.stringify(sheetsRecords));
  console.log('✅ Cached sheets data');

  const sheetsFeatures = sheetsToGeoJSON(sheetsRecords);
  const mapsData = await fetchMapsData();
  const mapsFeatures = mapsData.features || [];

  //? debug Google Maps data
  console.log(`📍 Extracting Google Maps features for matching: ${mapsFeatures.length} features`);

  //? debug sample feats
  for (let i = 0; i < Math.min(3, mapsFeatures.length); i++) {
    const feature = mapsFeatures[i];
    console.log(`📎 Maps Feature ${i + 1} Sample:`);
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
          console.log(`🗺️ Adding coordinates mapping for "${trimmedName}": [${coords}]`);
        }
      }
    }
  });

  console.log(`🗺️ Created coordinates mapping for ${Object.keys(mapsCoordinatesMap).length} name variants from ${mapsFeatures.length} Google Maps locations`);

  //? debug Google Sheets feats
  for (let i = 0; i < Math.min(3, sheetsFeatures.length); i++) {
    const feature = sheetsFeatures[i];
    console.log(`📑 Sheets Feature ${i + 1} Sample:`);
    console.log(`   Name: ${feature.properties?.name || 'Not found'}`);
    console.log(`   Address: ${feature.properties?.address || 'Not found'}`);
    console.log(`   Properties: ${Object.keys(feature.properties || {}).join(', ')}`);
  }

  //~ enhance Google Sheets feats w coords frm Google Maps using name matching
  let enhancedCount = 0;
  let randomCount = 0;
  //~ apply maps coords to sheets data if matched - create enhanced features array
  const enhancedSheetsFeatures = sheetsFeatures.map(feature => {
    if (!feature.properties?.name) {
      return feature;
    }

    const name = feature.properties.name.trim();
    console.log(`📏 Processing: ${name}`);

    //~ try multiple matching strats
    let coords = null;

    //~ 1. direct exact match
    if (mapsCoordinatesMap[name]) {
      coords = mapsCoordinatesMap[name];
      console.log(`✅ Found exact match for "${name}": [${coords}]`);
      enhancedCount++;
    }
    //~ 2. lowercase match
    else if (mapsCoordinatesMap[name.toLowerCase()]) {
      coords = mapsCoordinatesMap[name.toLowerCase()];
      console.log(`✅ Found lowercase match for "${name}": [${coords}]`);
      enhancedCount++;
    }
    //~ 3. simplified match (no parentheses)
    else {
      const simpleName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (simpleName !== name && mapsCoordinatesMap[simpleName]) {
        coords = mapsCoordinatesMap[simpleName];
        console.log(`✅ Found simplified match for "${name}": [${coords}]`);
        enhancedCount++;
      }
      //~ 4. ultra normalized match
      else {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedName.length > 3 && mapsCoordinatesMap[normalizedName]) {
          coords = mapsCoordinatesMap[normalizedName];
          console.log(`✅ Found normalized match for "${name}": [${coords}]`);
          enhancedCount++;
        }
        //~ 5. partial match - try find if any map location contains this name
        else {
          const mapLocations = Object.keys(mapsCoordinatesMap);
          const matchingLocation = mapLocations.find(loc =>
            loc.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(loc.toLowerCase())
          );

          if (matchingLocation) {
            coords = mapsCoordinatesMap[matchingLocation];
            console.log(`✅ Found partial match for "${name}" with "${matchingLocation}": [${coords}]`);
            enhancedCount++;
          }
          //~ final fallback: generate random coords within sg bounds
          else {
            //~ sg bounds fr random coords
            const sgBounds = {
              minLat: 1.25,
              maxLat: 1.45,
              minLng: 103.65,
              maxLng: 103.95
            };

            //~ generate random coords within sg bounds
            const randomLng = sgBounds.minLng + Math.random() * (sgBounds.maxLng - sgBounds.minLng);
            const randomLat = sgBounds.minLat + Math.random() * (sgBounds.maxLat - sgBounds.minLat);

            coords = [randomLng, randomLat];
            console.log(`❓ No coordinate match for "${name}" - using Singapore area random coordinates`);
            randomCount++;
          }
        }
      }
    }

    //~ replace feature coords w matched / random coords
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

  console.log(`🔄 Enhanced ${enhancedCount} features with Google Maps coordinates, ${randomCount} used random coordinates`);

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
  
  //& get abbreviated ver: take 1st word of multi-word names
  function getAbbreviatedName(name) {
    if (!name || typeof name !== 'string') return '';
    const words = name.trim().split(/\s+/);
    if (words.length <= 1) return name.toLowerCase();
    return words[0].toLowerCase();
  }
  
  //& get ultra-normalized ver: alphanumeric only
  function getAlphaNumericOnly(name) {
    if (!name || typeof name !== 'string') return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  //& calculate similarity between 2 names (crude distance metric)
  function nameSimilarity(name1, name2) {
    //~ convert lowercase & rm non-alphanumeric chars
    const n1 = getAlphaNumericOnly(name1);
    const n2 = getAlphaNumericOnly(name2);
    
    //~ too short names shld-nt match
    if (n1.length < 3 || n2.length < 3) return 0;
    
    //~ exact match === perfect
    if (n1 === n2) return 1.0;
    
    //~ check if 1 contains other
    if (n1.includes(n2)) return 0.9;
    if (n2.includes(n1)) return 0.9;
    
    //~ calc how many chars they hav in common
    let commonChars = 0;
    let shorter, longer;
    if (n1.length <= n2.length) {
      shorter = n1;
      longer = n2;
    } else {
      shorter = n2;
      longer = n1;
    }
    
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        commonChars++;
      }
    }
    
    //~ similarity = ratio of common chars to length of shorter str
    return commonChars / shorter.length;
  }

  console.log('🔄 Merging Google Sheets and Google Maps data with improved name matching...');
  
  //~ 1. create maps feature lookup tables
  const mapsByCoords = {};
  const mapsByName = {};
  const mapsByNormalizedName = {};
  const mapsBySimpleName = {};
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
    
    //~ store by abbreviated name if name has multiple words
    const simpleName = getAbbreviatedName(mapName);
    if (simpleName && simpleName !== mapName.toLowerCase() && simpleName.length > 2) {
      mapsBySimpleName[simpleName] = feature;
    }
  });
  
  //~ 2. create unified feature collection w best data frm each source
  const mergedFeatures = [];
  
  //~ first process all sheet features & try match w map features
  enhancedSheetsFeatures.forEach(sheetFeature => {
    const sheetProps = sheetFeature.properties;
    const sheetName = sheetProps.name || sheetProps.Name || '';
    
    if (!sheetName || sheetName.length < 2) {
      console.log(`⚠️ Skipping sheet feature w no name`);
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
    
    //~ match strategy 4: try partial name match
    if (!matchedMapFeature) {
      //~ try finding best fuzzy match
      let bestMatch = null;
      let bestSimilarity = 0.7; //~ threshold fr accepting match
      
      for (const mapName in mapsByName) {
        const similarity = nameSimilarity(sheetName, mapName);
        if (similarity > bestSimilarity) {
          bestMatch = mapsByName[mapName];
          bestSimilarity = similarity;
        }
      }
      
      if (bestMatch) {
        matchedMapFeature = bestMatch;
        matchType = 'fuzzy-match';
        matchConfidence = bestSimilarity;
        matchAttempts.fuzzyMatch = `Match by fuzzy name (${bestSimilarity.toFixed(2)})`;
      } else {
        matchAttempts.fuzzyMatch = 'No fuzzy name match';
      }
    }
    
    //~ match found, create merged feature w best frm both srcs
    if (matchedMapFeature) {
      const mapProps = matchedMapFeature.properties;
      const mapKey = matchedMapFeature.geometry?.coordinates?.join(',') || `map-${mapProps.name || mapProps.Name || ''}`;
      mapsKeys.add(mapKey); //~ mark as used
      
      //~ create merged feature w best frm both srcs
      const mergedFeature = {
        type: 'Feature',
        geometry: matchedMapFeature.geometry || sheetFeature.geometry,
        properties: {
          ...sheetProps,
          region: mapProps.region || sheetProps.region || 'Unknown',
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
      
      console.log(`🔄 Merged: "${sheetName}" (${matchType}, confidence: ${matchConfidence.toFixed(2)})`);
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
  console.log(`📊 Merged data statistics:`);
  console.log(`✅ Total features after merging: ${mergedFeatures.length}`);
  console.log(`🔄 Original Google Sheets features: ${sheetsFeatures.length}`);
  console.log(`🔄 Original Google Maps features: ${mapsFeatures.length}`);
  console.log(`🔄 Unmatched Maps features added: ${unmatchedMapFeatures}`);
  console.log(`🔄 Duplicates eliminated: ${sheetsFeatures.length + mapsFeatures.length - mergedFeatures.length}`);

  //~ ensure property name consistency (address vs Address)
  mergedFeatures.forEach(feature => {
    const props = feature.properties;

    //~ make sure both address & Address are present
    if (props.address && !props.Address) {
      props.Address = props.address;
      console.log(`🔄 Normalized address property to Address for ${props.name || props.Name}`);
    } else if (props.Address && !props.address) {
      props.address = props.Address;
      console.log(`🔄 Normalized Address property to address for ${props.name || props.Name}`);
    }
    
    //~ preserve addresses even if match name but real addresses
    //~ (address w Singapore, postal code, / longer than 25 chars = likely legitimate)
    const nameStr = (props.name || props.Name || '').toLowerCase();
    let addrStr = (props.address || props.Address || '').toLowerCase();
    
    if (addrStr === nameStr && addrStr.length < 25 && 
        !addrStr.includes('singapore') && !/\d{5,}/.test(addrStr)) {
      //~ likely just name being used as address, so rm
      console.log(`⚠️ Removing name-as-address for "${props.name || props.Name}"`); 
      props.address = '';
      props.Address = '';
    }

    //~ make sure both name & Name are present
    if (props.name && !props.Name) {
      props.Name = props.name;
    } else if (props.Name && !props.name) {
      props.name = props.Name;
    }
  });

  //~ validate & log address extraction stats
  const withAddress = mergedFeatures.filter(f => f.properties.Address || f.properties.address).length;
  const missingAddress = mergedFeatures.length - withAddress;
  console.log(`📊 Address statistics: ${withAddress} features with address, ${missingAddress} features without address`);

  //~ write combined data to disk via defined constant
  await fs.writeFile(COMBINED_OUTPUT, JSON.stringify({ type: 'FeatureCollection', features: mergedFeatures }, null, 2));
  console.log(`✅ Wrote combined data to ${COMBINED_OUTPUT}`);

  return { type: 'FeatureCollection', features: mergedFeatures };
}

//& main execution
async function main() {
  try {
    //~ check if forced refresh enabled
    const forceRefresh = process.argv.includes('--force-refresh');
    if (forceRefresh) {
      console.log('🔄 Forced refresh enabled - will fetch fresh data');
    }

    //~ ensure dirs exist bef processing
    await setupDirectories();

    //~ process & combine data
    await combineData();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message || error);
  process.exit(1);
});
