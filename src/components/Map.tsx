import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Map as MapGL, Source, Layer, Popup, NavigationControl } from '@vis.gl/react-maplibre';
import type { MapRef, LayerProps } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent, GeoJSONSource } from 'maplibre-gl';
import { ToiletLocation } from '@/lib/data/shared/types';
import { useIsDark } from './ThemeToggle';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  locations: ToiletLocation[];
  selectedLocation: ToiletLocation | null;
  onSelectLocation?: (location: ToiletLocation) => void;
}

//~ openfreemap vector styles - free fr any use, no api key, served via maplibre gl
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

//~ cluster circle styling - colour/size steps mirror the old leaflet cluster palette
const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  source: 'toilets',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#6ecc39', 10, '#f0c20c', 50, '#f18017'],
    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
};

//~ cluster count labels (noto sans is wht openfreemap serves fr glyphs)
const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'toilets',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['Noto Sans Bold'],
    'text-size': 13,
  },
  paint: {
    'text-color': '#1a202c',
  },
};

//~ individual toilet points
const unclusteredPointLayer: LayerProps = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'toilets',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#4299e1',
    'circle-radius': 7,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
};

const Map = ({ locations, selectedLocation, onSelectLocation }: MapProps) => {
  const mapRef = useRef<MapRef>(null);
  
  //~ which location's popup is currently open
  const [popupLocation, setPopupLocation] = useState<ToiletLocation | null>(null);
  
  //~ pointer cursor whn hovering clusters/points
  const [cursor, setCursor] = useState<string>('');
  
  //~ map basemap follows the app theme via the shared useIsDark hook
  const isDark = useIsDark();
  
  //~ convert locations into a geojson source fr maplibre's native clustering
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: locations.map((loc, idx) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [loc.lng, loc.lat] },
      //~ idx back-references the locations array fr popup lookups on click
      properties: { idx },
    })),
  }), [locations]);
  
  //~ close any open popup whn the filtered set changes - the location may be gone
  useEffect(() => {
    setPopupLocation(null);
  }, [locations]);
  
  //& click handler: expand clusters, open popups fr single points
  const handleMapClick = useCallback(async (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    
    if (feature.layer?.id === 'clusters') {
      //~ zoom into the cluster on click
      const clusterId = feature.properties?.cluster_id;
      const source = mapRef.current?.getSource('toilets') as GeoJSONSource | undefined;
      if (!source || clusterId === undefined) return;
      
      const zoom = await source.getClusterExpansionZoom(clusterId);
      //~ e.lngLat = clicked spot on the cluster circle, close enough to its center
      mapRef.current?.easeTo({ center: e.lngLat, zoom, duration: 500 });
    } else if (feature.layer?.id === 'unclustered-point') {
      const location = locations[feature.properties?.idx];
      if (location) {
        setPopupLocation(location);
        onSelectLocation?.(location);
      }
    }
  }, [locations, onSelectLocation]);
  
  //& center map & open popup whn a location is picked frm the list view
  useEffect(() => {
    if (!selectedLocation) return;
    
    mapRef.current?.flyTo({
      center: [selectedLocation.lng, selectedLocation.lat],
      zoom: 17,
      duration: 1200,
    });
    setPopupLocation(selectedLocation);
  }, [selectedLocation]);
  
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
          <span key={`empty-star-${i}`} className="text-gray-300 dark:text-gray-500">★</span>
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
    
    //~ visitCount as Visits if avail
    if (location.visitCount) {
      //~ check visitCount is alr in filteredComments avoid duplicates
      const visitsAlreadyAdded = filteredComments.some(c => 
        c.toLowerCase().includes('visits:') || c.toLowerCase().includes('visitcount'));
      
      if (!visitsAlreadyAdded) {
        safeAdd(`Visits: ${location.visitCount}`);
      }
    }
    
    //~ lastCleaned w ISO GMT+8 format if avail
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
    const shouldShowAddress = location.address && location.address.trim() !== '';
    
    return (
      <div className="popup-content">
        <div className="mb-2">
          <h3 className="text-base font-medium m-0 p-0">{location.name}</h3>
          {shouldShowAddress && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 mb-0 p-0">{location.address}</p>
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
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
              {location.type}
            </span>
          )}
          {location.gender && (
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
              {location.gender}
            </span>
          )}
          {location.hasBidet && (
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
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
        
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
          >
            <span>📍 Get Directions</span>
          </a>
        </div>
      </div>
    );
  }, [renderRating, getFilteredMapsComments, getFilteredSheetsComments]);
  
  return (
    //! min-h keeps the webgl canvas visible on mobile where the grid row has no fixed height
    <div className="h-full w-full min-h-[50vh] relative rounded-lg overflow-hidden">
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: 103.8198, latitude: 1.3521, zoom: 11 }} //~ SG centered
        mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onClick={handleMapClick}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('')}
        cursor={cursor}
      >
        <NavigationControl position="top-right" showCompass={false} />
        
        {/*~ maplibre clusters natively on the geojson source - no plugin needed */}
        <Source
          id="toilets"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
        
        {popupLocation && (
          <Popup
            longitude={popupLocation.lng}
            latitude={popupLocation.lat}
            anchor="bottom"
            offset={12}
            maxWidth="300px"
            onClose={() => setPopupLocation(null)}
          >
            {renderPopupContent(popupLocation)}
          </Popup>
        )}
      </MapGL>
    </div>
  );
};

export default Map;
