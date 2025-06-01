#!/usr/bin/env node

//* script: direct facility type assignment w fixed distribution
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//& get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//& file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const ENRICHED_GEOJSON = path.join(DATA_DIR, 'enriched.geojson');
const FIXED_GEOJSON = path.join(DATA_DIR, 'enriched-fixed-types.geojson');

//~ facility types w fixed distribution
const FACILITY_TYPES = [
  { name: 'Mall', weight: 30 },     //~ shopping malls & centers (30%)
  { name: 'Hotel', weight: 20 },    //~ hotels & resorts (20%)
  { name: 'Public', weight: 25 },   //~ public facilities like MRTs, parks, etc. (25%)
  { name: 'Restaurant', weight: 15 },  //~ restaurants, cafes, food establishments (15%)
  { name: 'Office', weight: 10 }    //~ office buildings, complexes (10%)
];

//~ words that strongly indicate specific facility type
const TYPE_INDICATORS = {
  'Mall': ['mall', 'shopping', 'plaza', 'center', 'centre', 'jewel', 'vivo', 'ion', 
          'paragon', 'bugis', 'junction', 'square', 'raffles', 'city', 'galleria', 
          'market', 'megamall', 'emporium', 'shoppes', 'outlet'],
  
  'Hotel': ['hotel', 'resort', 'inn', 'suites', 'lodge', 'residence', 'service apartment', 
            'accommodation', 'ritz', 'carlton', 'hyatt', 'hilton', 'marriott', 'shangri-la', 
            'mandarin', 'sheraton', 'westin', 'four seasons', 'peninsula', 'intercontinental'],
  
  'Public': ['mrt', 'station', 'terminal', 'interchange', 'airport', 'library', 'museum', 
            'community', 'center', 'centre', 'park', 'garden', 'stadium', 'hub', 'club', 
            'government', 'town hall', 'civic', 'hospital', 'clinic', 'polyclinic', 'school',
            'university', 'college', 'institute', 'campus', 'block', 'hdb', 'public', 'toilet'],
  
  'Restaurant': ['restaurant', 'café', 'cafe', 'bistro', 'eatery', 'dining', 'food court', 
                'coffee', 'tea', 'bakery', 'pizzeria', 'grill', 'bar', 'pub', 'kitchen', 
                'hawker', 'kopitiam', 'canteen', 'fast food', 'diner'],
  
  'Office': ['office', 'tower', 'building', 'plaza', 'business', 'corporate', 'financial', 
            'center', 'centre', 'headquarters', 'hq', 'enterprise', 'commercial', 'agency', 
            'firm', 'group', 'development', 'complex', 'park', 'hub']
};

//& determine best facility type based on name & address
function determineFacilityType(location) {
  //~ get name & address in lowercase fr matching
  const name = (location.name || '').toLowerCase();
  const address = (location.address || '').toLowerCase();
  const searchText = `${name} ${address}`;
  
  //~ first check fr each type's keywords
  for (const [type, keywords] of Object.entries(TYPE_INDICATORS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return type;
      }
    }
  }
  
  //~ check fr more specific patterns
  if (name.includes('toilet') || name.includes('restroom') || name.includes('bathroom')) {
    //~ toilet in name usually indicate public facility
    return 'Public';
  }
  
  //~ if no match found, use weighted random assignment
  const totalWeight = FACILITY_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const type of FACILITY_TYPES) {
    random -= type.weight;
    if (random <= 0) {
      return type.name;
    }
  }
  
  return 'Mall'; //~ default fallback
}

//& main func: fix facility types
async function fixFacilityTypes() {
  console.log('🚀 Starting facility type fixing...');
  
  try {
    //~ read enriched data
    console.log('📂 Reading enriched data file...');
    const enrichedData = await fs.readFile(ENRICHED_GEOJSON, 'utf-8')
      .then(data => JSON.parse(data))
      .catch(err => {
        console.error(`❌ Error reading enriched data: ${err.message}`);
        return { type: 'FeatureCollection', features: [] };
      });
    
    if (!enrichedData.features || enrichedData.features.length === 0) {
      console.error('❌ No features found in enriched data.');
      return;
    }
    
    console.log(`📊 Found ${enrichedData.features.length} locations to fix.`);
    
    //~ track stats
    const stats = {
      total: enrichedData.features.length,
      changed: 0,
      typeDistribution: {}
    };
    
    //~ process each feature
    const fixed = {
      ...enrichedData,
      features: enrichedData.features.map((feature, index) => {
        const { properties } = feature;
        
        //~ log sample data
        if (index < 10) {
          console.log(`Location #${index + 1}: ${properties.name}`);
          console.log(`  Original type: ${properties.type || 'unknown'}`);
        }
        
        //~ extract location info fr type determination
        const location = {
          name: properties.name,
          address: properties.address,
          type: properties.type
        };
        
        //~ determine appropriate facility type
        const newType = determineFacilityType(location);
        
        //~ update stats
        if (properties.type !== newType) {
          stats.changed++;
        }
        
        stats.typeDistribution[newType] = (stats.typeDistribution[newType] || 0) + 1;
        
        //~ log change fr samples
        if (index < 10) {
          console.log(`  New type: ${newType}`);
        }
        
        //~ return updated feature
        return {
          ...feature,
          properties: {
            ...properties,
            type: newType
          }
        };
      })
    };
    
    //~ save fixed data
    console.log('💾 Saving fixed facility type data...');
    await fs.writeFile(FIXED_GEOJSON, JSON.stringify(fixed, null, 2));
    
    //~ calculate percentages
    const typePercentages = {};
    Object.entries(stats.typeDistribution).forEach(([type, count]) => {
      typePercentages[type] = Math.round((count / stats.total) * 100);
    });
    
    //~ report statistics
    console.log('\n📊 Facility Type Fix Statistics:');
    console.log(`- Total locations: ${stats.total}`);
    console.log(`- Updated types: ${stats.changed}`);
    console.log('- Type distribution:');
    
    Object.entries(stats.typeDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = Math.round((count / stats.total) * 100);
        console.log(`  ${type}: ${count} locations (${percentage}%)`);
      });
    
    console.log('\n✅ Facility type fixing completed successfully!');
    console.log(`📝 Fixed data saved to: ${FIXED_GEOJSON}`);
    console.log('To use the fixed data, run the following command:');
    console.log(`cp ${FIXED_GEOJSON} ${ENRICHED_GEOJSON}`);
    
  } catch (error) {
    console.error(`❌ Error during facility type fixing: ${error.message}`);
    console.error(error.stack);
  }
}

fixFacilityTypes();
