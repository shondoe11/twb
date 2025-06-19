import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { ToiletLocation } from '@/lib/types-compatibility';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; //~ marker clustering
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface MapProps {
  locations: ToiletLocation[];
  selectedLocation: ToiletLocation | null;
  onSelectLocation?: (location: ToiletLocation) => void;
}

const Map = ({ locations, selectedLocation, onSelectLocation }: MapProps) => {
  //~ track if map is rdy prevent early interaction issues
  const [mapReady, setMapReady] = useState(false);
  
  //~ store refs to all existing markers
  const markerRefs = useRef<Record<string, L.Marker>>({});
  
  //~ track user manual zoom and pan actions
  const userInteractedWithMap = useRef(false);
  
  //& workaround fr leaflet marker icon issues in next.js
  useEffect(() => {
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    
    L.Icon.Default.mergeOptions({
      iconUrl: '/images/marker-icon.png',
      iconRetinaUrl: '/images/marker-icon-2x.png',
      shadowUrl: '/images/marker-shadow.png',
      iconSize: [20, 33],
      iconAnchor: [10, 33],
      popupAnchor: [1, -30],
      shadowSize: [33, 33]
    });
    
    //~ mark map as rdy after leaf icon setup
    setMapReady(true);
  }, []);
  
  //~ create custom marker icon fr toilets
  const createToiletMarkerIcon = () => {
    const iconUrl = '/images/toilet-marker.png';
    const iconSize: [number, number] = [24, 24];
    
    return L.icon({
      iconUrl,
      iconSize,
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  };
  
  //& component: center map on selected location & handle map updates
  const MapUpdater = () => {
    const map = useMap();
    
    //& event handlers fr detect user interaction w map
    useEffect(() => {
      const handleUserInteraction = () => {
        userInteractedWithMap.current = true;
      };
      
      //~ track zoom and drag events as user interactions
      map.on('zoom', handleUserInteraction);
      map.on('drag', handleUserInteraction);
      
      return () => {
        map.off('zoom', handleUserInteraction);
        map.off('drag', handleUserInteraction);
      };
    }, [map]);
    
    //& use selectedLocation frm props to center map + open popup
    useEffect(() => {
      if (selectedLocation && mapReady) {
        //~ higher zoom level expand clusters
        const zoomLevel = 18;
        
        //~ reset user interaction flag when location explicitly selected from list view
        userInteractedWithMap.current = false;
        
        //~ center map on selected location with higher zoom
        map.setView(
          [selectedLocation.lat, selectedLocation.lng],
          zoomLevel,
          { animate: true }
        );
        
        //~ find marker by ID pattern matching open popup directly
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
          const found = findAndOpenMarker();
          
          //~ if marker not found (might be in cluster), try once more with a delay
          if (!found) {
            setTimeout(() => {
              //~ try again after clusters have had time to expand
              findAndOpenMarker();
            }, 500);
          }
        }, 300); //~ small delay allow map to center 1st
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocation, mapReady]); 
    
    //~ locations key to track changes for filtering
    const locationsKey = locations.map(loc => loc.id).join(','); 
    
    //& handle filtered locations change w/o unwanted zoom
    useEffect(() => {
      map.invalidateSize();
      
      //~ prevent filter bar selections frm causing unwanted zoom
      if (userInteractedWithMap.current) {
        return;
      }
      
      //~ only recalculate if no user interaction has happened
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }, [map, locationsKey]);
    
    return null;
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
          <span key={`empty-star-${i}`} className="text-gray-300">★</span>
        ))}
      </div>
    );
  }, []);
  
  //~ filter google maps source comments to only show relevant info
  const getFilteredMapsComments = useCallback((location: ToiletLocation): string[] => {
    const filteredComments: string[] = [];
    
    //~ helper safely add non-empty comments
    const safeAdd = (text: string | null | undefined): void => {
      if (text && typeof text === 'string' && text.trim() !== '') {
        filteredComments.push(text);
      }
    };
    
    //~ process maps source comments
    if (location.sourceComments?.maps && location.sourceComments.maps.length > 0) {
      location.sourceComments.maps.forEach(comment => {
        //~ skip empty comments
        if (!comment || comment.trim() === '') return;
        
        //~ skip name field (redundant)
        if (comment.includes('Name:')) return;
        
        //~ skip address field (redundant)
        if (comment.includes('Address:')) return;
        
        //~ skip accessibility info (fr wheelchair tag)
        if (comment.toLowerCase().includes('accessibility')) return;
        
        //~ skip water temp (fr filter)
        if (comment.toLowerCase().includes('temperature') || comment.toLowerCase().includes('water temp')) return;
        
        //~ skip cleanliness (shown as stars)
        if (comment.toLowerCase().includes('cleanliness') || comment.toLowerCase().includes('clean rating')) return;
        
        //~ skip maintenance contact
        if (comment.toLowerCase().includes('maintenance') || comment.toLowerCase().includes('contact')) return;
        
        //~ skip nearby landmarks
        if (comment.toLowerCase().includes('landmark') || comment.toLowerCase().includes('nearby')) return;
        
        //~ check fr floor info in comment & process correctly (show only val)
        if (comment.toLowerCase().includes('floor')) {
          const floorMatch = comment.match(/floor:?\s*(.+)/i);
          if (floorMatch && floorMatch[1]) {
            safeAdd(floorMatch[1].trim());
            return;
          }
        }
        
        //~ check for visitCount in comment & rename to Visits
        if (comment.toLowerCase().includes('visitcount')) {
          const visitMatch = comment.match(/visitcount:?\s*(\d+)/i);
          if (visitMatch && visitMatch[1]) {
            safeAdd(`Visits: ${visitMatch[1]}`);
            return;
          }
        }
        
        //~ check for lastCleaned in comment & format correctly
        if (comment.toLowerCase().includes('lastcleaned') || 
            comment.toLowerCase().includes('last cleaned')) {
          const cleanedMatch = comment.match(/lastcleaned:?\s*(.+)/i) || 
                              comment.match(/last cleaned:?\s*(.+)/i);
          if (cleanedMatch && cleanedMatch[1]) {
            try {
              const date = new Date(cleanedMatch[1].trim());
              date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + 480); //~ +8h fr GMT+8
              const isoDate = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
              safeAdd(`Cleaned on: ${isoDate}`);
            } catch {
              safeAdd(`Cleaned on: ${cleanedMatch[1].trim()}`);
            }
            return;
          }
        }
        
        safeAdd(comment);
      });
    }
    
    //~ process location object fields directly
    //~ incl floor info if avail - raw floor field w/o prefix
    if (location.floor) {
      //~ check floor is alr in filteredComments avoid duplicates
      const floorAlreadyAdded = filteredComments.some(c => 
        c === location.floor || c.toLowerCase().includes(location.floor!.toLowerCase()));
      
      if (!floorAlreadyAdded) {
        safeAdd(`${location.floor}`);
      }
    }
    
    //~ include visitCount as Visits if avail
    if (location.visitCount) {
      //~ check visitCount is alr in filteredComments avoid duplicates
      const visitsAlreadyAdded = filteredComments.some(c => 
        c.toLowerCase().includes('visits:') || c.toLowerCase().includes('visitcount'));
      
      if (!visitsAlreadyAdded) {
        safeAdd(`Visits: ${location.visitCount}`);
      }
    }
    
    //~ incl lastCleaned w ISO GMT+8 format if avail
    if (location.lastCleaned) {
      //~ check lastCleaned is alr in filteredComments avoid duplicates
      const cleanedAlreadyAdded = filteredComments.some(c => 
        c.toLowerCase().includes('cleaned on:') || c.toLowerCase().includes('lastcleaned'));
      
      if (!cleanedAlreadyAdded) {
        try {
          const date = new Date(location.lastCleaned);
          date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + 480); //~ +8h fr GMT+8
          const isoDate = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
          
          safeAdd(`Cleaned on: ${isoDate}`);
        } catch {
          safeAdd(`Cleaned on: ${location.lastCleaned}`);
        }
      }
    }
    
    return filteredComments;
  }, []);
  
  //~ filter sheets source comments to only show relevant info
  const getFilteredSheetsComments = useCallback((location: ToiletLocation): string[] => {
    const filteredComments: string[] = [];
    
    //~ helper safely add non-empty comments
    const safeAdd = (text: string | null | undefined): void => {
      if (text && typeof text === 'string' && text.trim() !== '') {
        filteredComments.push(text);
      }
    };
    
    //~ process legacy sheetsRemarks if not already in sourceComments
    if (location.sheetsRemarks && 
        (!location.sourceComments?.sheets || 
          !location.sourceComments.sheets.includes(location.sheetsRemarks))) {
      safeAdd(location.sheetsRemarks);
    }
    
    //~ process sheets source comments
    if (location.sourceComments?.sheets && location.sourceComments.sheets.length > 0) {
      location.sourceComments.sheets.forEach(comment => {
        //~ skip empty comments
        if (!comment || comment.trim() === '') return;
        
        //~ skip name field (redundant)
        if (comment.includes('Name:')) return;
        
        //~ skip address field (redundant)
        if (comment.includes('Address:')) return;
        
        //~ skip accessibility info (fr wheelchair tag)
        if (comment.toLowerCase().includes('accessibility')) return;
        
        //~ skip water temp (fr filter)
        if (comment.toLowerCase().includes('temperature') || comment.toLowerCase().includes('water temp')) return;
        
        //~ skip cleanliness (shown as stars)
        if (comment.toLowerCase().includes('cleanliness') || comment.toLowerCase().includes('clean rating')) return;
        
        //~ skip maintenance contact
        if (comment.toLowerCase().includes('maintenance') || comment.toLowerCase().includes('contact')) return;
        
        //~ skip nearby landmarks
        if (comment.toLowerCase().includes('landmark') || comment.toLowerCase().includes('nearby')) return;
        
        //~ check fr floor info in comment & process correctly (show only val)
        if (comment.toLowerCase().includes('floor')) {
          const floorMatch = comment.match(/floor:?\s*(.+)/i);
          if (floorMatch && floorMatch[1]) {
            safeAdd(floorMatch[1].trim());
            return;
          }
        }
        
        //~ check for visitCount in comment & rename to Visits
        if (comment.toLowerCase().includes('visitcount')) {
          const visitMatch = comment.match(/visitcount:?\s*(\d+)/i);
          if (visitMatch && visitMatch[1]) {
            safeAdd(`Visits: ${visitMatch[1]}`);
            return;
          }
        }
        
        //~ check for lastCleaned in comment & format correctly
        if (comment.toLowerCase().includes('lastcleaned') || 
            comment.toLowerCase().includes('last cleaned')) {
          const cleanedMatch = comment.match(/lastcleaned:?\s*(.+)/i) || 
                             comment.match(/last cleaned:?\s*(.+)/i);
          if (cleanedMatch && cleanedMatch[1]) {
            try {
              const date = new Date(cleanedMatch[1].trim());
              date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + 480); //~ +8h fr GMT+8
              const isoDate = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
              safeAdd(`Cleaned on: ${isoDate}`);
            } catch {
              safeAdd(`Cleaned on: ${cleanedMatch[1].trim()}`);
            }
            return;
          }
        }
        
        safeAdd(comment);
      });
    }
    
    //~ process location object fields directly
    //~ floor info if avail - raw floor field w/o prefix
    if (location.floor) {
      //~ check floor is alr in filteredComments avoid duplicates
      const floorAlreadyAdded = filteredComments.some(c => 
        c === location.floor || c.toLowerCase().includes(location.floor!.toLowerCase()));
      
      if (!floorAlreadyAdded) {
        safeAdd(`${location.floor}`);
      }
    }
    
    //~ visitCount as Visits if avail
    if (location.visitCount) {
      //~ check visitCount is alr in filteredComments avoid duplicates
      const visitsAlreadyAdded = filteredComments.some(c => 
        c.toLowerCase().includes('visits:') || c.toLowerCase().includes('visitcount'));
      
      if (!visitsAlreadyAdded) {
        safeAdd(`Visits: ${location.visitCount}`);
      }
    }
    
    //~ lastCleaned w ISO GMT+8 format
    if (location.lastCleaned) {
      //~ check lastCleaned alr in filteredComments avoid duplicates
      const cleanedAlreadyAdded = filteredComments.some(c => 
        c.toLowerCase().includes('cleaned on:') || c.toLowerCase().includes('lastcleaned'));
      
      if (!cleanedAlreadyAdded) {
        try {
          const date = new Date(location.lastCleaned);
          date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + 480); //~ +8h fr GMT+8
          const isoDate = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
          
          safeAdd(`Cleaned on: ${isoDate}`);
        } catch {
          safeAdd(`Cleaned on: ${location.lastCleaned}`);
        }
      }
    }
    
    return filteredComments;
  }, []);

  //~ popup content renderer
  const renderPopupContent = useCallback((location: ToiletLocation) => {
    //? debug location fields
    console.log('Rendering popup for location:', { 
      id: location.id,
      name: location.name,
      address: location.address,
      source: location.source,
      floor: location.floor,
      visitCount: location.visitCount,
      cleanliness: location.cleanliness,
      lastCleaned: location.lastCleaned,
      sourceComments: location.sourceComments,
      mapsComments: getFilteredMapsComments(location),
      sheetsComments: getFilteredSheetsComments(location)
    });
    
    //? debug address display specifically
    console.log(`📍 POPUP ADDRESS CHECK: ${location.name} | Address: ${location.address || '(missing)'} | Source: ${location.source}`);
    
    const shouldShowAddress = location.address && location.address.trim() !== '';
    console.log(`🔍 SHOULD SHOW ADDRESS for "${location.name}": ${shouldShowAddress}`);
    console.log(`🔍 RAW ADDRESS VALUE: "${location.address}"`);
    console.log(`🔍 TYPE OF ADDRESS: ${typeof location.address}`);
    
    //? debug coordinates to check if google-sheets locations are in the viewport
    console.log(`🌐 COORDINATES for "${location.name}": [${location.lat}, ${location.lng}] | Source: ${location.source}`);
    
    
    //? detailed debug fr troubleshooting
    if (!shouldShowAddress) {
      if (!location.address) {
        console.log(`🚫 MISSING ADDRESS for "${location.name}" | Source: ${location.source}`);
      } else if (location.address.trim() === '') {
        console.log(`🚫 EMPTY ADDRESS for "${location.name}" | Source: ${location.source}`);
      }
    } else {
      console.log(`✅ SHOWING ADDRESS for "${location.name}": "${location.address}" | Source: ${location.source}`);
    }
    
    return (
      <div className="popup-content">
        <div className="mb-2">
          <h3 className="text-base font-medium m-0 p-0">{location.name}</h3>
          {shouldShowAddress && (
            <p className="text-xs text-gray-600 mt-0.5 mb-0 p-0">{location.address}</p>
          )}
          {location.cleanliness && (
            <div className="flex items-center mt-1">
              <span className="text-xs mr-1">Cleanliness:</span>
              {renderRating(location.cleanliness)}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {location.type && (
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
              {location.type}
            </span>
          )}
          {location.gender && (
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
              {location.gender}
            </span>
          )}
          {location.hasBidet && (
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
              Has Bidet
            </span>
          )}
        </div>
        
        {((getFilteredMapsComments(location).length > 0) || (getFilteredSheetsComments(location).length > 0)) && (
          <div style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.2' }}>
            <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Remarks:</p>
            
            {/* Maps src comments */}
            {getFilteredMapsComments(location).length > 0 && (
              <div className="mt-1">
                <p className="text-xs mb-0.5" style={{ margin: '2px 0 0 0', padding: 0 }}>
                  <span className="font-medium">Maps source:</span>
                </p>
                <ul className="list-disc pl-4 m-0 p-0">
                  {/* Display filtered maps comments */}
                  {getFilteredMapsComments(location).map((comment, index) => (
                    <li key={`map-comment-${index}`} className="text-xs" style={{ margin: 0, padding: 0 }}>
                      {comment.replace(/<br\s*\/?>/gi, ' | ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Sheets source comments */}
            {getFilteredSheetsComments(location).length > 0 && (
              <div className="mt-1">
                <p className="text-xs mb-0.5" style={{ margin: '2px 0 0 0', padding: 0 }}>
                  <span className="font-medium">Sheets source:</span>
                </p>
                <ul className="list-disc pl-4 m-0 p-0">
                  {/* Display filtered sheets comments */}
                  {getFilteredSheetsComments(location).map((comment, index) => (
                    <li key={`sheet-comment-${index}`} className="text-xs" style={{ margin: 0, padding: 0 }}>
                      {comment}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-gray-200">
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
  }, [renderRating, getFilteredMapsComments, getFilteredSheetsComments]);
  
  return (
    <div className="h-full w-full relative">
      <MapContainer 
        id="map"
        center={[1.3521, 103.8198]} //~ Singapore center
        zoom={12}
        className="h-full w-full z-0"
        attributionControl={false} //~ remove attr for cleaner look
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapUpdater />
        
        <MarkerClusterGroup 
          chunkedLoading
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {locations.map((location) => {
            //~ create marker ID based on key details incl precise coords
            const markerId = `marker-${location.id}-${location.lat.toFixed(5)}-${location.lng.toFixed(5)}`;
            const toiletIcon = createToiletMarkerIcon();
            const popupContent = renderPopupContent(location);
            const tooltipText = location.name;
            
            return (
              <Marker 
                key={markerId}
                position={[location.lat, location.lng]} 
                icon={toiletIcon}
                eventHandlers={{
                  click: () => {
                    onSelectLocation?.(location);
                  },
                  add: (e) => {
                    //~ store marker ref for programmatic popup opening
                    markerRefs.current[markerId] = e.target;
                  },
                  remove: () => {
                    //~ clean up ref when marker removed
                    delete markerRefs.current[markerId];
                  },
                }}
              >
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
