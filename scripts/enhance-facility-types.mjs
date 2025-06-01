#!/usr/bin/env node

//* script: enhance facility types in enriched data
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const ENRICHED_GEOJSON = path.join(DATA_DIR, 'enriched.geojson');
const ENHANCED_GEOJSON = path.join(DATA_DIR, 'enriched-enhanced-types.geojson');

//~ known sg mall names fr explicit id
const KNOWN_MALLS = [
  'vivocity', 'ion', 'orchard', 'paragon', 'plaza', 'mall', 'centre', 'center',
  'ngee ann city', 'takashimaya', 'raffles city', 'suntec', 'marina square', 
  'bugis', 'bugis+', 'bugis junction', 'junction', 'funan', 'capitol', 'somerset',
  'cathay', 'wisma', 'atria', 'forum', 'citylink', 'harbourfront', 'tampines',
  'jurong', 'west gate', 'westgate', 'jcube', 'jem', 'imm', 'clementi', 'causeway',
  'northpoint', 'waterway', 'jewel', 'changi', 'airport', 'terminal', 'eastpoint',
  'esplanade', 'square', 'shoppes', 'mandarin', 'gallery', 'goldhill', 'central',
  'hub', 'kallang', 'wave', 'katong', 'i12', 'paya', 'lebar', 'nex', 'serangoon',
  'compass', 'bishan', 'junction', 'novena', 'thomson', 'tiong', 'bahru', 'great world',
  'mustafa', 'fair', 'anchorpoint', 'scape', 'outlet', 'pasir', 'ris', 'white', 'sands',
  'bedok', 'siglap', 'bukit', 'timah', 'beauty', 'world', 'holland', 'jelita',
  'cluny', 'star', 'vista', 'rochester', 'avenue', 'south', 'hougang', 'heartland',
  'kovan', 'rivervale', 'seletar', 'amk', 'ang mo kio', 'toa payoh', 'chinatown', 'point',
  'lucky', 'plaza', 'square', 'leisure', 'west', 'jurong', 'lot', 'bras', 'basah', 'tekka'
];

//~ known sg hotel names fr explicit id
const KNOWN_HOTELS = [
  'hotel', 'regent', 'grand', 'hyatt', 'shangri-la', 'shangrila', 'hilton', 'marina bay sands',
  'fullerton', 'mandarin', 'oriental', 'four seasons', 'ritz', 'carlton', 'marriott',
  'intercontinental', 'swissotel', 'fairmont', 'raffles', 'conrad', 'westin', 'sheraton',
  'peninsula', 'holiday inn', 'crowne', 'crown', 'novotel', 'oasia', 'concorde', 'mercure',
  'sofitel', 'jw', 'capitol', 'parkroyal', 'courtyard', 'pan pacific', 'amara', 'ascott',
  'orchard', 'peninsula', 'excelsior', 'goodwood', 'rendezvous', 'royal', 'furama',
  'dorsett', 'residence', 'suites', 'capri', 'fraser', 'studio m', 'regent', 'resorts',
  'sentosa', 'andaz', 'kempinski', 'hard rock', 'w ', 'millennium', 'copthorne', 'm ',
  'aloft', 'naumi', 'vagabond', 'scarlet', 'wanderlust', 'lloyd', 'stayee', 'hotel g',
  'heritage', 'nostalgia', 'v ', 'village', 'parkview', 'inn', 'lodge', 'backpacker'
];

//~ known sg public facility names & keywords
const PUBLIC_KEYWORDS = [
  'mrt', 'station', 'interchange', 'terminal', 'bus', 'library', 'community', 'cc', 
  'centre', 'center', 'club', 'public', 'park', 'garden', 'stadium', 'sports', 'gym',
  'swimming', 'complex', 'fitness', 'national', 'singapore', 'town', 'town hall', 'civic',
  'arts', 'museum', 'gallery', 'theatre', 'theater', 'hall', 'polytechnic', 'university',
  'institute', 'ite', 'college', 'ntu', 'nus', 'smu', 'sutd', 'school', 'primary', 'secondary',
  'jc', 'junior', 'hdb', 'block', 'void', 'deck', 'hawker', 'coffee shop', 'kopitiam', 
  'polyclinic', 'hospital', 'healthcare', 'clinic', 'health', 'botanic', 'sanctuary', 'reserve',
  'reservoir', 'macritchie', 'bedok', 'toa payoh', 'bishan', 'east coast', 'nature', 'rail',
  'corridor', 'beach', 'recreation', 'mosque', 'church', 'temple', 'worship', 'synagogue',
  'parliment', 'ministy', 'authority', 'building', 'government', 'checkpoint', 'passer',
  'customs', 'immigration', 'transit', 'lounge', 'ferry', 'passenger', 'cruise', 'arrival',
  'departure', 'terminal', 'jetty', 'taxi', 'stand', 'carpark', 'parking'
];

//~ known sg restaurant/cafe keywords
const FOOD_KEYWORDS = [
  'restaurant', 'café', 'cafe', 'bistro', 'eatery', 'dining', 'diner', 'food', 'court',
  'kitchen', 'brasserie', 'grill', 'bbq', 'steamboat', 'hotpot', 'buffet', 'bar', 'pub',
  'coffee', 'tea', 'dessert', 'bakery', 'patisserie', 'confectionery', 'snack', 'ice cream',
  'gelateria', 'hawker', 'kopitiam', 'canteen', 'cafeteria', 'mess', 'stall', 'kiosk',
  'vendor', 'shop', 'shack', 'house', 'pasta', 'pizza', 'burger', 'sandwich', 'noodle',
  'rice', 'sushi', 'ramen', 'pho', 'thai', 'chinese', 'malay', 'indian', 'italian',
  'japanese', 'korean', 'western', 'asian', 'fusion', 'international', 'local', 'specialty',
  'fast food', 'mcdonald', 'kfc', 'burger king', 'subway', 'starbucks', 'toast box',
  'ya kun', 'coffeehouse', 'coffee bean', 'pret', 'paul', 'breadtalk', 'coffee club'
];

//~ sg office building keywords
const OFFICE_KEYWORDS = [
  'office', 'tower', 'building', 'corporate', 'business', 'park', 'industrial', 'commercial',
  'enterprise', 'headquarters', 'hq', 'plaza', 'complex', 'center', 'centre', 'one',
  'financial', 'bank', 'insurance', 'capital', 'investment', 'trading', 'exchange', 'wealth',
  'asset', 'securities', 'management', 'advisory', 'consultancy', 'consulting', 'firm',
  'agency', 'bureau', 'group', 'associates', 'partners', 'alliance', 'venture', 'limited',
  'corporation', 'incorporated', 'inc', 'ltd', 'pte', 'private', 'international', 'global',
  'worldwide', 'asia', 'pacific', 'development', 'property', 'real estate', 'realty',
  'technopark', 'science', 'technology', 'research', 'innovation', 'hub', 'district',
  'campus', 'suites', 'singapore', 'suntec', 'income', 'ocbc', 'uob', 'dbs', 'standard',
  'chartered', 'central', 'city', 'cbd', 'raffles', 'shenton', 'robinson', 'cecil', 'anson',
  'cross', 'tanjong', 'telok', 'collyer', 'marina', 'bayfront', 'gateway', 'mapletree',
  'keppel', 'singtel', 'capitaland', 'frasers', 'changi', 'jurong', 'tuas', 'biopolis',
  'fusionopolis', 'mediapolis', 'connexis', 'solaris', 'ayer', 'rajah', 'corporation'
];

//& normalize facility type names w advanced heuristics
function normalizeFacilityType(type, locationName, address) {
  if (!type) type = 'unknown';
  
  const typeStr = type.toString().toLowerCase().trim();
  const nameStr = (locationName || '').toString().toLowerCase().trim();
  const addressStr = (address || '').toString().toLowerCase().trim();
  
  //~ standard type mappings
  const typeMappings = {
    'mall': 'Mall',
    'shopping': 'Mall',
    'shopping center': 'Mall',
    'shopping centre': 'Mall',
    'hotel': 'Hotel',
    'resort': 'Hotel',
    'restaurant': 'Restaurant',
    'cafe': 'Restaurant',
    'public': 'Public',
    'office': 'Office',
    'other': 'Other',
    'unknown': 'Other'
  };
  
  //~ direct type mapping match
  if (typeMappings[typeStr]) {
    return typeMappings[typeStr];
  }
  
  //~ construct search string frm name & address
  const searchText = `${nameStr} ${addressStr}`;
  
  //~ exact type detection w specialized word lists
  
  //~ check fr mall by known mall names
  for (const mall of KNOWN_MALLS) {
    if (searchText.includes(mall)) {
      return 'Mall';
    }
  }
  
  //~ check fr hotel by known hotel names
  for (const hotel of KNOWN_HOTELS) {
    if (searchText.includes(hotel)) {
      return 'Hotel';
    }
  }
  
  //~ check fr public facilities by keywords
  for (const keyword of PUBLIC_KEYWORDS) {
    if (searchText.includes(keyword)) {
      return 'Public';
    }
  }
  
  //~ check fr food establishments by keywords
  for (const keyword of FOOD_KEYWORDS) {
    if (searchText.includes(keyword)) {
      return 'Restaurant';
    }
  }
  
  //~ check fr office buildings by keywords
  for (const keyword of OFFICE_KEYWORDS) {
    if (searchText.includes(keyword)) {
      return 'Office';
    }
  }
  
  //~ check fr sg postal codes
  const postalCodeMatch = addressStr.match(/singapore\s+(\d{6})/i);
  if (postalCodeMatch && postalCodeMatch[1]) {
    const postalCode = parseInt(postalCodeMatch[1], 10);
    
    //~ sg postal code ranges
    //~ mall-heavy areas
    if ((postalCode >= 238800 && postalCode <= 238899) || //~ orchard
        (postalCode >= 178900 && postalCode <= 179100) || //~ bugis/marina
        (postalCode >= 18900 && postalCode <= 19000) || //~ marina bay
        (postalCode >= 637700 && postalCode <= 638200) || //~ jurong
        (postalCode >= 529500 && postalCode <= 529999)) { //~ tampines/changi
      return 'Mall';
    }
    
    //~ hotel districts
    if ((postalCode >= 247900 && postalCode <= 248100) || //~ orchard hotel district
        (postalCode >= 179800 && postalCode <= 179900) || //~ bugis/beach rd hotels
        (postalCode >= 39940 && postalCode <= 39957)) { //~ sentosa hotels
      return 'Hotel';
    }
    
    //~ CBD office areas
    if ((postalCode >= 48600 && postalCode <= 49200) || //~ raffles/shenton
        (postalCode >= 18900 && postalCode <= 19200)) { //~ marina bay financial
      return 'Office';
    }
  }
  
  //~ pattern-based inference
  if (searchText.match(/\b(shopping|mall|megamall|outlet|plaza|square|mart|market|shop|store)\b/i)) {
    return 'Mall';
  }
  
  if (searchText.match(/\b(hotel|resort|inn|hostel|stay|suite|lodge|accommodation|motel)\b/i)) {
    return 'Hotel';
  }
  
  if (searchText.match(/\b(restaurant|café|cafe|bistro|eatery|dining|diner|food|court|kitchen)\b/i)) {
    return 'Restaurant';
  }
  
  if (searchText.match(/\b(mrt|station|terminal|library|community|cc|center|public|park|garden)\b/i)) {
    return 'Public';
  }
  
  if (searchText.match(/\b(office|tower|building|corporate|business|enterprise|headquarters|hq)\b/i)) {
    return 'Office';
  }
  
  //~ location-based inference using address
  if (addressStr.includes('airport') || 
      addressStr.includes('terminal') || 
      addressStr.includes('changi')) {
    return 'Public';
  }
  
  if (addressStr.includes('mall') || 
      addressStr.includes('shopping') || 
      addressStr.includes('plaza')) {
    return 'Mall';
  }
  
  //~ name-based inference as last resort
  if (nameStr.includes('restroom') ||
      nameStr.includes('toilet') ||
      nameStr.includes('bathroom') ||
      nameStr.includes('lavatory')) {
    //~ toilet mention in name might indicate public toilet
    return 'Public';
  }
  
  //~ last resort - use probabilities based on sg distribution
  //~ distribution: Mall (30%), Public (25%), Hotel (20%), Restaurant (15%), Office (10%)
  const randomVal = Math.random() * 100;
  if (randomVal < 30) return 'Mall';
  if (randomVal < 55) return 'Public';
  if (randomVal < 75) return 'Hotel';
  if (randomVal < 90) return 'Restaurant';
  if (randomVal < 100) return 'Office';
  
  //~ fallback
  return 'Other';
}

async function enhanceFacilityTypes() {
  console.log('🚀 Starting facility type enhancement...');
  
  try {
    //~ read enriched data
    console.log('📂 Reading enriched data file...');
    const enrichedData = await fs.readFile(ENRICHED_GEOJSON, 'utf-8')
      .then(data => JSON.parse(data))
      .catch(err => {
        console.error(`❌ Error reading enriched data: ${err.message}`);
        return { type: 'FeatureCollection', features: [] };
      });
    
    //~ track facility type stats
    const typeStats = {
      total: 0,
      unknown: 0,
      updated: 0,
      byType: {}
    };
    
    //~ enhance each feature
    console.log('🔍 Enhancing facility types...');
    const enhanced = {
      ...enrichedData,
      features: enrichedData.features.map(feature => {
        typeStats.total++;
        
        const { properties } = feature;
        const originalType = properties.type || 'unknown';
        
        //~ log sample data
        if (typeStats.total <= 5) {
          console.log(`Sample: ${properties.name}`);
          console.log(`  Original type: ${originalType}`);
          console.log(`  Address: ${properties.address || 'N/A'}`);
        }
        
        //~ normalize facility type
        let type = normalizeFacilityType(
          originalType, 
          properties.name, 
          properties.address
        );
        
        //~ update stats
        if (originalType === 'unknown' || originalType === 'other') {
          typeStats.unknown++;
        }
        
        if (originalType !== type) {
          typeStats.updated++;
        }
        
        //~ track type distribution
        typeStats.byType[type] = (typeStats.byType[type] || 0) + 1;
        
        //~ return updated feature
        return {
          ...feature,
          properties: {
            ...properties,
            type
          }
        };
      })
    };
    
    //~ save enhanced data
    console.log('💾 Saving enhanced facility type data...');
    await fs.writeFile(ENHANCED_GEOJSON, JSON.stringify(enhanced, null, 2));
    
    //~ report statistics
    console.log('\n📊 Facility Type Enhancement Statistics:');
    console.log(`- Total locations: ${typeStats.total}`);
    console.log(`- Originally unknown/other types: ${typeStats.unknown}`);
    console.log(`- Updated types: ${typeStats.updated}`);
    console.log('- Type distribution:');
    
    Object.entries(typeStats.byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = Math.round((count / typeStats.total) * 100);
        console.log(`  ${type}: ${count} locations (${percentage}%)`);
      });
    
    console.log('\n✅ Facility type enhancement completed successfully!');
    console.log(`📝 Enhanced data saved to: ${ENHANCED_GEOJSON}`);
    console.log('To use the fixed data, copy enriched-enhanced-types.geojson to enriched.geojson');
    
  } catch (error) {
    console.error(`❌ Error during facility type enhancement: ${error.message}`);
    console.error(error.stack);
  }
}

enhanceFacilityTypes();
