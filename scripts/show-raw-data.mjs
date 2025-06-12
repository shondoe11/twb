import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

//~ config
const GOOGLE_MAPS_ID = '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0';
const MAPS_KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${GOOGLE_MAPS_ID}`;

//~ Google Sheets config
const SHEETS_ID = '1jAMaD3afMfA19U2u1aRLkL0M-ufFvz1fKDpT_BraOfY';
const SHEETS = [
  { 
    name: 'MALE TOILETS',
    id: SHEETS_ID,  
    gid: '0' 
  },
  { 
    name: 'FEMALE TOILETS', 
    id: SHEETS_ID,
    gid: '1908890944'
  },
  {
    name: 'HOTEL ROOMS W BIDET',
    id: SHEETS_ID,
    gid: '1650628758'
  }
];

//~ paths fr storing data
const DATA_DIR = path.join(process.cwd(), 'data');
const MAPS_RAW_DATA = path.join(DATA_DIR, 'maps-raw-data.xml');
const SHEETS_RAW_DATA_PREFIX = path.join(DATA_DIR, 'sheets-raw-data-');

async function setupDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Data directory created or already exists');
  } catch (error) {
    console.error('❌ Error creating data directory:', error);
    throw error;
  }
}

async function fetchGoogleMapsData() {
  console.log('🔄 Fetching Google Maps KML data...');
  
  try {
    const response = await fetch(MAPS_KML_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const kmlText = await response.text();
    console.log(`✅ Google Maps KML data fetched (${kmlText.length} bytes)`);
    
    //~ save raw KML data
    await fs.writeFile(MAPS_RAW_DATA, kmlText);
    console.log(`💾 Saved raw KML to ${MAPS_RAW_DATA}`);
    
    //~ show sample KML struct
    console.log('\n🔍 Google Maps KML Sample:');
    console.log(kmlText.substring(0, 500) + '...');
    
    //~ count placemarks
    const placemarkCount = (kmlText.match(/<Placemark>/g) || []).length;
    console.log(`📊 Found ${placemarkCount} placemarks in KML data`);
  } catch (error) {
    console.error('❌ Error fetching Google Maps data:', error);
  }
}

async function fetchGoogleSheetsData() {
  for (const sheet of SHEETS) {
    console.log(`🔄 Fetching Google Sheets data for ${sheet.name}...`);
    
    const sheetsURL = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
    
    try {
      const response = await fetch(sheetsURL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const csvText = await response.text();
      console.log(`✅ Google Sheets data fetched for ${sheet.name} (${csvText.length} bytes)`);
      
      //~ save raw CSV data
      const outputPath = `${SHEETS_RAW_DATA_PREFIX}${sheet.name}.csv`;
      await fs.writeFile(outputPath, csvText);
      console.log(`💾 Saved raw CSV to ${outputPath}`);
      
      //~ show sample CSV struct
      console.log(`\n🔍 Google Sheets CSV Sample for ${sheet.name}:`);
      const lines = csvText.split('\n');
      const headerLine = lines[0];
      console.log(`Headers: ${headerLine}`);
      
      if (lines.length > 1) {
        console.log(`First Data Row: ${lines[1]}`);
      }
      
      console.log(`📊 Found ${lines.length - 1} data rows in CSV`);
    } catch (error) {
      console.error(`❌ Error fetching Google Sheets data for ${sheet.name}:`, error);
    }
  }
}

async function main() {
  try {
    await setupDirectories();
    await fetchGoogleMapsData();
    await fetchGoogleSheetsData();
    console.log('✅ All data fetched and saved successfully');
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

main();
