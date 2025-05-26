'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ToiletLocation } from '../lib/types';

//& fix fr leaflet marker icon in next.js
const Map = ({ 
  locations = [], 
  selectedLocation = null 
}: { 
  locations?: ToiletLocation[],
  selectedLocation?: ToiletLocation | null 
}) => {
  //& workaround fr leaflet marker icon issues in next.js
  useEffect(() => {
    //~ fix leaflet default icon issue in next.js
    import('leaflet').then((L) => {
      // @ts-expect-error: leaflet's typings r nt accurate here
      delete L.Icon.Default.prototype._getIconUrl;
      
      L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/marker-icon-2x.png',
      iconUrl: '/images/marker-icon.png',
      shadowUrl: '/images/marker-shadow.png',
    });
    });
  }, []);

  //& default center is singapore
  const singaporeCenter: LatLngExpression = [1.3521, 103.8198];
  const defaultZoom = 12;

  //TODO: implement custom icon whn toilet marker image is avail
  /* 
  const toiletIcon = new Icon({
    iconUrl: '/images/toilet-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
  */

  //& component to center map on selected location
  const MapUpdater = () => {
    const map = useMap();
    
    //& use selectedLocation frm props to center map
    useEffect(() => {
      if (selectedLocation) {
        map.setView(
          [selectedLocation.lat, selectedLocation.lng],
          15,  //~ higher zoom level fr selected location
          { animate: true }
        );
      }
    }, [map]);
    
    return null;
  };
  
  return (
    <div className="h-[50vh] md:h-[70vh] w-full rounded-lg overflow-hidden">
      <MapContainer 
        center={singaporeCenter} 
        zoom={defaultZoom} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* component: handle centering map on selected location */}
        <MapUpdater />
        
        {locations.map((location) => (
          <Marker 
            key={location.id}
            position={[location.lat, location.lng]}
            //~ use custom icon whn image is avail
            // icon={toiletIcon}
          >
            <Popup>
              <div>
                <h3 className="font-medium">{location.name}</h3>
                <p className="text-sm">{location.address}</p>
                <p className="text-xs mt-1">
                  <span className="font-medium">Type:</span> {location.type}
                </p>
                <p className="text-xs">
                  <span className="font-medium">Region:</span> {location.region}
                </p>
                {location.notes && (
                  <p className="text-xs mt-1 italic">{location.notes}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default Map;
