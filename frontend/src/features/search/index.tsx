import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import SearchBar from './components/SearchBar';
import MatchCard from './components/MatchCard';
import { STATUS_FILTERS } from './data';
import type { MatchItem, StatusFilter } from './data';
import { fetchReports, toMatchItem } from '../../shared/api/reports';

// ── Menu & category SVG icons ────────────────────────────────
function IconFilter() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  );
}
function IconTag() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}

// Category item icons — stroke SVGs
const CATEGORY_ICONS: Record<string, ReactNode> = {
  'Bags & Luggage': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  'Electronics': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  'Clothing': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  ),
  'Keys': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
    </svg>
  ),
  'Wallet': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  'Accessories': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
    </svg>
  ),
  'Animal / Pet': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.1 2.344-1.326"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.96-1.1-2.344-1.326"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/>
    </svg>
  ),
  'Person': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  'Documents': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  'Vehicle': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  'Other': (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const CATEGORIES = [
  'Bags & Luggage',
  'Electronics',
  'Clothing',
  'Keys',
  'Wallet',
  'Accessories',
  'Animal / Pet',
  'Person',
  'Documents',
  'Vehicle',
  'Other',
];

type SortOrder = 'asc' | 'desc';
type SubMenu   = 'filter' | 'category' | null;

// ── Icons ─────────────────────────────────────────────────────
function FilterIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4"  y1="6"  x2="20" y2="6"/>
      <line x1="8"  y1="12" x2="16" y2="12"/>
      <line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  );
}

// ── Sort row helper ───────────────────────────────────────────
function SortRow({ label, order, active, onToggle, onChange }: {
  label: string;
  order: SortOrder;
  active: boolean;
  onToggle: () => void;
  onChange: (o: SortOrder) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${active ? 'bg-blue-500' : 'bg-gray-200'}`}
          aria-label={`Toggle ${label}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-4' : ''}`} />
        </button>
        <span className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{label}</span>
      </div>
      {active && (
        <div className="flex items-center gap-1">
          {(['asc', 'desc'] as SortOrder[]).map((o) => (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                order === o ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {o === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function SearchPage() {
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Lost');
  const [items, setItems] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dropdown state
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [subMenu,   setSubMenu]   = useState<SubMenu>(null);

  // Filter sub-menu state
  const [dateSortActive,       setDateSortActive]       = useState(false);
  const [dateSortOrder,        setDateSortOrder]        = useState<SortOrder>('desc');
  const [locationInput,        setLocationInput]        = useState('');
  const [locationSortActive,   setLocationSortActive]   = useState(false);
  const [locationSortOrder,    setLocationSortOrder]    = useState<SortOrder>('asc');
  const [distance,             setDistance]             = useState(10);

  // Category sub-menu state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSubMenu(null);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function toggleCategory(label: string) {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  }

  function handleApply() {
    setMenuOpen(false);
    setSubMenu(null);
  }

  function handleReset() {
    setDateSortActive(false);
    setDateSortOrder('desc');
    setLocationInput('');
    setLocationSortActive(false);
    setLocationSortOrder('asc');
    setDistance(10);
    setSelectedCategories([]);
  }

  const activeFilterCount =
    (dateSortActive ? 1 : 0) +
    (locationInput || locationSortActive ? 1 : 0) +
    selectedCategories.length;

  useEffect(() => {
    let active = true;

    async function loadMatches() {
      setLoading(true);
      try {
        const reports = await fetchReports({
          q: query,
          status: statusFilter,
          category: selectedCategories.join(','),
          location: locationInput,
          recent: statusFilter === 'Recent',
        });
        if (active) setItems(reports.map(toMatchItem));
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMatches();
    return () => {
      active = false;
    };
  }, [query, statusFilter, selectedCategories, locationInput]);

  const filtered = items;

  // ── Dropdown panels ────────────────────────────────────────
  const topMenu = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden w-52">
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Options</p>
      </div>

      {/* Filter menu item */}
      <button
        onClick={() => setSubMenu(subMenu === 'filter' ? null : 'filter')}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
          subMenu === 'filter' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <IconFilter />
          <span>Filter</span>
          {(dateSortActive || locationInput || locationSortActive) && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </div>
        <ChevronRight />
      </button>

      {/* Category menu item */}
      <button
        onClick={() => setSubMenu(subMenu === 'category' ? null : 'category')}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
          subMenu === 'category' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <IconTag />
          <span>Category</span>
          {selectedCategories.length > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {selectedCategories.length}
            </span>
          )}
        </div>
        <ChevronRight />
      </button>

      <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
        <button onClick={handleReset} className="flex-1 text-xs text-gray-500 hover:text-red-500 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
          Reset all
        </button>
        <button onClick={handleApply} className="flex-1 text-xs text-white font-semibold py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer">
          Apply
        </button>
      </div>
    </div>
  );

  const filterSubMenu = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-72 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setSubMenu(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <ChevronLeft />
        </button>
        <span className="text-sm font-semibold text-gray-900">Filter Settings</span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Date */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</p>
          <SortRow
            label="Sort by date"
            order={dateSortOrder}
            active={dateSortActive}
            onToggle={() => setDateSortActive((v) => !v)}
            onChange={(o) => { setDateSortOrder(o); setDateSortActive(true); }}
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* Location */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
          <input
            type="text"
            placeholder="Enter location name…"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
          <SortRow
            label="Sort by location"
            order={locationSortOrder}
            active={locationSortActive}
            onToggle={() => setLocationSortActive((v) => !v)}
            onChange={(o) => { setLocationSortOrder(o); setLocationSortActive(true); }}
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* Distance */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distance radius</p>
            <span className="text-sm font-semibold text-blue-500">{distance} mi</span>
          </div>
          <input
            type="range" min={1} max={50} value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>1 mi</span><span>50 mi</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button onClick={handleApply} className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
          Apply
        </button>
      </div>
    </div>
  );

  const categorySubMenu = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-72 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => setSubMenu(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <ChevronLeft />
          </button>
          <span className="text-sm font-semibold text-gray-900">Category</span>
        </div>
        {selectedCategories.length > 0 && (
          <button onClick={() => setSelectedCategories([])} className="text-xs text-blue-500 hover:underline cursor-pointer">
            Clear all
          </button>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-2">
        {CATEGORIES.map((label) => {
          const selected = selectedCategories.includes(label);
          return (
            <button
              key={label}
              onClick={() => toggleCategory(label)}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                selected
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={selected ? 'text-blue-500' : 'text-gray-400'}>
                  {CATEGORY_ICONS[label]}
                </span>
                {label}
              </div>
              {selected && (
                <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <button onClick={handleApply} className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
          Apply ({selectedCategories.length > 0 ? selectedCategories.length : 'All'})
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50 px-3 sm:px-4 md:px-5 lg:px-8 py-4 pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">

      {/* ── Search bar + filter ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} />
        </div>

        <div className="relative shrink-0" ref={panelRef}>
          <button
            onClick={() => { setMenuOpen((o) => !o); if (menuOpen) setSubMenu(null); }}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
              menuOpen || activeFilterCount > 0
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            aria-label="Filters"
            aria-expanded={menuOpen}
          >
            <FilterIcon />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 flex items-start gap-2">
              {topMenu}
              {subMenu === 'filter'   && filterSubMenu}
              {subMenu === 'category' && categorySubMenu}
            </div>
          )}
        </div>
      </div>

      {/* ── Status chips ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                statusFilter === f
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 shrink-0">{filtered.length} matches found</p>
      </div>

      {/* ── Active filter pills ── */}
      {(selectedCategories.length > 0 || locationInput) && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCategories.map((c) => (
            <span key={c} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium px-2.5 py-1 rounded-full">
              {c}
              <button onClick={() => toggleCategory(c)} className="ml-0.5 hover:text-blue-800 cursor-pointer" aria-label={`Remove ${c}`}>×</button>
            </span>
          ))}
          {locationInput && (
            <span className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium px-2.5 py-1 rounded-full">
              📍 {locationInput}
              <button onClick={() => setLocationInput('')} className="ml-0.5 hover:text-blue-800 cursor-pointer" aria-label="Remove location">×</button>
            </span>
          )}
        </div>
      )}

      {/* ── Heading ── */}
      <div>
        <h2 className="font-bold text-gray-900 text-xl">Match Discovery</h2>
        <p className="text-sm text-gray-400 mt-0.5">Items visually similar to your search</p>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-16 text-sm text-gray-400">Loading matches...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 text-sm text-gray-400">No matches found.</div>
        ) : filtered.map((item) => (
          <MatchCard key={item.id} item={item} />
        ))}
      </div>
      </div>
    </div>
  );
}
