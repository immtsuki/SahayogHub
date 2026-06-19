import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
  <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
    <span className="text-gray-400 text-lg">🔍</span>
    <input
      type="text"
      placeholder="Search lost or found items..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
    />
  </div>
);

export default SearchBar;
