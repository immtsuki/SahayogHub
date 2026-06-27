interface MapSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function MapSearchBar({
  value,
  onChange,
  placeholder = 'Search on map...',
  className = '',
}: MapSearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"
        viewBox="0 0 24 24" aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-11 py-1.5
          bg-white rounded-full
          shadow-md border border-gray-100
          text-sm font-normal text-gray-800 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-400
          transition-shadow duration-150
        "
      />
      <button
        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Advanced filters"
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="4"  y1="6"  x2="20" y2="6"/>
          <line x1="8"  y1="12" x2="16" y2="12"/>
          <line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
