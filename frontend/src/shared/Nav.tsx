import React from "react";
import type { Page } from "../types/navigation";

interface NavItem {
  key: Page;
  label: string;
  icon: React.ReactNode;
  fab?: boolean;
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { key: "home",        label: "Home",    icon: "🏠" },
  { key: "search",      label: "Search",  icon: "🔍" },
  { key: "ai-analysis", label: "Report",  icon: <CameraIcon />, fab: true },
  { key: "maps",        label: "Maps",    icon: "🗺️" },
  { key: "profile",     label: "Profile", icon: "👤" },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { key: "home",        label: "Home",    icon: "🏠" },
  { key: "search",      label: "Search",  icon: "🔍" },
  { key: "ai-analysis", label: "Create",  icon: "+", fab: true },
  { key: "maps",        label: "Maps",    icon: "🗺️" },
  { key: "profile",     label: "Profile", icon: "👤" },
];

interface NavProps {
  active: Page;
  onNavigate: (page: Page) => void;
}

export const MobileBottomNav: React.FC<NavProps> = ({ active, onNavigate }) => (
  <nav className="flex items-end justify-around border-t border-gray-100 bg-white px-2 pt-2 pb-4">
    {MOBILE_NAV_ITEMS.map((item) =>
      item.fab ? (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className="flex flex-col items-center -mt-5 cursor-pointer"
          aria-label={item.label}
        >
          <span className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-colors">
            {item.icon}
          </span>
          <span className="text-[10px] text-gray-400 mt-1">{item.label}</span>
        </button>
      ) : (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            active === item.key ? "text-blue-500" : "text-gray-400 hover:text-gray-600"
          }`}
          aria-label={item.label}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      )
    )}
  </nav>
);

const Nav: React.FC<NavProps> = ({ active, onNavigate }) => (
  <header className="hidden lg:flex bg-white border-b border-gray-200 px-8 py-0 items-center justify-between sticky top-0 z-50 h-14">
    <button
      onClick={() => onNavigate("home")}
      className="flex items-center gap-2 font-bold text-lg text-gray-800 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
    >
      <span className="text-blue-500 text-xl">📍</span>
      LostLink AI
    </button>

    <nav className="flex items-center gap-1 h-full">
      {NAV_ITEMS.map((item) =>
        item.fab ? (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className="mx-3 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer"
            aria-label={item.label}
          >
            {item.icon}
            {item.label}
          </button>
        ) : (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 h-full border-b-2 transition-colors cursor-pointer ${
              active === item.key
                ? "text-blue-500 border-blue-500"
                : "text-gray-500 border-transparent hover:text-gray-800"
            }`}
            aria-label={item.label}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </nav>

    <div className="flex items-center gap-3 flex-shrink-0">
      <div className="relative cursor-pointer">
        <span className="text-xl text-gray-500">🔔</span>
        <span className="absolute -top-1 -right-1 bg-orange-400 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          3
        </span>
      </div>
      <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden cursor-pointer">
        <img src="https://i.pravatar.cc/32?img=11" alt="User Avatar" className="w-full h-full object-cover" />
      </div>
    </div>
  </header>
);

export default Nav;
