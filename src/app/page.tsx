'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ToiletLocation, GeoJSONFeature } from '../lib/types';
import FilterBar from '../components/FilterBar';
import ListView from '../components/ListView';

interface FilterOptions {
  region: string;
  type: string;
  amenities: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    freeEntry: boolean;
    hasBidet: boolean;
  };
}

//& dynamically import map component to prevent SSR issues w leaflet
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[50vh] md:h-[70vh] w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <p>Loading map...</p>
    </div>
  ),
});

//& mock data fr development until data fetching implemented
const mockLocations: ToiletLocation[] = [
  {
    id: '1',
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
    lastUpdated: '2025-05-25',
  },
  {
    id: '2',
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
    lastUpdated: '2025-05-25',
  },
];

export default function Home() {
  const [allLocations, setAllLocations] = useState<ToiletLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<ToiletLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ToiletLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  //& load real data frm generated files
  useEffect(() => {
    async function loadData() {
      try {
        //~ fetch combined geojson data frm all locations
        const response = await fetch('/api/locations');
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        
        const geoData = await response.json();
        
        //~ convert geojson features to toilet location objects
        const toiletLocations = geoData.features.map((feature: GeoJSONFeature) => {
          const { properties, geometry } = feature;
          const [lng, lat] = geometry.coordinates;
          
          return {
            id: properties.id,
            name: properties.name,
            address: properties.address || '',
            region: properties.region || 'unknown',
            type: properties.type || 'unknown',
            lat,
            lng,
            hasBidet: properties.hasBidet ?? true,
            amenities: properties.amenities || {
              wheelchairAccess: false,
              babyChanging: false,
              freeEntry: true,
            },
            notes: properties.notes || '',
            lastUpdated: properties.lastUpdated || new Date().toISOString().split('T')[0],
          };
        });
        
        setAllLocations(toiletLocations);
        setFilteredLocations(toiletLocations);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading location data:', error);
        //~ fallback mock data if fetch fail
        setAllLocations(mockLocations);
        setFilteredLocations(mockLocations);
        setIsLoading(false);
      }
    }
    
    loadData();
  }, []);
  
  //& handler fr location selection
  const handleLocationSelect = (location: ToiletLocation) => {
    setSelectedLocation(location);
    //~ add functionality to center map on this location
  };
  
  //& handle filter changes
  const handleFilterChange = (filters: FilterOptions) => {
    const filtered = allLocations.filter(location => {
      //~ region filter
      if (filters.region && location.region !== filters.region) {
        return false;
      }
      
      //~ type filter
      if (filters.type && location.type !== filters.type) {
        return false;
      }
      
      //~ amenities filter
      if (filters.amenities.wheelchairAccess && !location.amenities.wheelchairAccess) {
        return false;
      }
      
      if (filters.amenities.babyChanging && !location.amenities.babyChanging) {
        return false;
      }
      
      if (filters.amenities.freeEntry && !location.amenities.freeEntry) {
        return false;
      }
      
      if (filters.amenities.hasBidet && !location.hasBidet) {
        return false;
      }
      
      return true;
    });
    
    setFilteredLocations(filtered);
  };
  
  //& calculate stats fr header
  const totalLocations = allLocations.length;
  const filteredCount = filteredLocations.length;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">TWB</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">Toilets with Bidets</p>
            {!isLoading && (
              <p className="text-xs text-gray-500 mt-1">
                Showing {filteredCount} of {totalLocations} locations
              </p>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto py-6 px-4">
        {isLoading ? (
          <div className="h-[70vh] flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent">
                <span className="sr-only">Loading...</span>
              </div>
              <p className="mt-2 text-gray-600">Loading toilet locations...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Map 
                locations={filteredLocations} 
                selectedLocation={selectedLocation} 
              />
            </div>
            
            <div className="space-y-4">
              <FilterBar 
                locations={allLocations}
                onFilterChange={handleFilterChange} 
              />
              <ListView 
                locations={filteredLocations} 
                onSelectLocation={handleLocationSelect} 
              />
            </div>
          </div>
        )}
      </main>
      
      <footer className="bg-white shadow-inner mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} TWB - Toilets with Bidets</p>
          <p className="mt-1">
            <a 
              href="https://bit.ly/shondoe11-twb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
