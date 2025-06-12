#!/usr/bin/env node

//* fix address extraction frm Google Maps KML data
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//~ same constants in fetch-data.mjs
const MAPS_ID = '1749466480571';
const DATA_DIR = path.join(__dirname, '../data');
const MAPS_RAW_FILE = path.join(DATA_DIR, 'maps-raw-data.xml');
const MAPS_OUTPUT = path.join(DATA_DIR, 'maps.geojson');
const COMBINED_OUTPUT = path.join(DATA_DIR, 'combined.geojson');

async function fixAddresses() {
  try {
    console.log('🔧 Starting address fix operation...');
    
    //~ read raw KML data
    const kmlText = await fs.readFile(MAPS_RAW_FILE, 'utf8');
    console.log(`📄 KML data loaded (${kmlText.length} bytes)`);
    
    //~ parse KML w improved regex patterns
    const placemarks = [];
    const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    let match;
    
    while ((match = regex.exec(kmlText)) !== null) {
      const placemark = match[1];
      
      //~ try both <name> & <n> tags fr name extraction
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
      
      //~ try extract CDATA content if present
      const cdataMatch = /<!\[CDATA\[(.*?)\]\]>/i.exec(description);
      if (cdataMatch) {
        description = cdataMatch[1];
      }
      
      //~ extract address frm description if contains address pattern
      let address = null;
      //~ look fr address in description (patterns like "123 Bain St, Singapore")
      const addressRegex = /\d+[\w\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|lane|ln|drive|dr|terrace|ter|place|pl|court|ct)[,\s]+\w+/i;
      const addressMatch = addressRegex.exec(description);
      if (addressMatch) {
        address = addressMatch[0].trim();
        console.log(`🏠 Extracted address: ${address}`);
      } else if (description.includes('Address:')) {
        //~ try extract address labeled explicitly
        const addressLabelMatch = /Address:\s*([^<\n]+)/i.exec(description);
        if (addressLabelMatch) {
          address = addressLabelMatch[1].trim();
          console.log(`🏠 Extracted labeled address: ${address}`);
        }
      }
      
      //~ extract coords
      const coordsMatch = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(placemark);
      if (!coordsMatch) continue;
      
      const coordStr = coordsMatch[1].trim();
      const [lng, lat] = coordStr.split(',').map(parseFloat);
      if (isNaN(lat) || isNaN(lng)) continue;
      
      //~ extract gender avail frm description
      let female = null, male = null, handicap = null;
      
      if (description.match(/female|women|woman|ladies|lady/i)) {
        female = 'Yes';
      }
      
      if (description.match(/male|men|man|gentleman|gent/i)) {
        male = 'Yes';
      }
      
      if (description.match(/handicap|disabled|wheelchair/i)) {
        handicap = 'Yes';
      }
      
      placemarks.push({
        name,
        description,
        coordinates: [lng, lat],
        female,
        male, 
        handicap,
        address
      });
    }
    
    console.log(`🗺️ Extracted ${placemarks.length} placemarks with improved parsing`);
    
    //~ convert to GeoJSON
    const features = placemarks.map((placemark, index) => {
      const name = placemark.name || `Unnamed Location ${index + 1}`;
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: placemark.coordinates
        },
        properties: {
          id: `maps-${MAPS_ID}-${index}`,
          name: name,
          Name: name, 
          description: placemark.description,
          Female: placemark.female,
          Male: placemark.male,
          Handicap: placemark.handicap,
          Address: placemark.address || null,
          region: 'Unknown',
          source: 'google-maps'
        }
      };
    });
    
    //~ save fixed Google Maps GeoJSON
    const mapsGeoJSON = {
      type: 'FeatureCollection',
      features
    };
    
    await fs.writeFile(MAPS_OUTPUT, JSON.stringify(mapsGeoJSON, null, 2));
    console.log(`✅ Updated maps GeoJSON with improved address extraction (${features.length} features)`);
    
    //~ read combined data & update addresses
    const combinedData = JSON.parse(await fs.readFile(COMBINED_OUTPUT, 'utf8'));
    console.log(`📊 Read combined data (${combinedData.features.length} total features)`);
    
    //~ lookup map fr addresses by coords
    const addressLookup = new Map();
    features.forEach(feature => {
      if (feature.properties.Address) {
        const coordKey = feature.geometry.coordinates.join(',');
        addressLookup.set(coordKey, feature.properties.Address);
      }
    });
    
    //~ update addresses in combined data if missing
    let updatedCount = 0;
    combinedData.features.forEach(feature => {
      if (feature.properties.source === 'google-maps' && !feature.properties.address) {
        const coordKey = feature.geometry.coordinates.join(',');
        const address = addressLookup.get(coordKey);
        if (address) {
          feature.properties.address = address;
          updatedCount++;
        }
      }
    });
    
    console.log(`🔄 Updated ${updatedCount} missing addresses in combined data`);
    
    //~ save updated combined GeoJSON
    await fs.writeFile(COMBINED_OUTPUT, JSON.stringify(combinedData, null, 2));
    console.log(`✅ Saved updated combined GeoJSON with improved addresses`);
    
  } catch (error) {
    console.error('❌ Error fixing addresses:', error);
    process.exit(1);
  }
}

fixAddresses();
