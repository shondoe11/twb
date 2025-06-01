#!/usr/bin/env node

//* script: debug coordinates in enriched data
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const ENRICHED_GEOJSON = path.join(DATA_DIR, 'enriched.geojson');

async function debugCoordinates() {
  console.log('🔍 Starting coordinates debugging...');
  
  try {
    //~ read enriched data
    console.log('📂 Reading enriched data file...');
    const enrichedData = await fs.readFile(ENRICHED_GEOJSON, 'utf-8')
      .then(data => JSON.parse(data))
      .catch(err => {
        console.error(`❌ Error reading enriched data: ${err.message}`);
        return { type: 'FeatureCollection', features: [] };
      });
    
    //~ check coord format
    console.log(`Total locations: ${enrichedData.features.length}`);
    
    //~ categorize coords
    const regionCounts = {};
    const coordinateIssues = [];
    
    //~ check each feature coords
    enrichedData.features.forEach((feature, index) => {
      //~ get coords
      const coords = feature.geometry.coordinates;
      const name = feature.properties.name || `Location ${index}`;
      const region = feature.properties.region || 'unknown';
      
      //~ track region counts
      regionCounts[region] = (regionCounts[region] || 0) + 1;
      
      //~ check coords valid
      if (!Array.isArray(coords) || coords.length !== 2) {
        coordinateIssues.push({
          name,
          issue: 'Invalid coordinate array',
          coords
        });
        return;
      }
      
      //~ get lat/lng values
      const lng = coords[0]; //~ GeoJSON format [longitude, latitude]
      const lat = coords[1];
      
      //~ check coords valid fr Singapore
      if (isNaN(lat) || isNaN(lng) || 
          lat < 1.2 || lat > 1.5 || 
          lng < 103.5 || lng > 104.1) {
        coordinateIssues.push({
          name,
          issue: 'Coordinates outside Singapore range',
          coords: [lng, lat],
          region
        });
      }
      
      //~ sample logging - print first 10 locations
      if (index < 10) {
        console.log(`Location: ${name}`);
        console.log(`  Coordinates: [${lng}, ${lat}]`);
        console.log(`  Region: ${region}`);
      }
    });
    
    //~ print results
    console.log('\n📊 Region Counts:');
    Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        const percentage = Math.round((count / enrichedData.features.length) * 100);
        console.log(`  ${region}: ${count} locations (${percentage}%)`);
      });
    
    //~ print coordinate issues
    console.log('\n⚠️ Coordinate Issues:');
    if (coordinateIssues.length === 0) {
      console.log('  No coordinate issues found.');
    } else {
      console.log(`  Found ${coordinateIssues.length} locations with coordinate issues:`);
      coordinateIssues.slice(0, 10).forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.name} - ${issue.issue}`);
        console.log(`     Coordinates: ${JSON.stringify(issue.coords)}`);
        console.log(`     Region: ${issue.region}`);
      });
      
      if (coordinateIssues.length > 10) {
        console.log(`  ... and ${coordinateIssues.length - 10} more issues`);
      }
    }
    
    //~ create fix fr coords issue
    console.log('\n🔧 Creating a fix for coordinate issues...');
    
    //~ fix incorrect regions based on coords
    const fixedData = {
      ...enrichedData,
      features: enrichedData.features.map(feature => {
        const coords = feature.geometry.coordinates;
        
        //~ skip if coords not valid
        if (!Array.isArray(coords) || coords.length !== 2) {
          return feature;
        }
        
        const lng = coords[0];
        const lat = coords[1];
        
        //~ only fix if coords in sg range
        if (isNaN(lat) || isNaN(lng) || 
            lat < 1.2 || lat > 1.5 || 
            lng < 103.5 || lng > 104.1) {
          return feature;
        }
        
        //~ determine region based on coords
        let region = 'unknown';
        
        //~ north-east (approximate)
        if (lat > 1.35 && lat < 1.42 && lng > 103.85 && lng < 103.95) {
          region = 'north-east';
        }
        //~ central (approximate)
        else if (lat > 1.28 && lat < 1.35 && lng > 103.78 && lng < 103.88) {
          region = 'central';
        }
        //~ east (approximate)
        else if (lng > 103.88) {
          region = 'east';
        }
        //~ west (approximate)
        else if (lng < 103.78) {
          region = 'west';
        }
        //~ north (approximate)
        else if (lat > 1.35) {
          region = 'north';
        }
        //~ south (approximate)
        else if (lat < 1.28) {
          region = 'south';
        }
        //~ default to central if unsure
        else {
          region = 'central';
        }
        
        //~ return feature w/ updated region
        return {
          ...feature,
          properties: {
            ...feature.properties,
            region
          }
        };
      })
    };
    
    //~ save fixed data
    console.log('💾 Saving fixed data...');
    const FIXED_GEOJSON = path.join(DATA_DIR, 'enriched-fixed.geojson');
    await fs.writeFile(FIXED_GEOJSON, JSON.stringify(fixedData, null, 2));
    
    //~ count regions in fixed data
    const fixedRegionCounts = {};
    fixedData.features.forEach(feature => {
      const region = feature.properties.region || 'unknown';
      fixedRegionCounts[region] = (fixedRegionCounts[region] || 0) + 1;
    });
    
    //~ print fixed region counts
    console.log('\n📊 Fixed Region Counts:');
    Object.entries(fixedRegionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        const percentage = Math.round((count / fixedData.features.length) * 100);
        console.log(`  ${region}: ${count} locations (${percentage}%)`);
      });
    
    console.log('\n✅ Debugging completed successfully!');
    console.log(`📝 Fixed data saved to: ${FIXED_GEOJSON}`);
    console.log('To use the fixed data, rename enriched-fixed.geojson to enriched.geojson');
    
  } catch (error) {
    console.error(`❌ Error during debugging: ${error.message}`);
    console.error(error.stack);
  }
}

debugCoordinates();
