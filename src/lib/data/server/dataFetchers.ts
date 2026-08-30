import { GeoJSONData, DATA_PATHS } from '../shared/types';
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
    
    //~ read combined.geojson only - the enriched.geojson preference was removed since enrichment scripts r manual one-offs & the stale file caused local/prod data drift
    const filePath = path.join(dataDir, 'combined.geojson');
    
    //~ check if file exists
    if (!(await fileExists(filePath))) {
      //~ if file doesn't exist, return empty geojson collection
      console.warn('No GeoJSON data files found');
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
    
    //~ read & parse file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    //~ normalize regions & types fr better display & filtering
    if (data && data.features && Array.isArray(data.features)) {
      data.features = data.features.map((feature: GeoJSONData['features'][0]) => {
        if (feature.properties) {
          //~ normalize region names match expected capitalization format
          if (!feature.properties.region || feature.properties.region === 'unknown') {
            feature.properties.region = 'Unknown';
          } else {
            //~ ensure region matches standard capitalized formats
            const regionMap: Record<string, string> = {
              'north': 'North',
              'south': 'South',
              'east': 'East',
              'west': 'West',
              'central': 'Central',
              'north-east': 'North-East',
              'northeast': 'North-East',
              'institutions': 'Institutions',
            };
            
            const lowerRegion = feature.properties.region.toLowerCase();
            if (lowerRegion in regionMap) {
              feature.properties.region = regionMap[lowerRegion];
            }
          }
          
          //~ ensure type is normalized
          if (!feature.properties.type || feature.properties.type === 'unknown') {
            feature.properties.type = 'Other';
          } else {
            //~ capitalize first letter
            feature.properties.type = 
              feature.properties.type.charAt(0).toUpperCase() + 
              feature.properties.type.slice(1).toLowerCase();
          }
        }
        return feature;
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error reading geojson data:', error);
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
}

