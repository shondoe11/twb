import React from 'react';

//& filterable list component fr displaying toilet locations
const ListView = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search locations..."
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      
      <div className="space-y-2">
        {/* List items to populate frm data */}
        <div className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
          <h3 className="font-medium">Sample Location 1</h3>
          <p className="text-sm text-gray-600">Region: Central</p>
        </div>
        <div className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
          <h3 className="font-medium">Sample Location 2</h3>
          <p className="text-sm text-gray-600">Region: East</p>
        </div>
      </div>
    </div>
  );
};

export default ListView;
