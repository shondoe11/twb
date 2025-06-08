import React from 'react';
import Image from 'next/image';
import { ToiletLocation } from '@/lib/types-compatibility';

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not available';
  return new Date(dateString).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

//& modal component: display detailed info abt selected toilet location
const DetailView = ({
  location,
  onClose
}: {
  location: ToiletLocation | null;
  onClose: () => void;
}) => {
  if (!location) return null;
  
  //~ format readable opening hrs
  const formatOpeningHours = (hours?: string) => {
    if (!hours) return 'Hours not available';
    return hours;
  };
  
  //~ render star rating w given number of stars
  const renderRating = (rating?: number, colorClass: string = 'yellow') => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`star-${i}`} className={`text-${colorClass}-500`}>★</span>
        ))}
        {hasHalfStar && <span className={`text-${colorClass}-500`}>★</span>}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300">★</span>
        ))}
        <span className="ml-1 text-sm">{rating.toFixed(1)}</span>
      </div>
    );
  };
  
  //& render nearby landmarks list
  const renderNearbyLandmarks = (landmarks?: string[]) => {
    if (!landmarks || landmarks.length === 0) return null;
    
    return (
      <div className="mt-4">
        <h3 className="font-medium mb-2">Nearby Landmarks</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {landmarks.map((landmark, index) => (
            <li key={`landmark-${index}`}>{landmark}</li>
          ))}
        </ul>
      </div>
    );
  };
  
  //~ close modal whn clicking outside content area
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header w close button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">{location.name}</h2>
          <button 
            className="text-gray-500 hover:text-gray-700" 
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          {/* image gallery */}
          {location.imageUrl && (
            <div className="mb-6 relative w-full h-64">
              <Image 
                src={location.imageUrl} 
                alt={location.name}
                fill
                className="object-cover rounded-lg"
                onError={() => {
                  //~ handle img err w state -> show fallback
                  console.error('Image failed to load');
                }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAEtAI8QlTKRQAAAABJRU5ErkJggg=="
              />
            </div>
          )}
          
          {/* basic info */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                {location.address ? (
                  <p className="text-gray-600">{location.address}</p>
                ) : (
                  <p className="text-gray-400 italic text-sm">No address available</p>
                )}
                <p className="text-sm text-gray-500 mt-1">{location.region}</p>
              </div>
              {renderRating(location.rating)}
            </div>
            
            {/* opening hrs */}
            {location.openingHours && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-1">Opening Hours</h3>
                <p className="text-sm">{formatOpeningHours(location.openingHours)}</p>
              </div>
            )}
          </div>
          
          {/* amenities section */}
          <div className="mb-6">
            <h3 className="font-medium mb-2">Amenities</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.hasBidet ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">💦</span>
                <span>Bidet {location.waterTemperature && `(${location.waterTemperature})`}</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.wheelchairAccess ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">♿</span>
                <span>Wheelchair Access</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.babyChanging ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">👶</span>
                <span>Baby Changing</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.freeEntry ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">🆓</span>
                <span>Free Entry</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.handDryer ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">💨</span>
                <span>Hand Dryer</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.soapDispenser ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">🧼</span>
                <span>Soap Dispenser</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.paperTowels ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">🧻</span>
                <span>Paper Towels</span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${location.amenities?.toiletPaper ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                <span className="text-lg">🧻</span>
                <span>Toilet Paper</span>
              </div>
            </div>
          </div>
          
          {/* accessibility info */}
          {location.accessibility && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Accessibility</h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={location.accessibility.hasRamp ? 'text-green-500' : 'text-red-500'}>
                      {location.accessibility.hasRamp ? '✓' : '✗'}
                    </span>
                    <span>Entrance Ramp</span>
                  </div>
                  {location.accessibility.doorWidth && (
                    <div>
                      <span className="font-medium">Door Width:</span> {location.accessibility.doorWidth} cm
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={location.accessibility.grabBars ? 'text-green-500' : 'text-red-500'}>
                      {location.accessibility.grabBars ? '✓' : '✗'}
                    </span>
                    <span>Grab Bars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={location.accessibility.emergencyButton ? 'text-green-500' : 'text-red-500'}>
                      {location.accessibility.emergencyButton ? '✓' : '✗'}
                    </span>
                    <span>Emergency Button</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* cleanliness & maintenance */}
          <div className="mb-6">
            <h3 className="font-medium mb-2">Cleanliness & Maintenance</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              {location.cleanliness && (
                <div className="flex items-center mb-2">
                  <span className="mr-2">Cleanliness:</span>
                  {renderRating(location.cleanliness, 'green')}
                </div>
              )}
              {location.lastCleaned && (
                <div className="text-sm mb-2">
                  <span className="font-medium">Last Cleaned:</span> {formatDate(location.lastCleaned)}
                </div>
              )}
              {location.maintenanceContact && (
                <div className="text-sm">
                  <span className="font-medium">Report Issues:</span> {location.maintenanceContact}
                </div>
              )}
            </div>
          </div>
          
          {/* floor info & visit count */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            {location.floor && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="font-medium mb-1">Floor</h3>
                <p className="text-sm">{location.floor}</p>
              </div>
            )}
            {location.visitCount && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="font-medium mb-1">Popularity</h3>
                <p className="text-sm">{location.visitCount.toLocaleString()} visitors</p>
              </div>
            )}
          </div>
          
          {/* nearby landmarks */}
          {renderNearbyLandmarks(location.nearbyLandmarks)}
          
          {/* additional notes section */}
          {location.notes && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Notes</h3>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm italic">{location.notes}</p>
              </div>
            </div>
          )}
          
          {/* action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg flex justify-center items-center gap-2"
            >
              <span>📍</span>
              <span>Get Directions</span>
            </a>
            <button 
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;
