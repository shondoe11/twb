'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ToiletLocation } from '../lib/types';
import FilterBar from '../components/FilterBar';
import ListView from '../components/ListView';

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
  const [locations, setLocations] = useState<ToiletLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ToiletLocation | null>(null);
  
  //& load mock data client side
  useEffect(() => {
    //~ in future, fetch frm API / data files
    setLocations(mockLocations);
  }, []);
  
  //& handler fr location selection
  const handleLocationSelect = (location: ToiletLocation) => {
    setSelectedLocation(location);
    //~ add functionality to center map on this location
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">TWB</h1>
          <p className="text-sm text-gray-600">Toilets with Bidets</p>
        </div>
      </header>
      
      <main className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Map 
              locations={locations} 
              selectedLocation={selectedLocation} 
            />
          </div>
          
          <div className="space-y-4">
            <FilterBar />
            <ListView 
              locations={locations} 
              onSelectLocation={handleLocationSelect} 
            />
          </div>
        </div>
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
