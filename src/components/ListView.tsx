import React, { useState, useMemo } from 'react';
import { ToiletLocation } from '@/lib/data/shared/types';

//& filterable list component fr displaying toilet locations
const ListView = ({ 
  locations = [],
  onSelectLocation
}: { 
  locations?: ToiletLocation[], 
  onSelectLocation?: (location: ToiletLocation) => void 
}) => {
  //& search filtering
  const [searchTerm, setSearchTerm] = useState('');
  
  //& sorting options
  const [sortBy, setSortBy] = useState<'name' | 'region' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  //& gender filter
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'any'>('all');
  
  //& bidet filter
  const [bidetFilter, setBidetFilter] = useState<boolean | null>(null);
  
  //& filter locations -> search term, gender, bidet
  const filteredLocations = locations.filter(location => {
    const searchLower = searchTerm.toLowerCase();
    
    //~ search term filters
    const matchesSearch = (
      location.name.toLowerCase().includes(searchLower) ||
      (location.address?.toLowerCase() || '').includes(searchLower) ||
      (location.region?.toLowerCase() || '').includes(searchLower)
    );
    
    //~ gender filters
    let matchesGender = true;
    if (genderFilter !== 'all') {
      if (genderFilter === 'male') {
        matchesGender = location.gender === 'male';
      } else if (genderFilter === 'female') {
        matchesGender = location.gender === 'female';
      } else if (genderFilter === 'any') {
        matchesGender = !location.gender || location.gender === 'any';
      }
    }
    
    //~ bidet filters
    let matchesBidet = true;
    if (bidetFilter !== null) {
      matchesBidet = location.hasBidet === bidetFilter;
    }
    
    return matchesSearch && matchesGender && matchesBidet;
  });
  
  //~ opening hrs formatter
  const formatOpeningHours = (hours?: string) => {
    if (!hours) return 'Hours not available';
    return hours;
  };
  
  //~ render star rating
  const renderRating = (rating?: number) => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`star-${i}`} className="text-yellow-500 text-sm">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500 text-sm">★</span>}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 dark:text-gray-600 text-sm">★</span>
        ))}
        <span className="ml-1 text-xs text-gray-700 dark:text-gray-300">{rating.toFixed(1)}</span>
      </div>
    );
  };
  
  //~ sorting logic
  const sortedLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'region') {
        comparison = (a.region || '').localeCompare(b.region || '');
      } else if (sortBy === 'rating') {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        comparison = ratingA - ratingB;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLocations, sortBy, sortOrder]);
  
  //~ toggle sort order
  const toggleSort = (field: 'name' | 'region' | 'rating') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };
  
  //~ render sort indicator arrow
  const renderSortIndicator = (field: 'name' | 'region' | 'rating') => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* search bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
        <input
          type="text"
          placeholder="Search locations..."
          className="w-full p-2 border border-gray-300 rounded dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* sorting ctrls */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Sort by:</span>
        <button 
          onClick={() => toggleSort('name')} 
          className={`px-3 py-1 text-xs rounded-full ${sortBy === 'name' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
        >
          Name{renderSortIndicator('name')}
        </button>
        <button 
          onClick={() => toggleSort('region')} 
          className={`px-3 py-1 text-xs rounded-full ${sortBy === 'region' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
        >
          Region{renderSortIndicator('region')}
        </button>
        <button 
          onClick={() => toggleSort('rating')} 
          className={`px-3 py-1 text-xs rounded-full ${sortBy === 'rating' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
        >
          Rating{renderSortIndicator('rating')}
        </button>
      </div>

      {/* gender & bidet filters */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Gender:</span>
          <button 
            onClick={() => setGenderFilter('all')} 
            className={`px-3 py-1 text-xs rounded-full ${genderFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            All
          </button>
          <button 
            onClick={() => setGenderFilter('male')} 
            className={`px-3 py-1 text-xs rounded-full ${genderFilter === 'male' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            Male
          </button>
          <button 
            onClick={() => setGenderFilter('female')} 
            className={`px-3 py-1 text-xs rounded-full ${genderFilter === 'female' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            Female
          </button>
          <button 
            onClick={() => setGenderFilter('any')} 
            className={`px-3 py-1 text-xs rounded-full ${genderFilter === 'any' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            Gender-Neutral
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Bidet:</span>
          <button 
            onClick={() => setBidetFilter(null)} 
            className={`px-3 py-1 text-xs rounded-full ${bidetFilter === null ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            Any
          </button>
          <button 
            onClick={() => setBidetFilter(true)} 
            className={`px-3 py-1 text-xs rounded-full ${bidetFilter === true ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            Has Bidet
          </button>
          <button 
            onClick={() => setBidetFilter(false)} 
            className={`px-3 py-1 text-xs rounded-full ${bidetFilter === false ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            No Bidet
          </button>
        </div>
      </div>
      
      {/* locations list */}
      <div className="location-list max-h-[60vh] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
        {sortedLocations.length === 0 ? (
          <div className="p-4 text-center text-gray-800 dark:text-gray-200">
            {locations.length === 0 ? 'No locations available' : 'No matching locations found'}
          </div>
        ) : (
          sortedLocations.map((location, index) => (
            <div 
              key={`loc-${index}-${(location.id || '').replace(/^location-/, '')}-${(location.lat || 0).toFixed(5)}-${(location.lng || 0).toFixed(5)}`}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer flex flex-col md:flex-row gap-3 text-gray-800 dark:text-gray-100"
              onClick={() => onSelectLocation?.(location)}
            >
              {/* img if avail */}
              {location.imageUrl && (
                <div className="w-full md:w-24 h-24 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={location.imageUrl} 
                    alt={location.name} 
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      //~ set fallback img on err
                      (e.target as HTMLImageElement).src = '/images/toilet-placeholder.jpg';
                    }}
                  />
                </div>
              )}
              
              {/* content */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium">{location.name}</h3>
                  {renderRating(location.rating)}
                </div>
                
                {/* //~ always show non-empty addresses even if same as location name */}
                {location.address && location.address.trim() !== '' && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1" style={{ wordBreak: 'break-word' }}>
                    {location.address}
                  </p>
                )}
                
                {/* opening hrs if avail */}
                {location.openingHours && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span className="font-medium">Hours:</span> {formatOpeningHours(location.openingHours)}
                  </p>
                )}
                
                <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{location.region}</span>
                  
                  <div className="flex flex-wrap gap-1">
                    {location.hasBidet && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">Bidet</span>
                    )}
                    {location.amenities?.wheelchairAccess && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">♿</span>
                    )}
                    {location.amenities?.babyChanging && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full">👶</span>
                    )}
                    {location.amenities?.unisex && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">Unisex</span>
                    )}
                    {location.amenities?.bidetInAllCubicles && (
                      <span className="text-xs px-2 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 rounded-full">All Cubicles</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListView;
