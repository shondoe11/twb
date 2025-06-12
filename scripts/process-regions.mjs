#!/usr/bin/env node

//* script: enhance region data in combined geojson
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

//& normalize region names to standard format w proper capitalization
function normalizeRegion(region) {
  if (!region) return 'unknown';
  
  //~ check if region alr match 1 of exact capitalized formats
  //~ match google maps folder names exactly
  const exactRegions = {
    'North': 'North', 
    'South': 'South', 
    'East': 'East', 
    'West': 'West', 
    'Central': 'Central', 
    'North-East': 'North-East', 
    'Institutions': 'Institutions'
  };
  
  //~ if region exactly matches 1 of expected formats, keep
  if (exactRegions[region]) {
    console.log(`Found exact region match: ${region}`);
    return region;
  }
  
  //~ otherwise normalize to lowercase fr matching
  const regionStr = region.toString().toLowerCase().trim();
  
  //~ map frm various possible region names to standard ones w proper capitalization
  const regionMappings = {
    //~ north
    'north': 'North',
    'north region': 'North',
    'n': 'North',
    'northern': 'North',
    'north singapore': 'North',
    'woodlands': 'North',
    'sembawang': 'North',
    'yishun': 'North',
    'mandai': 'North',
    
    //~ south
    'south': 'South',
    'south region': 'South',
    's': 'South',
    'southern': 'South',
    'sentosa': 'South',
    'harbourfront': 'South',
    'bukit merah': 'South',
    'telok blangah': 'South',
    'marina': 'South',
    
    //~ east
    'east': 'East',
    'east region': 'East',
    'e': 'East',
    'eastern': 'East',
    'changi': 'East',
    'tampines': 'East',
    'bedok': 'East',
    'pasir ris': 'East',
    'east coast': 'East',
    
    //~ west
    'west': 'West',
    'west region': 'West',
    'w': 'West',
    'western': 'West',
    'jurong': 'West',
    'boon lay': 'West',
    'clementi': 'West',
    'bukit batok': 'West',
    'tuas': 'West',
    
    //~ central
    'central': 'Central',
    'central region': 'Central',
    'c': 'Central',
    'central singapore': 'Central',
    'orchard': 'Central',
    'downtown': 'Central',
    'cbd': 'Central',
    'novena': 'Central',
    'toa payoh': 'Central',
    
    //~ north-east
    'north-east': 'North-East',
    'northeast': 'North-East',
    'north east': 'North-East',
    'ne': 'North-East',
    'serangoon': 'North-East',
    'hougang': 'North-East',
    'sengkang': 'North-East',
    'punggol': 'North-East',
    
    //~ institutions (special category frm Google Maps)
    'institutions': 'Institutions',
    'institution': 'Institutions',
    'inst': 'Institutions',
    'campus': 'Institutions',
    'university': 'Institutions',
    'polytechnic': 'Institutions',
    'school': 'Institutions',
  };
  
  //~ check fr direct mapping
  if (regionMappings[regionStr]) {
    return regionMappings[regionStr]; //~ capital ver
  }
  
  //~ check fr partial matches in name
  for (const [key, value] of Object.entries(regionMappings)) {
    if (regionStr.includes(key)) {
      return value; //~ proper capital ver
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
  
  //~ check coords valid
  if (isNaN(lat) || isNaN(lng) || lat < 1.15 || lat > 1.47 || lng < 103.6 || lng > 104.1) {
    return 'unknown';
  }
  
  //~ north-east (approximate)
  if (lat > 1.38 && lng > 103.85) {
    return 'North-East';
  }
  
  //~ east (approximate)
  if (lng > 103.94) {
    return 'East';
  }
  
  //~ north (approximate)
  if (lat > 1.35) {
    return 'North';
  }
  
  //~ south (approximate)
  if (lat < 1.28) {
    return 'South';
  }
  
  //~ default to central if unsure
  return 'Central';
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
      //~ handle error whn enriched file nt exist
      console.log(`📂 No enriched data file found (${error.code}), using combined data`);
      enrichedData = { ...combinedData };
    }
    
    //~ region stats tracking
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
        
        //~ keep track original region
        const originalRegion = feature.properties.region || 'unknown';
        
        //~ log original data fr debugging
        if (regionStats.total < 5) {
          console.log(`Sample location: ${feature.properties.name}`);
          console.log(`Coordinates: ${lat}, ${lng}`);
          console.log(`Original region: ${originalRegion}`);
        }
        let region = originalRegion;
        if (feature.properties.source !== 'google-maps') {
          region = normalizeRegion(originalRegion);
          if (region === 'unknown') {
            region = determineRegionFromCoordinates(lat, lng);
          }
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
