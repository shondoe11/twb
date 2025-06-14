#!/usr/bin/env node

//* enhanced script fr improved data enrichment
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { setTimeout } from 'timers/promises';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const COMBINED_GEOJSON = path.join(DATA_DIR, 'combined.geojson');
const ENRICHED_GEOJSON = path.join(DATA_DIR, 'enriched.geojson');

//& nearby landmarks API config (using OpenStreetMap Overpass API)
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const LANDMARK_TYPES = ['restaurant', 'cafe', 'supermarket', 'pharmacy', 'hospital', 'bank', 'atm'];
const LANDMARK_RADIUS = 200; //~ metres

//& cache mgmt functions
async function setupCache() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error setting up cache: ${error.message}`);
  }
}

async function saveToCache(key, data) {
  const cacheKey = createHash('md5').update(key).digest('hex');
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        key,
        timestamp: Date.now(),
        data
      })
    );
    return true;
  } catch (error) {
    console.error(`Error saving to cache: ${error.message}`);
    return false;
  }
}

async function getFromCache(key, maxAge = 604800000) { //~ default 7d
  const cacheKey = createHash('md5').update(key).digest('hex');
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    const cacheEntry = JSON.parse(content);
    
    //~ heck cache expiry
    if (Date.now() - cacheEntry.timestamp > maxAge) {
      return null;
    }
    
    return cacheEntry.data;
  } catch {
    return null;
  }
}

//& fetch nearby landmarks using Overpass API
async function fetchNearbyLandmarks(lat, lng, radius = LANDMARK_RADIUS) {
  const cacheKey = `landmarks-${lat}-${lng}-${radius}`;
  const cached = await getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  //~ build overpass query fr landmarks
  const query = `
    [out:json];
    (
      ${LANDMARK_TYPES.map(type => `
        node["amenity"="${type}"](around:${radius},${lat},${lng});
        way["amenity"="${type}"](around:${radius},${lat},${lng});
      `).join('')}
    );
    out body;
    >;
    out skel qt;
  `;
  
  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch landmarks: ${response.status}`);
    }
    
    const data = await response.json();
    const landmarks = data.elements
      .filter(element => element.tags && element.tags.name)
      .map(element => ({
        name: element.tags.name,
        type: element.tags.amenity,
        distance: calculateDistance(lat, lng, element.lat || 0, element.lon || 0)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5) //~ get 5 closest landmarks
      .map(landmark => `${landmark.name} (${landmark.type}, ${Math.round(landmark.distance * 1000)}m)`);
    
    await saveToCache(cacheKey, landmarks);
    return landmarks;
  } catch (error) {
    console.warn(`Could not fetch landmarks: ${error.message}`);
    return [];
  }
}

//& generate accessibility details based on location type & name
function generateAccessibilityInfo(location) {
  //~ default values based on venue type
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ base probability fr features by type
  const typeProbs = {
    mall: { hasRamp: 0.9, doorWidth: [90, 100], grabBars: 0.8, emergencyButton: 0.7 },
    hotel: { hasRamp: 0.95, doorWidth: [85, 110], grabBars: 0.9, emergencyButton: 0.8 },
    public: { hasRamp: 0.6, doorWidth: [75, 90], grabBars: 0.5, emergencyButton: 0.3 },
    restaurant: { hasRamp: 0.7, doorWidth: [80, 95], grabBars: 0.6, emergencyButton: 0.4 },
    other: { hasRamp: 0.5, doorWidth: [70, 90], grabBars: 0.4, emergencyButton: 0.2 }
  };
  
  //~ determine best type match
  let probTemplate = typeProbs.other;
  
  if (type.includes('mall') || name.includes('mall') || name.includes('shopping')) {
    probTemplate = typeProbs.mall;
  } else if (type.includes('hotel') || name.includes('hotel')) {
    probTemplate = typeProbs.hotel;
  } else if (type.includes('public') || name.includes('mrt') || name.includes('station')) {
    probTemplate = typeProbs.public;
  } else if (type.includes('restaurant') || name.includes('restaurant') || name.includes('cafe')) {
    probTemplate = typeProbs.restaurant;
  }
  
  //~ generate deterministic but pseudo-random values based on location id
  const idSum = location.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hashBase = (idSum % 100) / 100;
  
  //~ deterministic "random" using location id as seed
  const getHashRand = (offset = 0) => {
    const hash = (hashBase + offset) % 1;
    return hash;
  };
  
  //~ generate accessibility data
  return {
    hasRamp: getHashRand(0.1) < probTemplate.hasRamp,
    doorWidth: Math.floor(probTemplate.doorWidth[0] + getHashRand(0.2) * (probTemplate.doorWidth[1] - probTemplate.doorWidth[0])),
    grabBars: getHashRand(0.3) < probTemplate.grabBars,
    emergencyButton: getHashRand(0.4) < probTemplate.emergencyButton
  };
}

//& determine water temperature based on venue type & bidet presence
function determineWaterTemperature(location) {
  //~ only relevant for locations with bidets
  if (!location.hasBidet) {
    return undefined;
  }
  
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ luxury venues more likely to have adjustable temperature
  if (type.includes('hotel') || name.includes('hotel') || 
      name.includes('luxury') || name.includes('premium')) {
    return 'adjustable';
  }
  
  //~ malls often have warm water
  if (type.includes('mall') || name.includes('mall') || 
      name.includes('shopping')) {
    return Math.random() > 0.4 ? 'warm' : 'cold';
  }
  
  //~ default to cold water
  return 'cold';
}

//& generate floor information
function generateFloorInfo(location) {
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ generate deterministic but varied floor values
  const idSum = location.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  
  //~ malls typically have multiple floors
  if (type.includes('mall') || name.includes('mall')) {
    const level = (idSum % 5) + 1;
    return `Level ${level}`;
  }
  
  //~ hotels usually specify floor numbers
  if (type.includes('hotel') || name.includes('hotel')) {
    const floor = (idSum % 20) + 1;
    return `${floor}F`;
  }
  
  //~ default for other types
  return 'Ground Floor';
}

//& calculate enhanced amenities based on type and other factors
function enhanceAmenities(location) {
  const base = location.amenities || { 
    wheelchairAccess: false, 
    babyChanging: false, 
    freeEntry: true 
  };
  
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ generate deterministic but pseudo-random values based on location id
  const idSum = location.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hashBase = (idSum % 100) / 100;
  
  //~ deterministic "random" using location id as seed
  const getHashRand = (offset = 0) => {
    const hash = (hashBase + offset) % 1;
    return hash;
  };
  
  //~ probability for additional amenities by type
  const typeProbs = {
    mall: { handDryer: 0.9, soapDispenser: 0.95, paperTowels: 0.7, toiletPaper: 0.99 },
    hotel: { handDryer: 0.95, soapDispenser: 0.99, paperTowels: 0.9, toiletPaper: 0.99 },
    public: { handDryer: 0.6, soapDispenser: 0.7, paperTowels: 0.3, toiletPaper: 0.8 },
    restaurant: { handDryer: 0.7, soapDispenser: 0.8, paperTowels: 0.6, toiletPaper: 0.9 },
    other: { handDryer: 0.5, soapDispenser: 0.6, paperTowels: 0.4, toiletPaper: 0.7 }
  };
  
  //~ determine best type match
  let probTemplate = typeProbs.other;
  
  if (type.includes('mall') || name.includes('mall') || name.includes('shopping')) {
    probTemplate = typeProbs.mall;
  } else if (type.includes('hotel') || name.includes('hotel')) {
    probTemplate = typeProbs.hotel;
  } else if (type.includes('public') || name.includes('mrt') || name.includes('station')) {
    probTemplate = typeProbs.public;
  } else if (type.includes('restaurant') || name.includes('restaurant') || name.includes('cafe')) {
    probTemplate = typeProbs.restaurant;
  }
  
  //~ enhanced amenities
  return {
    ...base,
    handDryer: getHashRand(0.1) < probTemplate.handDryer,
    soapDispenser: getHashRand(0.2) < probTemplate.soapDispenser,
    paperTowels: getHashRand(0.3) < probTemplate.paperTowels,
    toiletPaper: getHashRand(0.4) < probTemplate.toiletPaper
  };
}

//& calculate realistic cleanliness rating based on various factors
function calculateCleanlinessRating(location) {
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ base ratings by venue type (out of 5)
  let baseRating = 3;
  
  if (type.includes('hotel') || name.includes('hotel') || name.includes('luxury')) {
    baseRating = 4.2;
  } else if (type.includes('mall') || name.includes('mall')) {
    baseRating = 3.8;
  } else if (type.includes('public') || name.includes('mrt')) {
    baseRating = 3.2;
  } else if (type.includes('restaurant') || name.includes('cafe')) {
    baseRating = 3.5;
  }
  
  //~ adjust rating based on amenities (better amenities suggest better maintenance)
  if (location.amenities) {
    if (location.amenities.wheelchairAccess) baseRating += 0.2;
    if (location.amenities.babyChanging) baseRating += 0.1;
  }
  
  //~ generate deterministic variation
  const idSum = location.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const variation = ((idSum % 10) - 5) / 10; //~ -0.5 to 0.5
  
  //~ apply variation and constrain to 1-5 range
  const rating = Math.max(1, Math.min(5, baseRating + variation));
  
  //~ round to 1 decimal place
  return Math.round(rating * 10) / 10;
}

//& determine visit count (popularity metric)
function calculateVisitCount(location) {
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ base counts by venue type
  let baseCount = 500;
  
  if (type.includes('mall') || name.includes('mall')) {
    baseCount = 2000;
  } else if (type.includes('hotel') || name.includes('hotel')) {
    baseCount = 800;
  } else if (type.includes('public') || name.includes('mrt')) {
    baseCount = 1500;
  } else if (type.includes('restaurant') || name.includes('cafe')) {
    baseCount = 1000;
  }
  
  //~ adjust for bidet presence (more popular if has bidet)
  if (location.hasBidet) {
    baseCount *= 1.3;
  }
  
  //~ generate deterministic variation
  const idSum = location.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const variation = 0.5 + ((idSum % 100) / 100); //~ 0.5 to 1.5
  
  //~ apply variation and round to whole number
  return Math.round(baseCount * variation);
}

//& generate a realistic maintenance contact
function generateMaintenanceContact(location) {
  const type = location.type?.toLowerCase() || '';
  const name = location.name.toLowerCase();
  
  //~ different contact formats based on type
  if (type.includes('mall') || name.includes('mall')) {
    return 'Facilities Management: 6xxx xxxx';
  } else if (type.includes('hotel') || name.includes('hotel')) {
    return 'Housekeeping: 6xxx xxxx';
  } else if (type.includes('public') || name.includes('mrt')) {
    return 'Maintenance Hotline: 1800-xxx-xxxx';
  } else if (type.includes('restaurant') || name.includes('cafe')) {
    return 'Staff: Please ask at counter';
  }
  
  return 'Maintenance: Report to staff';
}

//& calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; //~ earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; //~ distance in km
  return d;
}

//& helper func: convert degrees to radians
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

//& enhanced location enrichment func
async function enhanceLocationData(location) {
  try {
    //~ deep copy avoid modifying original
    console.log(`[DEBUG fetch-enhanced-data.mjs HELD1] enhanceLocationData INPUT for ID ${location.id} - Address: ${location.address}, Source: ${location.source}`);
    const enhanced = JSON.parse(JSON.stringify(location));
    console.log(`[DEBUG fetch-enhanced-data.mjs HELD2] enhanceLocationData 'enhanced' object AFTER deep copy for ID ${enhanced.id} - Address: ${enhanced.address}, Source: ${enhanced.source}`);
    
    //~ enhance existing amenities
    enhanced.amenities = enhanceAmenities(enhanced);
    
    //~ process src-specific comments
    enhanced.sourceComments = enhanced.sourceComments || {};
    
    //~ handle Google Maps src data
    if (enhanced.source === 'maps' || enhanced.source === 'kml') {
      //~ ensure hav maps src comments section
      enhanced.sourceComments.maps = enhanced.sourceComments.maps || [];
      
      //~ add description to maps src comments if avail
      if (enhanced.description && !enhanced.sourceComments.maps.includes(enhanced.description)) {
        //~ handle description could be string / object w value
        const descText = typeof enhanced.description === 'object' && enhanced.description['@type'] && enhanced.description.value ? 
          enhanced.description.value : enhanced.description;
        enhanced.sourceComments.maps.push(descText);
      }
    
      //~ other non-standard props to maps src comments
      const skipProps = ['id', 'name', 'address', 'region', 'type', 'lat', 'lng', 
        'hasBidet', 'source', 'description', 'gender', 'amenities', 'notes',
        'lastUpdated', 'geometry', 'coordinates', 'sourceComments'];
      
      Object.entries(enhanced).forEach(([key, value]) => {
        if (!skipProps.includes(key) && value !== null && value !== undefined && value !== 'Unknown') {
          //~ format prop fr display
          let formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const comment = `${key}: ${formattedValue}`;
          if (!enhanced.sourceComments.maps.includes(comment)) {
            enhanced.sourceComments.maps.push(comment);
          }
        }
      });
    }
    
    //~ handle Google Sheets src data
    if (enhanced.source === 'sheets') {
      //~ ensure hav sheets src comments section
      enhanced.sourceComments.sheets = enhanced.sourceComments.sheets || [];
      
      //~ add remarks to sheets src comments if avail
      if (enhanced.remarks && !enhanced.sourceComments.sheets.includes(enhanced.remarks)) {
        enhanced.sourceComments.sheets.push(enhanced.remarks);
      }
      
      //~ handle bidet room name fr hotels
      if (enhanced.roomNameWithBidet && !enhanced.sourceComments.sheets.includes(enhanced.roomNameWithBidet)) {
        enhanced.sourceComments.sheets.push(`Room with bidet: ${enhanced.roomNameWithBidet}`);
      }
      
      //~ validate src tab & add gender info if avail
      if (enhanced.sourceTab) {
        if (enhanced.sourceTab.toLowerCase().includes('male')) {
          enhanced.gender = 'Male';
        } else if (enhanced.sourceTab.toLowerCase().includes('female')) {
          enhanced.gender = 'Female';
        }
        
        //~ sourceTab info to comments if nt alr included
        const tabInfo = `Source: ${enhanced.sourceTab}`;
        if (!enhanced.sourceComments.sheets.includes(tabInfo)) {
          enhanced.sourceComments.sheets.push(tabInfo);
        }
      }
    }
    
    //~ add accessibility information
    enhanced.accessibility = generateAccessibilityInfo(enhanced);
    
    //~ add water temperature for bidets
    enhanced.waterTemperature = determineWaterTemperature(enhanced);
    
    //~ add cleanliness rating
    enhanced.cleanliness = calculateCleanlinessRating(enhanced);
    
    //~ add floor information
    enhanced.floor = generateFloorInfo(enhanced);
    
    //~ add maintenance contact
    enhanced.maintenanceContact = generateMaintenanceContact(enhanced);
    
    //~ add visit count
    enhanced.visitCount = calculateVisitCount(enhanced);
    
    //~ add nearby landmarks
    if (enhanced.lat && enhanced.lng) {
      enhanced.nearbyLandmarks = await fetchNearbyLandmarks(enhanced.lat, enhanced.lng);
    }
    
    //~ add last cleaned date (random date in last 3 days)
    const now = new Date();
    const daysAgo = Math.random() * 3;
    const lastCleaned = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    enhanced.lastCleaned = lastCleaned.toISOString();
    
    console.log(`[DEBUG fetch-enhanced-data.mjs HELD3] enhanceLocationData RETURNING 'enhanced' object for ID ${enhanced.id} - Address: ${enhanced.address}, Source: ${enhanced.source}`);
    return enhanced;
  } catch (error) {
    console.error(`Error enhancing location ${location.name}: ${error.message}`);
    return location; //~ return original if enhancement fails
  }
}

//& main function: read existing data and enhance it
async function enhanceData() {
  console.log('🚀 Starting enhanced data enrichment process...');
  
  try {
    //~ setup cache
    await setupCache();
    
    //~ read existing combined data
    console.log('📂 Reading existing combined data...');
    const combinedData = await fs.readFile(COMBINED_GEOJSON, 'utf-8')
      .then(data => JSON.parse(data))
      .catch(err => {
        console.error(`❌ Error reading combined data: ${err.message}`);
        return { type: 'FeatureCollection', features: [] };
      });
    
    //~ check if data exists
    if (!combinedData.features || combinedData.features.length === 0) {
      console.error('❌ No features found in combined data.');
      return;
    }
    
    console.log(`📊 Found ${combinedData.features.length} locations to enhance.`);
    
    //~ process each feature
    console.log('🔍 Enhancing location data...');
    const total = combinedData.features.length;
    let processed = 0;
    const enhancedFeatures = [];
    
    for (const feature of combinedData.features) {
      processed++;
      
      if (processed % 10 === 0 || processed === total) {
        console.log(`⏳ Progress: ${processed}/${total} locations enhanced`);
      }
      
      //~ get location frm feature
      console.log(`[DEBUG fetch-enhanced-data.mjs HED1] Feature ID: ${feature.properties.id}, Original Address: ${feature.properties.address}, Original Source: ${feature.properties.source}`);
      const location = {
        id: feature.properties.id || `loc-${Math.random().toString(36).substring(2, 10)}`,
        name: feature.properties.name || 'Unknown Location',
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        address: feature.properties.address,
        region: feature.properties.region,
        type: feature.properties.type,
        hasBidet: feature.properties.hasBidet ?? true,
        amenities: feature.properties.amenities || {
          wheelchairAccess: false,
          babyChanging: false,
          freeEntry: true
        },
        notes: feature.properties.notes,
        lastUpdated: feature.properties.lastUpdated || new Date().toISOString(),
        openingHours: feature.properties.openingHours,
        normalizedHours: feature.properties.normalizedHours,
        imageUrl: feature.properties.imageUrl,
        rating: feature.properties.rating,
        source: feature.properties.source,
        //~ preserve existing sourceComments if avail
        sourceComments: feature.properties.sourceComments || {
          maps: [],
          sheets: []
        },
        //~ preserve other fields fr proper src comment handling
        description: feature.properties.description,
        sheetsRemarks: feature.properties.sheetsRemarks,
        roomNameWithBidet: feature.properties.roomNameWithBidet,
        sourceTab: feature.properties.sourceTab
      };
      
      //~ enhance location w additional data
      console.log(`[DEBUG fetch-enhanced-data.mjs HED2] Location object for ID ${location.id} BEFORE enhanceLocationData - Address: ${location.address}, Source: ${location.source}`);
      const enhancedLocation = await enhanceLocationData(location);
      
      //~ create enhanced feature
      console.log(`[DEBUG fetch-enhanced-data.mjs HED3] Location object for ID ${location.id} AFTER enhanceLocationData - Address: ${enhancedLocation.address}, Source: ${enhancedLocation.source}`);
      const enhancedFeature = {
        ...feature,
        properties: {
          ...feature.properties,
          ...enhancedLocation
        }
      };
      
      enhancedFeatures.push(enhancedFeature);
      console.log(`[DEBUG fetch-enhanced-data.mjs HED4] Final enhancedFeature.properties for ID ${enhancedFeature.properties.id} - Address: ${enhancedFeature.properties.address}, Source: ${enhancedFeature.properties.source}`);
      
      //~ add small delay: avoid rate limiting fr API calls
      if (processed % 5 === 0) {
        await setTimeout(500);
      }
    }
    
    //~ create enhanced geojson
    const enhancedData = {
      type: 'FeatureCollection',
      features: enhancedFeatures
    };
    
    //~ save enhanced data
    console.log('💾 Saving enhanced data...');
    await fs.writeFile(ENRICHED_GEOJSON, JSON.stringify(enhancedData, null, 2));
    console.log(`✅ Enhanced data saved to ${ENRICHED_GEOJSON}`);
    
    //~ report statistics
    console.log('\n📊 Enhancement Statistics:');
    console.log(`- Total locations: ${total}`);
    console.log(`- Locations with accessibility info: ${enhancedFeatures.filter(f => f.properties.accessibility).length}`);
    console.log(`- Locations with nearby landmarks: ${enhancedFeatures.filter(f => f.properties.nearbyLandmarks && f.properties.nearbyLandmarks.length > 0).length}`);
    console.log(`- Locations with enhanced amenities: ${enhancedFeatures.filter(f => f.properties.amenities && f.properties.amenities.handDryer !== undefined).length}`);
    
    console.log('\n🎉 Data enhancement completed successfully!');
    
  } catch (_error) {
    console.error('Failed to fetch and enhance data:', _error.message);
    console.error(_error.stack);
  }
}

enhanceData();
