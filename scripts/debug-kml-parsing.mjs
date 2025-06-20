import fetch from 'node-fetch';
import fs from 'fs/promises';

const GOOGLE_MAPS_ID = '1QEJocnDLq-vO8XRTOfRa50sFfJ3tLns0';
const MAPS_KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${GOOGLE_MAPS_ID}`;
const KML_DEBUG_FILE = './data/debug-kml.xml';
const MAPS_DEBUG_FILE = './data/debug-maps.json';

async function debugKmlParsing() {
  try {
    console.log('🔄 Fetching KML data from Google Maps...');
    const response = await fetch(MAPS_KML_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const kmlText = await response.text();
    console.log(`✅ KML data fetched successfully (${kmlText.length} bytes)`);
    
    //~ save raw KML fr inspection
    await fs.writeFile(KML_DEBUG_FILE, kmlText);
    console.log(`💾 Saved raw KML to ${KML_DEBUG_FILE}`);
    
    //~ show snippet of KML fr structure analysis
    console.log('\n🔍 KML Structure Sample:');
    console.log(kmlText.substring(0, 1000) + '...');
    
    //~ debug proper tag names by checking occurrences
    const nameTagCount = (kmlText.match(/<name>/gi) || []).length;
    const nTagCount = (kmlText.match(/<n>/gi) || []).length;
    console.log(`\n📊 Tag counts:\n- <name> tags: ${nameTagCount}\n- <n> tags: ${nTagCount}`);
    
    //~ test parsing w correct tag patterns
    const placemarks = [];
    const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    let match;
    
    while ((match = regex.exec(kmlText)) !== null) {
      const placemark = match[1];
      
      //~ try both name patterns - use <n> tag since found in KML
      const nameMatch = /<n>(.*?)<\/n>/i.exec(placemark);
      
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      
      //~ extract coords
      const coordsMatch = /<coordinates>(.*?)<\/coordinates>/i.exec(placemark);
      if (coordsMatch) {
        const coordsStr = coordsMatch[1].trim();
        const [lng, lat] = coordsStr.split(',').map(parseFloat);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          placemarks.push({
            name,
            lat,
            lng,
            source: nameMatch ? '<name>' : (altNameMatch ? '<n>' : 'unknown')
          });
        }
      }
    }
    
    console.log(`\n🗺️ Parsed ${placemarks.length} placemarks from KML`);
    
    //? show 1st 5 placemarks fr debugging
    console.log('\n📍 First 5 placemarks:');
    placemarks.slice(0, 5).forEach((p, i) => {
      console.log(`${i+1}. "${p.name}" [${p.lat}, ${p.lng}] (tag: ${p.source})`);
    });
    
    //~ save parsed data
    const mappedPlacemarks = {};
    placemarks.forEach(p => {
      mappedPlacemarks[p.name] = [p.lng, p.lat];
    });
    
    await fs.writeFile(MAPS_DEBUG_FILE, JSON.stringify({
      placemarks: placemarks.slice(0, 20),
      totalCount: placemarks.length,
      mappedLocations: mappedPlacemarks
    }, null, 2));
    
    console.log(`\n💾 Saved parsed placemark data to ${MAPS_DEBUG_FILE}`);
    
    return placemarks;
  } catch (error) {
    console.error('❌ Error in KML debug:', error);
  }
}

debugKmlParsing().catch(console.error);
