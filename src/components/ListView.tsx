import React, { useState } from 'react';
import { ToiletLocation } from '../lib/types';

//& filterable list component fr displaying toilet locations
const ListView = ({ 
  locations = [],
  onSelectLocation
}: { 
  locations?: ToiletLocation[], 
  onSelectLocation?: (location: ToiletLocation) => void 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  //& filter locations based on search term
  const filteredLocations = locations.filter(location => 
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.address.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search locations..."
          className="w-full p-2 border border-gray-300 rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="space-y-2 max-h-[60vh] overflow-y-auto location-list">
        {filteredLocations.length === 0 && (
          <p className="text-center text-gray-500 py-4">
            {locations.length === 0 
              ? 'No locations available yet' 
              : 'No matches found'}
          </p>
        )}
        
        {filteredLocations.map((location) => (
          <div 
            key={location.id}
            className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelectLocation && onSelectLocation(location)}
          >
            <h3 className="font-medium">{location.name}</h3>
            <p className="text-sm text-gray-600 mb-1">{location.address}</p>
            <div className="flex justify-between">
              <p className="text-xs text-gray-500">Region: {location.region}</p>
              <p className="text-xs text-gray-500">Type: {location.type}</p>
            </div>
            
            {/* amenities icons */}
            <div className="mt-2 flex gap-2">
              {location.hasBidet && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Bidet</span>
              )}
              {location.amenities.wheelchairAccess && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">♿</span>
              )}
              {location.amenities.babyChanging && (
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">👶</span>
              )}
              {location.amenities.freeEntry && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Free</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ListView;
