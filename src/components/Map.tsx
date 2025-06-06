'use client';
import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
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
  
  //~ store refs to all existing markers
  const markerRefs = useRef<Record<string, L.Marker>>({});
  
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
  
  //& handle opening popup fr selected location
  useEffect(() => {
    if (mapReady && selectedLocation) {
      //~ find marker -> search thru existing marker refs
      const findMarkerForLocation = () => {
        for (const markerId in markerRefs.current) {
          //~ look fr matching location coords in marker ID
          if (markerId.includes(`-${selectedLocation.lat.toFixed(5)}-${selectedLocation.lng.toFixed(5)}`)) {
            const marker = markerRefs.current[markerId];
            if (marker) {
              //~ automatically open popup fr this marker
              marker.openPopup();
              return true;
            }
          }
        }
        return false;
      };
      
      //~ try find & open popup
      findMarkerForLocation();
    }
  }, [selectedLocation, mapReady]);
  
  //& custom icons fr diff toilet types
  const customIcons = useMemo(() => {
    //~ create icons whn component mounts
    const createDivIcon = (color: string, hasBidet: boolean, gender?: 'male' | 'female' | 'any') => {
      //~ gender symbol if specified
      const genderSymbol = gender === 'male' ? '♂️' : 
                            gender === 'female' ? '♀️' : '';
      return L.divIcon({
        html: `<div class="marker-icon" style="background-color: ${color}; position: relative;">
                ${hasBidet ? '<span style="position: absolute; top: 3px; right: 3px; font-size: 8px;">💦</span>' : ''}
                ${genderSymbol ? `<span style="position: absolute; top: 3px; left: 3px; font-size: 10px;">${genderSymbol}</span>` : ''}
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
        bidet: {
          male: createDivIcon('#3b82f6', true, 'male'), //~ blue
          female: createDivIcon('#3b82f6', true, 'female'),
          any: createDivIcon('#3b82f6', true, 'any')
        },
        standard: {
          male: createDivIcon('#3b82f6', false, 'male'),
          female: createDivIcon('#3b82f6', false, 'female'),
          any: createDivIcon('#3b82f6', false, 'any')
        }
      },
      hotel: {
        bidet: {
          male: createDivIcon('#8b5cf6', true, 'male'), //~ purple
          female: createDivIcon('#8b5cf6', true, 'female'),
          any: createDivIcon('#8b5cf6', true, 'any')
        },
        standard: {
          male: createDivIcon('#8b5cf6', false, 'male'),
          female: createDivIcon('#8b5cf6', false, 'female'),
          any: createDivIcon('#8b5cf6', false, 'any')
        }
      },
      public: {
        bidet: {
          male: createDivIcon('#10b981', true, 'male'), //~ green
          female: createDivIcon('#10b981', true, 'female'),
          any: createDivIcon('#10b981', true, 'any')
        },
        standard: {
          male: createDivIcon('#10b981', false, 'male'),
          female: createDivIcon('#10b981', false, 'female'),
          any: createDivIcon('#10b981', false, 'any')
        }
      },
      default: {
        bidet: {
          male: createDivIcon('#f59e0b', true, 'male'), //~ amber
          female: createDivIcon('#f59e0b', true, 'female'),
          any: createDivIcon('#f59e0b', true, 'any')
        },
        standard: {
          male: createDivIcon('#f59e0b', false, 'male'),
          female: createDivIcon('#f59e0b', false, 'female'),
          any: createDivIcon('#f59e0b', false, 'any')
        }
      }
    };
  }, []);
  
  //& fn get appropriate icon fr location
  const getMarkerIcon = (location: ToiletLocation) => {
    const type = location.type?.toLowerCase() || 'default';
    const hasBidet = location.hasBidet;
    //~ determine gender fr icon
    const gender = location.gender || 'any';
    
    //~ select icon based on type, bidet avail, gender
    if (type === 'mall') {
      return hasBidet ? customIcons.mall.bidet[gender] : customIcons.mall.standard[gender];
    } else if (type === 'hotel') {
      return hasBidet ? customIcons.hotel.bidet[gender] : customIcons.hotel.standard[gender];
    } else if (type === 'public') {
      return hasBidet ? customIcons.public.bidet[gender] : customIcons.public.standard[gender];
    } else {
      return hasBidet ? customIcons.default.bidet[gender] : customIcons.default.standard[gender];
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
    
    //& use selectedLocation frm props to center map + open popup
    useEffect(() => {
      if (selectedLocation && mapReady) {
        //~ center map on selected location
        map.setView(
          [selectedLocation.lat, selectedLocation.lng],
          15,  //~ higher zoom level fr selected location
          { animate: true }
        );
        
        //~ find marker by ID pattern matching & open popup directly
        setTimeout(() => {
          //~ search through marker refs using coordinates to find match
          const findAndOpenMarker = () => {
            //~ generate coord string match against marker IDs
            const coordsPattern = `-${selectedLocation.lat.toFixed(5)}-${selectedLocation.lng.toFixed(5)}`;
            
            //~ find matching marker in stored refs
            for (const markerId in markerRefs.current) {
              if (markerId.includes(coordsPattern)) {
                const marker = markerRefs.current[markerId];
                if (marker) {
                  marker.openPopup();
                  return true;
                }
              }
            }
            return false;
          };
          
          //~ attempt to find and open actual marker's popup
          findAndOpenMarker();
        }, 300); //~ small delay allow map to center 1st
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocation, mapReady]); 
    
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
    
    //~ improved map event handlers ensure popups work properly
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
    if (!rating) return null;
    
    //~ show stars
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center my-0.5">
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
          {mapReady && locations.map((location, index) => {
            //~ popup content outside component: reduce rerenders w compact layout
            const popupContent = (
              <div className="p-0" style={{ lineHeight: '1', margin: 0, padding: '4px' }}>
                {/* basic info w null checks */}
                <h3 className="font-medium text-base m-0 p-0" style={{ margin: 0, padding: 0 }}>{location.name || 'Unknown Location'}</h3>
                
                {/* //~ always show non-empty addresses even if same location name */}
                {location.address && location.address.trim() !== '' && (
                  <p className="text-sm mt-0 p-0" style={{ margin: 0, padding: 0, fontStyle: 'normal', wordBreak: 'break-word' }}>
                    {location.address}
                  </p>
                )}
                
                {/* show rating if avail */}
                {location.rating !== undefined && renderRating(location.rating)}
                
                {/* facility deets */}
                <div className="grid grid-cols-2 gap-x-2 text-xs" style={{ margin: 0, padding: 0, lineHeight: '1' }}>
                  <p className="m-0 p-0" style={{ margin: 0, padding: 0 }}><span className="font-medium">Type:</span> {location.type || 'Other'}</p>
                  <p className="m-0 p-0" style={{ margin: 0, padding: 0 }}><span className="font-medium">Region:</span> {location.region || 'Unknown'}</p>
                </div>
                
                {/* amenities w icons */}
                <div style={{ margin: 0, padding: 0, lineHeight: '1' }}>
                  <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Amenities:</p>
                  <div className="flex flex-wrap gap-1 text-xs" style={{ margin: 0, padding: 0 }}>
                    {/* safely check fr bidet */}
                    {location.hasBidet && (
                      <span className="px-2 py-0 bg-blue-100 rounded-full text-blue-800" style={{ margin: 0, padding: '1px 4px' }}>💦 Bidet</span>
                    )}
                    {/* //~ show gender info if avail */}
                    {location.gender && location.gender !== 'any' && (
                      <span className={`px-2 py-0 rounded-full ${location.gender === 'male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`} style={{ margin: 0, padding: '1px 4px' }}>
                        {location.gender === 'male' ? '♂️ Male only' : '♀️ Female only'}
                      </span>
                    )}
                    {/* safely check fr amenities obj & its props */}
                    {location.amenities && (
                      <>
                        {location.amenities.wheelchairAccess && (
                          <span className="px-2 py-0 bg-green-100 rounded-full text-green-800" style={{ margin: 0, padding: '1px 4px' }}>♿ Wheelchair</span>
                        )}
                        {location.amenities.babyChanging && (
                          <span className="px-2 py-0 bg-purple-100 rounded-full text-purple-800" style={{ margin: 0, padding: '1px 4px' }}>👶 Baby Station</span>
                        )}
                        {location.amenities.freeEntry && (
                          <span className="px-2 py-0 bg-yellow-100 rounded-full text-yellow-800" style={{ margin: 0, padding: '1px 4px' }}>🆓 Free Entry</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* opening hrs if avail */}
                {(location.openingHours || location.normalizedHours) && (
                  <div style={{ margin: 0, padding: 0, lineHeight: '1' }}>
                    <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Hours:</p>
                    <p className="text-xs" style={{ margin: 0, padding: 0 }}>{formatOpeningHours(location.normalizedHours || location.openingHours)}</p>
                  </div>
                )}
                
                {/* notes if avail */}
                {location.notes && (
                  <div style={{ margin: 0, padding: 0, lineHeight: '1' }}>
                    <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Notes:</p>
                    <p className="text-xs italic" style={{ margin: 0, padding: 0 }}>{location.notes}</p>
                  </div>
                )}
                
                {/* remarks section */}
                {(location.description || location.sheetsRemarks) && (
                  <div style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.2' }}>
                    <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Remarks:</p>
                    
                    {/* google maps description - handle both string & object formats */}
                    {location.description && (
                      <p className="text-xs" style={{ margin: '2px 0 0 0', padding: 0 }}>
                        <span className="font-medium">Maps source:</span> {
                          (() => {
                            //~ get description text based on type
                            const text = typeof location.description === 'object' && 
                              '@type' in location.description && 
                              'value' in location.description
                                ? String(location.description.value)
                                : String(location.description);
                            
                            return text.replace(/<br\s*\/?>/gi, ' | ');
                          })()
                        }
                      </p>
                    )}
                    
                    {/* google sheets remarks */}
                    {location.sheetsRemarks && (
                      <p className="text-xs" style={{ margin: '2px 0 0 0', padding: 0 }}>
                        <span className="font-medium">Sheets source:</span> {location.sheetsRemarks.replace(/<br\s*\/?>/gi, ' | ')}
                      </p>
                    )}
                  </div>
                )}
                
                {/* nav link */}
                <div style={{ margin: 0, padding: 0, borderTop: '1px solid #e5e7eb', lineHeight: '1' }}>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    style={{ margin: 0, padding: 0 }}
                  >
                    <span style={{ margin: 0, padding: 0 }}>📍 Get Directions</span>
                  </a>
                </div>
              </div>
            );
            
            //~ tooltip content: prevent rerenders
            const tooltipText = `${location.name}${location.hasBidet ? ' • Has Bidet' : ''}`;
            
            //~ unique marker id fr ref storage
            const markerId = `mark-${index}-${(location.id || '').replace(/^location-/, '')}-${location.lat.toFixed(5)}-${location.lng.toFixed(5)}`;
            
            return (
              <Marker 
                key={markerId}
                position={[location.lat, location.lng]}
                icon={getMarkerIcon(location)}
                eventHandlers={{
                  click: () => {}, //~ empty handler prevent issues
                  mouseover: () => {}, //~ empty handler prevent issues
                }}
                ref={(markerElement) => {
                  //~ store marker ref fr programmatic access
                  if (markerElement) {
                    markerRefs.current[markerId] = markerElement;
                  }
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
