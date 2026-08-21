'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ToiletLocation } from '@/lib/data/shared/types';
import { fetchLocations, filterLocations } from '@/lib/data/client';
import FilterBar from '../components/FilterBar';
import ListView from '../components/ListView';
import ThemeToggle from '../components/ThemeToggle';

interface FilterOptions {
  region: string;
  type: string;
  amenities: {
    wheelchairAccess: boolean;
    babyChanging: boolean;
    unisex: boolean;
  };
}

//& dynamically import map components prevent SSR issues
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[50vh] md:h-[70vh] w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
      <p>Loading map...</p>
    </div>
  ),
});

export default function Home() {
  const [allLocations, setAllLocations] = useState<ToiletLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<ToiletLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ToiletLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
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
        //~ stale mock-data fallback removed - show an empty state instead of fake toilets
        setAllLocations([]);
        setFilteredLocations([]);
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
      //~ filterbar uses '' fr 'all' options, nt the string 'All' - pass undefined whn empty
      region: filters.region || undefined,
      type: filters.type || undefined,
      amenities: {
        wheelchairAccess: filters.amenities.wheelchairAccess,
        babyChanging: filters.amenities.babyChanging,
        unisex: filters.amenities.unisex
      }
    });
    
    //~ clear selected location whn filters change, prevent map frm re-centering on prev select
    setSelectedLocation(null);
    setFilteredLocations(filtered);
  };
  
  //& calculate stats fr header
  const totalLocations = allLocations.length;
  const filteredCount = filteredLocations.length;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity" title="About TWB">
              TWB
            </Link>
          </h1>
          <div className="flex items-center gap-4">
            {!isLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {filteredCount} of {totalLocations} locations
              </p>
            )}
            <ThemeToggle />
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
              <p className="mt-2 text-gray-600 dark:text-gray-300">Loading toilet locations...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Map 
                locations={filteredLocations} 
                selectedLocation={selectedLocation} 
                onSelectLocation={handleLocationSelect}
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
      
      <footer className="bg-white dark:bg-gray-800 shadow-inner mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-300">
          <p>© {new Date().getFullYear()} TWB - Toilets with Bidets</p>
          <p className="mt-1">
            <a 
              href="https://bit.ly/shondoe11-twb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
