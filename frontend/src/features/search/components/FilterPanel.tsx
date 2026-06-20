import { useState } from 'react';

export default function FilterPanel() {
  const [category, setCategory] = useState(true);
  const [dateRange, setDateRange] = useState(false);
  const [distance, setDistance] = useState(10);

  return (
    <aside className="w-52 shrink-0">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-5">
        <div>
          <h3 className="font-bold text-gray-900 text-sm mb-0.5">Filter Panel</h3>
          <p className="text-xs text-gray-400">Refine your search</p>
        </div>

        {/* Category checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setCategory(!category)}
            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
              category ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
            }`}
          >
            {category && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="text-sm text-gray-700">Category</span>
        </label>

        {/* Date range toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            onClick={() => setDateRange(!dateRange)}
            className={`relative w-9 h-5 rounded-full transition-colors ${dateRange ? 'bg-blue-500' : 'bg-gray-200'}`}
            aria-label="Toggle date range"
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dateRange ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <span className="text-sm text-gray-700">Date Range</span>
        </label>

        {/* Distance slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Distance radius</span>
            <span className="text-sm text-gray-500">{distance} mi</span>
          </div>
          <input
            type="range" min={1} max={50} value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <button className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
          Apply Filters
        </button>
      </div>
    </aside>
  );
}
