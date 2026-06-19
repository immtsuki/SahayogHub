import { NavLink } from 'react-router-dom';

const navLinks = [
  { to: '/',          label: 'Home'      },
  { to: '/search',    label: 'Search'    },
  { to: '/maps',      label: 'Maps'      },
  { to: '/community', label: 'Community' },
];

export default function NavbarDesktop() {
  return (
    <header className="hidden md:flex items-center justify-between px-5 lg:px-8 h-14 bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm shrink-0">
      <div className="flex items-center gap-2 text-blue-500 font-bold text-base shrink-0">
        <span className="text-lg leading-none">📍</span>
        <span className="tracking-tight">Sahayog Hub</span>
      </div>
      <nav className="flex items-center gap-1">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-1 shrink-0">
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Notifications">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" className="text-gray-500">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Messages">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" className="text-gray-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <img
          src="https://i.pravatar.cc/36?img=10"
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover border-2 border-gray-100 ml-1"
        />
      </div>
    </header>
  );
}
