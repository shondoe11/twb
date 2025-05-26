#!/usr/bin/env node

//* script: fetch data frm google sheets & maps & save to data dir
const fs = require('fs').promises;
const path = require('path');

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

//& main func
async function fetchData() {
  try {
    console.log('Creating data directory if it doesn\'t exist...');
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    console.log('Fetching data from Google Sheets...');
    // TODO: Implement CSV fetching & parsing
    // const sheetsData = await fetchSheets();
    // await fs.writeFile(SHEETS_OUTPUT, JSON.stringify(sheetsData, null, 2));
    
    console.log('Fetching data from Google My Maps...');
    // TODO: Implement KML fetching & conversion to GeoJSON
    // const mapsData = await fetchMaps();
    // await fs.writeFile(MAPS_OUTPUT, JSON.stringify(mapsData, null, 2));
    
    console.log('Data sync completed successfully!');
  } catch (error) {
    console.error('Error syncing data:', error);
    process.exit(1);
  }
}

fetchData();
