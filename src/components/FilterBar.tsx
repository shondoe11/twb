import React, { useState, useEffect } from 'react';
import { ToiletLocation } from '@/lib/types-compatibility';

//* filter options interface fr typesafety
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

//* component fr filtering locations by region, facility type, / amenities
const FilterBar = ({ 
  locations = [], 
  onFilterChange 
}: { 
  locations: ToiletLocation[], 
  onFilterChange: (filters: FilterOptions) => void 
}) => {
  //& default filter state
  const [filters, setFilters] = useState<FilterOptions>({
    region: '',
    type: '',
    amenities: {
      wheelchairAccess: false,
      babyChanging: false,
      freeEntry: false,
      hasBidet: false
    }
  });

  //& available regions & types frm actual data
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  
  //& extract unique regions & facility types frm locations data
  useEffect(() => {
    if (locations.length > 0) {
      //~ get unique regions & types, filtering out undefined values
      const regions = [...new Set(locations.map(loc => loc.region).filter(Boolean))];
      const types = [...new Set(locations.map(loc => loc.type).filter(Boolean))];
      
      //~ type assertion: handle string | undefined type
      setAvailableRegions(regions as string[]);
      setAvailableTypes(types as string[]);
    }
  }, [locations]);
  
  //& notify parent component whn filters change (using deps memoization)
  useEffect(() => {
    //~ prevent unnecessary re-renders by stabilizing dep
    onFilterChange(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]); //~ only depend on stringified filters
  
  //& handle region selection change
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      region: e.target.value
    }));
  };
  
  //& handle type selection change
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      type: e.target.value
    }));
  };
  
  //& handle amenity checkbox changes
  const handleAmenityChange = (amenity: keyof FilterOptions['amenities']) => {
    setFilters(prev => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity]
      }
    }));
  };
  
  //& reset all filters
  const handleReset = () => {
    setFilters({
      region: '',
      type: '',
      amenities: {
        wheelchairAccess: false,
        babyChanging: false,
        freeEntry: false,
        hasBidet: false
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-medium text-gray-800">Filters</h2>
        <button 
          onClick={handleReset}
          className="text-sm text-blue-600 hover:underline"
        >
          Reset All
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-800">Region</label>
          <select 
            id="region" 
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-800"
            value={filters.region}
            onChange={handleRegionChange}
          >
            <option value="">All Regions</option>
            {availableRegions.map(region => (
              <option key={region} value={region}>
                {region.charAt(0).toUpperCase() + region.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-800">Facility Type</label>
          <select 
            id="type" 
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-800"
            value={filters.type}
            onChange={handleTypeChange}
          >
            <option value="">All Types</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-span-2">
          <p className="text-sm font-medium text-gray-800 mb-1">Amenities</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center text-sm text-gray-800">
              <input 
                type="checkbox" 
                className="mr-1"
                checked={filters.amenities.wheelchairAccess}
                onChange={() => handleAmenityChange('wheelchairAccess')}
              />
              Wheelchair Access
            </label>
            <label className="flex items-center text-sm text-gray-800">
              <input 
                type="checkbox" 
                className="mr-1"
                checked={filters.amenities.babyChanging}
                onChange={() => handleAmenityChange('babyChanging')}
              />
              Baby Changing
            </label>
            <label className="flex items-center text-sm text-gray-800">
              <input 
                type="checkbox" 
                className="mr-1"
                checked={filters.amenities.freeEntry}
                onChange={() => handleAmenityChange('freeEntry')}
              />
              Free Entry
            </label>
            <label className="flex items-center text-sm text-gray-800">
              <input 
                type="checkbox" 
                className="mr-1"
                checked={filters.amenities.hasBidet}
                onChange={() => handleAmenityChange('hasBidet')}
              />
              Has Bidet
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
