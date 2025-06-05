'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ToiletLocation } from '@/lib/types-compatibility';

interface StaticGoogleMapProps {
    locations: ToiletLocation[];
    selectedLocation?: ToiletLocation | null;
}

    const StaticGoogleMap: React.FC<StaticGoogleMapProps> = ({ locations = [], selectedLocation = null }) => {
        const [mapUrl, setMapUrl] = useState<string>('');
        const [selectedMarkerInfo, setSelectedMarkerInfo] = useState<ToiletLocation | null>(null);
        
        //& static map URL w markers
        useEffect(() => {
        if (locations.length === 0) return;
        
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
        
        //~ base map settings
        const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
        const center = selectedLocation 
            ? `${selectedLocation.lat},${selectedLocation.lng}`
        : '1.3521,103.8198'; //~ sg center
        const zoom = selectedLocation ? '15' : '12';
        const size = '640x480';
        const scale = '2'; //~ fr higher resolution on retina displays
        const maptype = 'roadmap';
        
        //~ limit markers prevent URL length issues (max ~8K chars)
        const MAX_MARKERS = 50;
        const markersToShow = locations.slice(0, MAX_MARKERS);
        
        //~ marker params
        const markerParams = markersToShow.map((loc) => {
        const isSelected = selectedLocation && 
            loc.lat === selectedLocation.lat && 
            loc.lng === selectedLocation.lng;
        
        const markerColor = isSelected ? '0x4285F4' : '0xFF5252';
        const markerSize = isSelected ? 'mid' : 'small';
        const label = isSelected ? 'S' : '';
        
        return `markers=color:${markerColor}|size:${markerSize}|label:${label}|${loc.lat},${loc.lng}`;
        }).join('&');
        
        //~ build complete URL
        const url = `${baseUrl}?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=${maptype}&${markerParams}&key=${apiKey}`;
        
        setMapUrl(url);
        
        //~ set selected marker info
        if (selectedLocation) {
        setSelectedMarkerInfo(selectedLocation);
        } else {
        setSelectedMarkerInfo(null);
        }
    }, [locations, selectedLocation]);
    
    //~ track usage stay within free tier
    useEffect(() => {
        //~ implementation of client-side usage tracking
        const today = new Date().toISOString().split('T')[0];
        const storedDate = localStorage.getItem('mapLastLoadDate');
        const storedCount = parseInt(localStorage.getItem('mapDailyLoadCount') || '0');
        
        if (storedDate === today) {
        //~ same day, increment counter
        const newCount = storedCount + 1;
        localStorage.setItem('mapDailyLoadCount', newCount.toString());
        
        //~ log usage fr debugging
        console.log(`Static Maps API usage today: ${newCount} loads`);
        
        //~ warning 90% of free tier (assuming 100 loads/day free tier)
        if (newCount > 90) {
            console.warn('Approaching Static Maps API daily free tier limit');
        }
        } else {
        //~ new day, reset counter
        localStorage.setItem('mapLastLoadDate', today);
        localStorage.setItem('mapDailyLoadCount', '1');
        }
    }, [mapUrl]);

    //& render selected location info card
    const renderInfoCard = () => {
        if (!selectedMarkerInfo) return null;
        
        return (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10">
            <h3 className="font-semibold text-lg mb-1">{selectedMarkerInfo.name}</h3>
            {/* //~ show address only whn differs frm name */}
            {selectedMarkerInfo.address && (
                <p
                    className="text-gray-600 text-sm mb-2"
                    style={{ overflowWrap: 'break-word' }}
                >
                    {selectedMarkerInfo.address && selectedMarkerInfo.address !== selectedMarkerInfo.name ? 
                        selectedMarkerInfo.address : 
                        selectedMarkerInfo.address && !selectedMarkerInfo.address.includes(selectedMarkerInfo.name) ? 
                            selectedMarkerInfo.address : null
                    }
                </p>
            )}
            {selectedMarkerInfo.rating !== undefined && (
            <div className="flex items-center mt-1 mb-2">
                <div className="text-yellow-500">
                {'★'.repeat(Math.floor(selectedMarkerInfo.rating))}
                {selectedMarkerInfo.rating % 1 >= 0.5 ? '★' : ''}
                {'☆'.repeat(5 - Math.floor(selectedMarkerInfo.rating) - (selectedMarkerInfo.rating % 1 >= 0.5 ? 1 : 0))}
                </div>
                <span className="ml-1 text-sm text-gray-600">{selectedMarkerInfo.rating.toFixed(1)}</span>
            </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
            {selectedMarkerInfo.hasBidet && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Bidet</span>
            )}
            {selectedMarkerInfo.amenities?.wheelchairAccess && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">♿ Accessible</span>
            )}
            {selectedMarkerInfo.amenities?.babyChanging && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">👶 Changing</span>
            )}
            {selectedMarkerInfo.amenities?.freeEntry && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">Free</span>
            )}
            </div>
        </div>
        );
    };

    return (
        <div className="h-[70vh] w-full relative">
        {mapUrl ? (
            <div className="w-full h-full relative">
            <Image 
                src={mapUrl}
                alt="Map of toilet locations" 
                fill
                style={{ objectFit: 'cover' }}
            />
            {renderInfoCard()}
            </div>
        ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="text-gray-600">Loading map...</div>
            </div>
        )}
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            Map data &copy;{new Date().getFullYear()} Google
        </div>
        </div>
    );
};

export default StaticGoogleMap;
