import React from 'react';
import { ToiletLocation } from '@/lib/types-compatibility';

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
  const renderRating = (rating?: number) => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`star-${i}`} className="text-yellow-500">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500">★</span>}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300">★</span>
        ))}
        <span className="ml-1 text-sm">{rating.toFixed(1)}</span>
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
            <div className="mb-6">
              <img 
                src={location.imageUrl} 
                alt={location.name}
                className="w-full h-64 object-cover rounded-lg"
                onError={(e) => {
                  //~ set fallback img on err
                  (e.target as HTMLImageElement).src = '/images/toilet-placeholder.jpg';
                }}
              />
            </div>
          )}
          
          {/* basic information */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-gray-600">{location.address}</p>
                <p className="text-sm text-gray-500 mt-1">{location.region}</p>
              </div>
              {renderRating(location.rating)}
            </div>
            
            {/* opening hours */}
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
                <span>Bidet</span>
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
            </div>
          </div>
          
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
