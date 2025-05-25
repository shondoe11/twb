import { ToiletLocation } from './types';

//* utility funcs: fetch & parse data frm Google Sheets
const GOOGLE_SHEETS_ID = '1jAMaD3afMfA19U2u1aRLkL0M-ufFvz1fKDpT_BraOfY';
const SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=csv`;


//& fetches toilet location data frm Google Sheets CSV export
export async function fetchSheetsData(): Promise<ToiletLocation[]> {
  try {
    const response = await fetch(SHEETS_CSV_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheets data: ${response.status}`);
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return [];
  }
}

//& parse CSV text into ToiletLocation objects
function parseCSV(csvText: string): ToiletLocation[] {
  //~ simple csv parser - will be enhanced w proper field mapping
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map((line, index) => {
    const values = line.split(',');
    const record: Record<string, any> = {};
    
    headers.forEach((header, i) => {
      record[header.trim()] = values[i]?.trim() || '';
    });
    
    //~ convert to ToiletLocation format - field mapping need to adjust based on actual CSV structure
    return {
      id: record.id || `location-${index}`,
      name: record.name || '',
      address: record.address || '',
      region: record.region || '',
      type: record.type || '',
      lat: parseFloat(record.latitude) || 0,
      lng: parseFloat(record.longitude) || 0,
      hasBidet: record.hasBidet === 'true' || record.hasBidet === 'yes' || false,
      amenities: {
        wheelchairAccess: record.wheelchairAccess === 'true' || record.wheelchairAccess === 'yes' || false,
        babyChanging: record.babyChanging === 'true' || record.babyChanging === 'yes' || false,
        freeEntry: record.freeEntry === 'true' || record.freeEntry === 'yes' || false,
      },
      notes: record.notes || '',
      lastUpdated: record.lastUpdated || new Date().toISOString(),
    };
  }).filter(item => item.name); //~ filter out empty rows
}

export default fetchSheetsData;
