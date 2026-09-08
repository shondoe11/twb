import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Map as MapGL, Source, Layer, Popup, NavigationControl, useControl } from '@vis.gl/react-maplibre';
import type { MapRef, LayerProps, ControlPosition } from '@vis.gl/react-maplibre';
import { GeolocateControl as MaplibreGeolocateControl } from 'maplibre-gl';
import type { MapLayerMouseEvent, GeoJSONSource } from 'maplibre-gl';
import { ToiletLocation } from '@/lib/data/shared/types';
import { useIsDark } from './ThemeToggle';
import CommunityRemarks from './CommunityRemarks';
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

interface SafeGeolocateProps {
  position?: ControlPosition;
  positionOptions?: PositionOptions;
  trackUserLocation?: boolean;
  showUserLocation?: boolean;
  showAccuracyCircle?: boolean;
  onGeolocate?: () => void;
  onError?: (err: GeolocationPositionError) => void;
}

//~ strict-mode-safe geolocate control: react strict mode mounts controls twice (add->remove->re-add) & maplibre's async _finishSetupUI then binds the click->trigger() listener twice - w trackUserLocation, trigger() is a toggle,so every click started tracking & instantly cancelled it. guarding _finishSetupUI ensures a single binding.
const SafeGeolocateControl = ({ position, onGeolocate, onError, ...options }: SafeGeolocateProps) => {
  const handlersRef = useRef({ onGeolocate, onError });
  handlersRef.current = { onGeolocate, onError };

  useControl(() => {
    const gc = new MaplibreGeolocateControl(options);
    type PatchableGeolocate = MaplibreGeolocateControl & {
      _setup?: boolean;
      _finishSetupUI: (supported?: boolean) => void;
    };
    const patchable = gc as PatchableGeolocate;
    const finishSetupUI = patchable._finishSetupUI;
    patchable._finishSetupUI = (supported?: boolean) => {
      if (!patchable._setup) finishSetupUI(supported);
    };
    gc.on('geolocate', () => handlersRef.current.onGeolocate?.());
    gc.on('error', (err: GeolocationPositionError) => handlersRef.current.onError?.(err));
    return gc;
  }, { position });

  return null;
};

const Map = ({ locations, selectedLocation, onSelectLocation }: MapProps) => {
  const mapRef = useRef<MapRef>(null);
  
  //~ which location's popup is currently open
  const [popupLocation, setPopupLocation] = useState<ToiletLocation | null>(null);
  
  //~ pointer cursor whn hovering clusters/points
  const [cursor, setCursor] = useState<string>('');
  
  //~ surfaced whn the browser's geolocation lookup fails - maplibre swallows these errors silently otherwise
  const [geoError, setGeoError] = useState<string | null>(null);
  
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
  
  //& center map & open popup whn a location is picked frm list view
  useEffect(() => {
    if (!selectedLocation) return;
    
    mapRef.current?.flyTo({
      center: [selectedLocation.lng, selectedLocation.lat],
      zoom: 17,
      duration: 1200,
    });
    setPopupLocation(selectedLocation);
  }, [selectedLocation]);
  
  //& sheets remarks fr popup - merged m+f rows join their remarks w \n, split so each shows as its own bullet
  const getSheetsRemarks = useCallback((location: ToiletLocation): string[] => {
    if (!location.sheetsRemarks) return [];
    return location.sheetsRemarks
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
  }, []);

  //~ popup content renderer
  const renderPopupContent = useCallback((location: ToiletLocation) => {
    const shouldShowAddress = location.address && location.address.trim() !== '';
    const sheetsRemarks = getSheetsRemarks(location);
    
    return (
      <div className="popup-content">
        <div className="mb-2">
          <h3 className="text-base font-medium m-0 p-0">{location.name}</h3>
          {shouldShowAddress && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 mb-0 p-0">{location.address}</p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {location.type && (
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
              {location.type}
            </span>
          )}
          {location.amenities?.wheelchairAccess && (
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
              ♿ Wheelchair Access
            </span>
          )}
          {location.amenities?.babyChanging && (
            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full">
              👶 Baby Changing
            </span>
          )}
          {location.amenities?.unisex && (
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
              Unisex
            </span>
          )}
        </div>
        
        {/*~ always rendered - community remarks input must be available on every pin */}
        <div style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.2' }}>
            <p className="text-xs font-medium" style={{ margin: 0, padding: 0 }}>Remarks:</p>
            
            {/* Sheets source comments */}
            {sheetsRemarks.length > 0 && (
              <div className="mt-1">
                <p className="text-xs mb-0.5" style={{ margin: '2px 0 0 0', padding: 0 }}>
                  <span className="font-medium">Sheets source:</span>
                </p>
                <ul className="list-disc pl-4 m-0 p-0">
                  {sheetsRemarks.map((comment, index) => (
                    <li key={`sheet-comment-${index}`} className="text-xs" style={{ margin: 0, padding: 0 }}>
                      {comment}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* crowd-sourced remarks - editable by anyone, stored in supabase */}
            <CommunityRemarks locationId={location.id} />
        </div>
        
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
  }, [getSheetsRemarks]);
  
  return (
    //~ min-h keeps the webgl canvas visible on mobile where the grid row has no fixed height
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
        
        {/* live location: browser asks fr permission on 1st click, then flies to & tracks the user's pin (needs https / localhost) */}
        <SafeGeolocateControl
          position="top-right"
          positionOptions={{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }}
          trackUserLocation
          showUserLocation
          showAccuracyCircle
          onGeolocate={() => setGeoError(null)}
          onError={(err) => {
            console.error('Geolocation error:', err.code, err.message);
            //~ map the geolocationpositionerror codes to actionable messages
            const messages: Record<number, string> = {
              1: 'Location access denied - allow location for this site in your browser settings',
              2: 'Location unavailable - enable Location Services for your browser in System Settings > Privacy & Security',
              3: 'Location request timed out - try again',
            };
            setGeoError(messages[err.code] || 'Unable to get your location');
          }}
        />
        
        {geoError && (
          <div className="absolute top-24 right-2 z-10 max-w-60 bg-white dark:bg-gray-800 text-xs text-red-600 dark:text-red-400 px-3 py-2 rounded-lg shadow-lg">
            {geoError}
            <button
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setGeoError(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        
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
