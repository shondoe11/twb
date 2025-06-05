'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ToiletLocation } from '@/lib/types-compatibility';
import { fetchLocations, filterLocations } from '@/lib/data/client';
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

//& dynamically import map components prevent SSR issues
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[50vh] md:h-[70vh] w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <p>Loading map...</p>
    </div>
  ),
});

const StaticGoogleMap = dynamic(() => import('../components/StaticGoogleMap'), {
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
    region: 'East',
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
    openingHours: '24 hours',
    normalizedHours: '00:00-23:59',
    imageUrl: 'https://example.com/jewel.jpg',
    rating: 4.5,
    source: 'sample-data'
  },
  {
    id: '2',
    name: 'VivoCity',
    address: '1 HarbourFront Walk, Singapore 098585',
    region: 'Central',
    type: 'mall',
    lat: 1.2640,
    lng: 103.8219,
    hasBidet: true,
    amenities: {
      wheelchairAccess: true,
      babyChanging: true,
      freeEntry: true,
    },
    notes: 'Level 3, North Wing',
    lastUpdated: '2025-05-25',
    openingHours: '10:00 AM - 10:00 PM',
    normalizedHours: '10:00-22:00',
    imageUrl: 'https://example.com/vivocity.jpg',
    rating: 4.2,
    source: 'sample-data'
  },
];

export default function Home() {
  const [allLocations, setAllLocations] = useState<ToiletLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<ToiletLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ToiletLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mapType, setMapType] = useState<'leaflet' | 'static'>('leaflet');
  
  //& load data using data svc
  useEffect(() => {
    async function loadData() {
      try {
        //~ fetch toilet locations using client data svc
        const toiletLocations = await fetchLocations();
        
        setAllLocations(toiletLocations);
        setFilteredLocations(toiletLocations);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
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
    //~ use util func frm data svc
    const filtered = filterLocations(allLocations, {
      region: filters.region !== 'All' ? filters.region : undefined,
      type: filters.type !== 'All' ? filters.type : undefined,
      amenities: {
        wheelchairAccess: filters.amenities.wheelchairAccess,
        babyChanging: filters.amenities.babyChanging,
        freeEntry: filters.amenities.freeEntry,
        hasBidet: filters.amenities.hasBidet
      }
    });
    
    setFilteredLocations(filtered);
  };
  
  //& toggle map type between leaflet & static google maps
  const toggleMapType = () => {
    setMapType(mapType === 'leaflet' ? 'static' : 'leaflet');
  };
  
  //& calculate stats fr header
  const totalLocations = allLocations.length;
  const filteredCount = filteredLocations.length;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">TWB</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMapType}
              className="text-sm px-3 py-1 border rounded-md hover:bg-gray-100 text-gray-600"
            >
              {mapType === 'leaflet' ? 'Using Leaflet (Free)' : 'Using Static Google Maps (Free)'}
            </button>
            {!isLoading && (
              <p className="text-xs text-gray-500">
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
              {mapType === 'leaflet' ? (
                <Map 
                  locations={filteredLocations} 
                  selectedLocation={selectedLocation} 
                />
              ) : (
                <StaticGoogleMap 
                  locations={filteredLocations} 
                  selectedLocation={selectedLocation} 
                />
              )}
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
