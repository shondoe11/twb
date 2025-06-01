#!/usr/bin/env node

//* script: enhance region data in the combined geojson file
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const COMBINED_GEOJSON = path.join(DATA_DIR, 'combined.geojson');
const ENRICHED_GEOJSON = path.join(DATA_DIR, 'enriched.geojson');

//& normalize region names to standard format
function normalizeRegion(region) {
  if (!region) return 'unknown';
  
  const regionStr = region.toString().toLowerCase().trim();
  
  //~ map frm various possible region names to standard ones
  const regionMappings = {
    //~ north
    'north': 'north',
    'north region': 'north',
    'n': 'north',
    'northern': 'north',
    'north singapore': 'north',
    'woodlands': 'north',
    'sembawang': 'north',
    'yishun': 'north',
    'mandai': 'north',
    
    //~ south
    'south': 'south',
    'south region': 'south',
    's': 'south',
    'southern': 'south',
    'sentosa': 'south',
    'harbourfront': 'south',
    'bukit merah': 'south',
    'telok blangah': 'south',
    'marina': 'south',
    
    //~ east
    'east': 'east',
    'east region': 'east',
    'e': 'east',
    'eastern': 'east',
    'changi': 'east',
    'tampines': 'east',
    'bedok': 'east',
    'pasir ris': 'east',
    'east coast': 'east',
    
    //~ west
    'west': 'west',
    'west region': 'west',
    'w': 'west',
    'western': 'west',
    'jurong': 'west',
    'boon lay': 'west',
    'clementi': 'west',
    'bukit batok': 'west',
    'tuas': 'west',
    
    //~ central
    'central': 'central',
    'central region': 'central',
    'c': 'central',
    'central singapore': 'central',
    'orchard': 'central',
    'downtown': 'central',
    'cbd': 'central',
    'novena': 'central',
    'toa payoh': 'central',
    
    //~ north-east
    'north-east': 'north-east',
    'northeast': 'north-east',
    'north east': 'north-east',
    'ne': 'north-east',
    'serangoon': 'north-east',
    'hougang': 'north-east',
    'sengkang': 'north-east',
    'punggol': 'north-east',
    
    //~ institutions (special category frm Google Maps)
    'institutions': 'institutions',
    'institution': 'institutions',
    'inst': 'institutions',
    'campus': 'institutions',
    'university': 'institutions',
    'polytechnic': 'institutions',
    'school': 'institutions',
  };
  
  //~ check fr direct mapping
  if (regionMappings[regionStr]) {
    return regionMappings[regionStr];
  }
  
  //~ check fr partial matches
  for (const [key, value] of Object.entries(regionMappings)) {
    if (regionStr.includes(key)) {
      return value;
    }
  }
  
  //~ determine frm location name if avail
  return 'unknown';
}

//& determine region frm coords
function determineRegionFromCoordinates(lat, lng) {
  //~ sg regions by rough coords
  
  //~ ensure coords are nums
  lat = parseFloat(lat);
  lng = parseFloat(lng);
  
  //~ debug coord ranges
  console.log(`Processing coordinates: ${lat}, ${lng}`);
  
  //~ sg is roughly at 1.29-1.45°N, 103.6-104.0°E
  //~ check if coords are in sg range
  if (isNaN(lat) || isNaN(lng) || 
      lat < 1.2 || lat > 1.5 || 
      lng < 103.5 || lng > 104.1) {
    console.log(`⚠️ Invalid coordinates: ${lat}, ${lng}`);
    return 'unknown';
  }
  
  //~ north-east (approximate)
  if (lat > 1.35 && lat < 1.42 && lng > 103.85 && lng < 103.95) {
    return 'north-east';
  }
  
  //~ central (approximate)
  if (lat > 1.28 && lat < 1.35 && lng > 103.78 && lng < 103.88) {
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
  if (lat > 1.35) {
    return 'north';
  }
  
  //~ south (approximate)
  if (lat < 1.28) {
    return 'south';
  }
  
  //~ default to central if unsure
  return 'central';
}

async function enhanceRegionData() {
  console.log('🚀 Starting region data enhancement...');
  
  try {
    //~ read combined data
    console.log('📂 Reading combined data file...');
    const combinedData = await fs.readFile(COMBINED_GEOJSON, 'utf-8')
      .then(data => JSON.parse(data))
      .catch(err => {
        console.error(`❌ Error reading combined data: ${err.message}`);
        return { type: 'FeatureCollection', features: [] };
      });
    
    //~ check if enriched data exists
    let enrichedData;
    try {
      enrichedData = await fs.readFile(ENRICHED_GEOJSON, 'utf-8')
        .then(data => JSON.parse(data));
      console.log('📂 Found enriched data file to enhance');
    } catch (error) {
      //~ handle error whn enriched file not exist
      console.log(`📂 No enriched data file found (${error.code}), using combined data`);
      enrichedData = { ...combinedData };
    }
    
    //~ keep track of region stats
    const regionStats = {
      total: 0,
      unknown: 0,
      updated: 0,
      byRegion: {}
    };
    
    //~ process each feature
    console.log('🔍 Enhancing region data...');
    const enhanced = {
      ...enrichedData,
      features: enrichedData.features.map(feature => {
        regionStats.total++;
        
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        
        //~ keep track of original region
        const originalRegion = feature.properties.region || 'unknown';
        
        //~ log original data fr debugging
        if (regionStats.total < 5) {
          console.log(`Sample location: ${feature.properties.name}`);
          console.log(`Coordinates: ${lat}, ${lng}`);
          console.log(`Original region: ${originalRegion}`);
        }
        
        //~ first try to normalize existing region
        let region = normalizeRegion(originalRegion);
        
        //~ if still unknown, try to determine frm coords
        if (region === 'unknown') {
          region = determineRegionFromCoordinates(lat, lng);
        }
        
        //~ update stats
        if (originalRegion === 'unknown') {
          regionStats.unknown++;
        }
        
        if (originalRegion !== region) {
          regionStats.updated++;
        }
        
        //~ update region stats
        regionStats.byRegion[region] = (regionStats.byRegion[region] || 0) + 1;
        
        //~ return updated feature
        return {
          ...feature,
          properties: {
            ...feature.properties,
            region: region
          }
        };
      })
    };
    
    //~ save enhanced data
    console.log('💾 Saving enhanced region data...');
    await fs.writeFile(ENRICHED_GEOJSON, JSON.stringify(enhanced, null, 2));
    
    //~ report stats
    console.log('\n📊 Region Enhancement Statistics:');
    console.log(`- Total locations: ${regionStats.total}`);
    console.log(`- Originally unknown regions: ${regionStats.unknown}`);
    console.log(`- Updated regions: ${regionStats.updated}`);
    console.log('- Regions distribution:');
    
    Object.entries(regionStats.byRegion)
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        console.log(`  ${region}: ${count} locations (${Math.round(count/regionStats.total*100)}%)`);
      });
    
    console.log('\n✅ Region data enhancement completed successfully!');
  } catch (error) {
    console.error(`❌ Error during region enhancement: ${error.message}`);
    console.error(error.stack);
  }
}

enhanceRegionData();
