import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

//& serve location data frm generated geojson files
export async function GET() {
  try {
    //~ try read combined geojson file
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'combined.geojson');
    
    //~ check file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      //~ if file not exist, return empty geojson collection
      return NextResponse.json({
        type: 'FeatureCollection',
        features: []
      });
    }
    
    //~ read & parse file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const geoData = JSON.parse(fileContent);
    
    //~ return geojson data
    return NextResponse.json(geoData);
  } catch (error) {
    console.error('Error serving location data:', error);
    
    //~ return 500 error w msg
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch location data' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
