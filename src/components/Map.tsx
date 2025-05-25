import React from 'react';

//* basic map component using react-leaflet
const Map = () => {
  return (
    <div className="h-[50vh] md:h-[70vh] w-full">
      {/* Leaflet map */}
      <div className="flex items-center justify-center h-full bg-gray-100 border border-gray-300 rounded-lg">
        <p className="text-gray-500">Map will be implemented with Leaflet</p>
      </div>
    </div>
  );
};

export default Map;
