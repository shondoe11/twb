import { ToiletLocation, GeoJSONData, DATA_SOURCES, DATA_PATHS } from '../shared/types';
import fs from 'fs/promises';
import path from 'path';

//& helper func: check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

//& server-side funcs: fetch data frm files/external srcs

/*
 * Read combined geojson file frm data dir
 */
export async function readCombinedGeoJSON(): Promise<GeoJSONData> {
  try {
    const dataDir = path.join(process.cwd(), DATA_PATHS.DATA_DIR);
    const filePath = path.join(dataDir, 'combined.geojson');
    
    //~ check if file exists
    if (!(await fileExists(filePath))) {
      //~ if file doesn't exist, return empty geojson collection
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
    
    //~ read & parse file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading combined geojson:', error);
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
}

/*
 * read toilet locations frm JSON file
 */
export async function readToiletLocations(): Promise<ToiletLocation[]> {
  try {
    const dataDir = path.join(process.cwd(), DATA_PATHS.DATA_DIR);
    const filePath = path.join(dataDir, 'toilets.json');
    
    //~ check if file exists
    if (!(await fileExists(filePath))) {
      //~ if file doesn't exist, return empty array
      return [];
    }
    
    //~ read & parse file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading toilet locations:', error);
    return [];
  }
}

/*
 * fetch CSV data directly frm Google Sheets (backup method)
 */
export async function fetchFromGoogleSheets(): Promise<string> {
  try {
    //~ use node-fetch or similar in Node.js environment
    const response = await fetch(DATA_SOURCES.SHEETS_CSV_URL, {
      headers: {
        'User-Agent': 'TWB-Data-Fetcher/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheets data: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    throw error;
  }
}

/*
 * fetch KML data directly frm Google Maps (backup method)
 */
export async function fetchFromGoogleMaps(): Promise<string> {
  try {
    //~ use node-fetch or similar in Node.js environment
    const response = await fetch(DATA_SOURCES.MAPS_KML_URL, {
      headers: {
        'User-Agent': 'TWB-Data-Fetcher/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch KML data: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching from Google Maps:', error);
    throw error;
  }
}
