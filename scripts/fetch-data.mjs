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
const SHEETS_OUTPUT = path.join(DATA_DIR, 'toilets.json');
const MAPS_OUTPUT = path.join(DATA_DIR, 'toilets.geojson');
const COMBINED_OUTPUT = path.join(DATA_DIR, 'combined.geojson');

//& fetch csv data frm google sheets & parse into json
async function fetchSheets() {
  try {
    const response = await fetch(SHEETS_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheets data: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn('Google Sheets returned HTML instead of CSV, possibly due to access restrictions.');
      console.warn('Creating sample locations for testing...');
      return createSampleLocations();
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    console.warn('Creating sample locations for testing...');
    return createSampleLocations();
  }
}

//& create sample locations whn google sheets access fails
function createSampleLocations() {
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
      lastUpdated: new Date().toISOString().split('T')[0],
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
      lastUpdated: new Date().toISOString().split('T')[0],
    },
  ];
}

//& parse csv text into arr of objs
function parseCSV(csvText) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(csvText);
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`Parsed ${results.length} rows from CSV`);
        
        //~ convert to toilet location format
        const locations = results.map((record, index) => ({
          id: record.id || `location-${index}`,
          name: record.name || '',
          address: record.address || '',
          region: record.region || '',
          type: record.type || '',
          lat: parseFloat(record.latitude || record.lat) || 0,
          lng: parseFloat(record.longitude || record.lng) || 0,
          hasBidet: record.hasBidet === 'true' || record.hasBidet === 'yes' || false,
          amenities: {
            wheelchairAccess: record.wheelchairAccess === 'true' || record.wheelchairAccess === 'yes' || false,
            babyChanging: record.babyChanging === 'true' || record.babyChanging === 'yes' || false,
            freeEntry: record.freeEntry === 'true' || record.freeEntry === 'yes' || false,
          },
          notes: record.notes || '',
          lastUpdated: record.lastUpdated || new Date().toISOString().split('T')[0],
        }));
        
        resolve(locations.filter(loc => loc.name && (loc.lat !== 0 || loc.lng !== 0)));
      })
      .on('error', reject);
  });
}

//& fetch kml data frm google my maps & convert to geojson
async function fetchMaps() {
  try {
    const response = await fetch(MAPS_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch KML data: ${response.status}`);
    }
    
    const kmlText = await response.text();
    return convertKMLtoGeoJSON(kmlText);
  } catch (error) {
    console.error('Error fetching Google My Maps data:', error);
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

//& main func
async function fetchData() {
  try {
    console.log('Creating data directory if it doesn\'t exist...');
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    console.log('Fetching data from Google Sheets...');
    const sheetsData = await fetchSheets();
    await fs.writeFile(SHEETS_OUTPUT, JSON.stringify(sheetsData, null, 2));
    console.log(`Saved ${sheetsData.length} locations to ${SHEETS_OUTPUT}`);
    
    console.log('Fetching data from Google My Maps...');
    const mapsData = await fetchMaps();
    await fs.writeFile(MAPS_OUTPUT, JSON.stringify(mapsData, null, 2));
    console.log(`Saved GeoJSON with ${mapsData.features.length} features to ${MAPS_OUTPUT}`);
    
    //~ merge data frm both srcs
    console.log('Merging data from both sources...');
    const combinedData = mergeSheetsAndMapsData(sheetsData, mapsData);
    await fs.writeFile(COMBINED_OUTPUT, JSON.stringify(combinedData, null, 2));
    console.log(`Saved combined GeoJSON with ${combinedData.features.length} features to ${COMBINED_OUTPUT}`);
    
    console.log('Data sync completed successfully!');
  } catch (error) {
    console.error('Error syncing data:', error);
    process.exit(1);
  }
}

fetchData();
