import React from 'react';

//* component fr filtering locations by region, facility type, / amenities
const FilterBar = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow mb-4">
      <h2 className="font-medium mb-2">Filters</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label htmlFor="region" className="block text-sm text-gray-600">Region</label>
          <select 
            id="region" 
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Regions</option>
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
            <option value="central">Central</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="type" className="block text-sm text-gray-600">Facility Type</label>
          <select 
            id="type" 
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Types</option>
            <option value="mall">Shopping Mall</option>
            <option value="public">Public Toilet</option>
            <option value="park">Park</option>
            <option value="restaurant">Restaurant</option>
          </select>
        </div>
        
        <div className="col-span-2">
          <p className="text-sm text-gray-600 mb-1">Amenities</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center text-sm">
              <input type="checkbox" className="mr-1" />
              Wheelchair Access
            </label>
            <label className="flex items-center text-sm">
              <input type="checkbox" className="mr-1" />
              Baby Changing
            </label>
            <label className="flex items-center text-sm">
              <input type="checkbox" className="mr-1" />
              Free Entry
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
