import { useNavigate } from 'react-router-dom';

export default function NearbyActivityWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Nearby Activity</h3>
        <button
          onClick={() => navigate('/maps')}
          className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
        >
          View map →
        </button>
      </div>
      <button
        onClick={() => navigate('/maps')}
        className="w-full rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400 group"
        aria-label="Open map view"
      >
        <div className="relative w-full h-28 bg-blue-50 rounded-xl overflow-hidden">
          <img
            src="https://tile.openstreetmap.org/13/2411/3080.png"
            alt="Nearby activity map"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm">
            Open map
          </div>
        </div>
      </button>
    </div>
  );
}
