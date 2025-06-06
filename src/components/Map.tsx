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
  
  //~ popup content renderer
  const renderPopupContent = useCallback((location: ToiletLocation) => {
    return (
      <div className="popup-content">
        <div className="mb-2">
          <h3 className="text-base font-medium m-0 p-0">{location.name}</h3>
          {location.address && (
            <p className="text-xs text-gray-600 mt-0.5 mb-0 p-0">{location.address}</p>
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
        
        {location.rating && (
          <div className="mb-2">
            <div className="flex items-center">
              <span className="text-xs mr-1">Rating:</span>
              <span className="text-xs font-medium">{location.rating}/5</span>
              {renderRating(location.rating)}
            </div>
          </div>
        )}
        
        {(location.description || location.sheetsRemarks) && (
          <div style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.2' }}>
            <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Remarks:</p>
            
            {location.description && (
              <p className="text-xs" style={{ margin: '2px 0 0 0', padding: 0 }}>
                <span className="font-medium">Maps source:</span> {typeof location.description === 'object' && 
                  '@type' in location.description && 
                  'value' in location.description &&
                  location.description['@type'] === 'html' 
                    ? String(location.description.value).replace(/<br\s*\/?>/gi, ' | ') 
                    : String(location.description).replace(/<br\s*\/?>/gi, ' | ')}
              </p>
            )}
            
            {location.sheetsRemarks && (
              <p className="text-xs" style={{ margin: '2px 0 0 0', padding: 0 }}>
                <span className="font-medium">Sheets source:</span> {location.sheetsRemarks.replace(/<br\s*\/?>/gi, ' | ')}
              </p>
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
  }, [renderRating]);
  
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
