import React, { useState } from "react";
import Nav, { MobileBottomNav } from "../../shared/Nav";
import SearchBar from "./components/SearchBar";
import FilterPanel from "./components/FilterPanel";
import MatchCard from "./components/MatchCard";
import { MATCH_ITEMS, STATUS_FILTERS, SORT_OPTIONS } from "./data";
import type { StatusFilter } from "./data";
import type { Page } from "../../types/navigation";

interface SearchPageProps {
  onNavigate: (page: Page) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({ onNavigate }) => {
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Lost");
  const [sortBy, setSortBy]             = useState("Closest Match");

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav active="search" onNavigate={onNavigate} />

      {/* ── DESKTOP (lg+) ── */}
      <div className="hidden lg:flex lg:flex-col">
        <div className="bg-blue-50 border-b border-blue-100 py-5 px-6">
          <div className="max-w-2xl mx-auto">
            <SearchBar value={query} onChange={setQuery} />
          </div>
        </div>

        <div className="flex gap-6 max-w-6xl mx-auto w-full px-6 py-8">
          <FilterPanel />

          <main className="flex-1 min-w-0 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-xl">Match Discovery</h2>
                <p className="text-sm text-gray-400 mt-0.5">247 matches found</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                      sortBy === opt
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                    statusFilter === f
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {MATCH_ITEMS.map((item) => (
                <MatchCard key={item.title} {...item} desktop />
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* ── MOBILE (<lg) ── */}
      <div className="flex lg:hidden items-start justify-center py-6 px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col" style={{ minHeight: "780px" }}>
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 flex flex-col gap-4">
            <SearchBar value={query} onChange={setQuery} />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(["Lost", "Found"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                      statusFilter === s
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {["Category", "Date", "Location"].map((f) => (
                  <button key={f} className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-600 hover:border-gray-400 transition cursor-pointer">
                    {f} <span className="text-[10px] text-gray-400">▼</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 flex-shrink-0">Sort by:</span>
                {["Closest Match", "Recent", "Nearest"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`text-xs font-semibold transition-colors cursor-pointer ${
                      sortBy === opt ? "text-blue-500" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-bold text-gray-900 text-base mb-0.5">Match Discovery</h2>
              <p className="text-xs text-gray-400 mb-4">Items visually similar to your search</p>
              <div className="grid grid-cols-2 gap-3">
                {MATCH_ITEMS.map((item) => (
                  <MatchCard key={item.title} {...item} distance={item.distance + " away"} />
                ))}
              </div>
            </div>
          </div>
          <MobileBottomNav active="search" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
