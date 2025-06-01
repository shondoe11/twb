'use client';
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { ToiletLocation } from '@/lib/types-compatibility';

//& fix fr leaflet marker icon in next.js
const Map = ({ 
  locations = [], 
  selectedLocation = null 
}: { 
  locations?: ToiletLocation[],
  selectedLocation?: ToiletLocation | null 
}) => {
  //~ track if map is rdy to prevent early interaction issues
  const [mapReady, setMapReady] = useState(false);
  
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
      
      //~ mark map as rdy aft icons loaded
      setMapReady(true);
    });
  }, []);

  //& default center is singapore
  const singaporeCenter: LatLngExpression = [1.3521, 103.8198];
  const defaultZoom = 12;
  
  //& custom icons fr diff toilet types
  const customIcons = useMemo(() => {
    //~ create icons whn component mounts
    const createDivIcon = (color: string, hasBidet: boolean) => {
      return L.divIcon({
        html: `<div class="marker-icon" style="background-color: ${color}; position: relative;">
                ${hasBidet ? '<span style="position: absolute; top: 3px; right: 3px; font-size: 8px;">💦</span>' : ''}
              </div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
        tooltipAnchor: [14, -14]
      });
    };
    
    return {
      mall: {
        bidet: createDivIcon('#3b82f6', true), //~ blue
        standard: createDivIcon('#3b82f6', false)
      },
      hotel: {
        bidet: createDivIcon('#8b5cf6', true), //~ purple
        standard: createDivIcon('#8b5cf6', false)
      },
      public: {
        bidet: createDivIcon('#10b981', true), //~ green
        standard: createDivIcon('#10b981', false)
      },
      default: {
        bidet: createDivIcon('#f59e0b', true), //~ amber
        standard: createDivIcon('#f59e0b', false)
      }
    };
  }, []);
  
  //& fn get appropriate icon fr location
  const getMarkerIcon = (location: ToiletLocation) => {
    const type = location.type?.toLowerCase() || 'default';
    const hasBidet = location.hasBidet;
    
    //~ select icon based on type & bidet avail
    if (type === 'mall') {
      return hasBidet ? customIcons.mall.bidet : customIcons.mall.standard;
    } else if (type === 'hotel') {
      return hasBidet ? customIcons.hotel.bidet : customIcons.hotel.standard;
    } else if (type === 'public') {
      return hasBidet ? customIcons.public.bidet : customIcons.public.standard;
    } else {
      return hasBidet ? customIcons.default.bidet : customIcons.default.standard;
    }
  };
  
  //& create cluster icon whn markers grouped
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createClusterCustomIcon = (cluster: any) => {
    return L.divIcon({
      html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(40, 40, true)
    });
  };

  //& component: center map on selected location & handle map updates
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
    //~ only run this whn selectedLocation changes, not on every map change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocation]); 
    
    //~ ensure map updates whn locations change (fr filtering)
    useEffect(() => {
      //~ force map size recalculations & invalidate if locations change: ensure popups render correctly aft filtering
      map.invalidateSize();
    }, [map]);
    
    //~ react to locations change - using key to track changes
    const locationsKey = locations.map(loc => loc.id).join(','); //~ create key frm location IDs
    useEffect(() => {
      //~ invalidate size again whn locations list changes
      map.invalidateSize();
      
      //~ force leaflet recalculate bounds & redraw
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }, [map, locationsKey]);
    
    //~ improved map event handlers to ensure popups work properly
    useEffect(() => {
      //~ type-safe event handler fr popup events
      const handlePopupOpen = (e: { popup: L.Popup }) => {
        //~ ensure popup content rendered
        const popup = e.popup;
        if (popup && !popup.getContent()) {
          //~ if popup no content, try refresh
          popup.update();
        }
      };
      
      //~ empty event handler fr popup close
      const handlePopupClose = () => {
        //~ do nothing but capture event
      };
      
      map.on('popupopen', handlePopupOpen);
      map.on('popupclose', handlePopupClose);
      
      return () => {
        map.off('popupopen', handlePopupOpen);
        map.off('popupclose', handlePopupClose);
      };
    }, [map]);
    
    return null;
  };
  
  //~ helper: format opening hours fr display
  const formatOpeningHours = (hours?: string) => {
    if (!hours) return 'No hours available';
    return hours;
  };
  
  //~ helper: render star rating - memoized to prevent rerenders
  const renderRating = useCallback((rating?: number) => {
    if (!rating) return '';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center mt-1">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`star-${i}`} className="text-yellow-500">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500">★</span>}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300">★</span>
        ))}
        <span className="ml-1 text-xs">{rating.toFixed(1)}</span>
      </div>
    );
  }, []);
  
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
        
        {/* cluster markers fr better performance & UX */}
        <MarkerClusterGroup 
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          maxClusterRadius={50}
        >
          {/* only render markers once map rdy */}
          {mapReady && locations.map((location) => {
            //~ popup content outside component: reduce rerenders
            const popupContent = (
              <div className="p-1">
                {/* basic info w null checks */}
                <h3 className="font-medium text-base">{location.name || 'Unknown Location'}</h3>
                {location.address && <p className="text-sm">{location.address}</p>}
                
                {/* show rating if avail */}
                {location.rating !== undefined && renderRating(location.rating)}
                
                {/* facility deets */}
                <div className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
                  <p><span className="font-medium">Type:</span> {location.type || 'Other'}</p>
                  <p><span className="font-medium">Region:</span> {location.region || 'Unknown'}</p>
                </div>
                
                {/* amenities w icons */}
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Amenities:</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {/* safely check fr bidet */}
                    {location.hasBidet && (
                      <span className="px-2 py-1 bg-blue-100 rounded-full text-blue-800">💦 Bidet</span>
                    )}
                    {/* safely check fr amenities obj & its props */}
                    {location.amenities && (
                      <>
                        {location.amenities.wheelchairAccess && (
                          <span className="px-2 py-1 bg-green-100 rounded-full text-green-800">♿ Wheelchair</span>
                        )}
                        {location.amenities.babyChanging && (
                          <span className="px-2 py-1 bg-purple-100 rounded-full text-purple-800">👶 Baby Station</span>
                        )}
                        {location.amenities.freeEntry && (
                          <span className="px-2 py-1 bg-yellow-100 rounded-full text-yellow-800">🆓 Free Entry</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* opening hrs if avail */}
                {(location.openingHours || location.normalizedHours) && (
                  <div className="mt-2">
                    <p className="text-xs font-medium">Hours:</p>
                    <p className="text-xs">{formatOpeningHours(location.normalizedHours || location.openingHours)}</p>
                  </div>
                )}
                
                {/* notes if avail */}
                {location.notes && (
                  <div className="mt-2">
                    <p className="text-xs font-medium">Notes:</p>
                    <p className="text-xs italic">{location.notes}</p>
                  </div>
                )}
                
                {/* nav link */}
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <span>📍 Get Directions</span>
                  </a>
                </div>
              </div>
            );
            
            //~ tooltip content: prevent rerenders
            const tooltipText = `${location.name}${location.hasBidet ? ' • Has Bidet' : ''}`;
            
            return (
              <Marker 
                key={`marker-${location.id}-${location.type || 'unknown'}`}
                position={[location.lat, location.lng]}
                icon={getMarkerIcon(location)}
                eventHandlers={{
                  click: () => {}, //~ empty handler prevent issues
                  mouseover: () => {}, //~ empty handler prevent issues
                }}
              >
                {/* simplified popup w reduced rerenders */}
                <Popup 
                  minWidth={200} 
                  maxWidth={300}
                  className="custom-popup"
                  closeButton={true}
                  autoPan={true} //~ enable auto panning ensure popup visible
                >
                  {/* wrap in stable container ensure rendering */}
                  <div key={`popup-${location.id}`} className="popup-content-wrapper">
                    {popupContent}
                  </div>
                </Popup>
                
                <div className="marker-tooltip">{tooltipText}</div>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default Map;
