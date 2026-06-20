import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, MapIcon, NotificationIcon, CameraIcon } from './NavIcons';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/',              label: 'Home',          Icon: HomeIcon         },
  { to: '/search',        label: 'Search',        Icon: SearchIcon       },
  { to: '/maps',          label: 'Maps',          Icon: MapIcon          },
  { to: '/notifications', label: 'Notifications', Icon: NotificationIcon },
];

export default function NavbarDesktop() {
  const { user } = useAuth();

  return (
    <header className="hidden md:flex items-center justify-between px-5 lg:px-8 h-14 bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm shrink-0">
      <div className="flex items-center gap-2 text-blue-500 font-bold text-base shrink-0">
        <span className="text-lg leading-none">📍</span>
        <span className="tracking-tight">Sahayog Hub</span>
      </div>

      <nav className="flex items-center gap-1">
        {navLinks.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-1 shrink-0">
        <NavLink
          to="/report"
          className={({ isActive }) =>
            `flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-xl border transition-colors duration-150 mr-1 ${
              isActive
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'
            }`
          }
          aria-label="Create new report"
        >
          {({ isActive }) => (
            <>
              <CameraIcon active={isActive} />
              Report
            </>
          )}
        </NavLink>
        {user ? (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `ml-1 rounded-full ring-2 transition-all ${isActive ? 'ring-blue-500' : 'ring-gray-100 hover:ring-blue-300'}`
            }
            aria-label="Profile"
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover block"
            />
          </NavLink>
        ) : (
          <div className="flex items-center gap-2 ml-1">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `px-3.5 py-1.5 text-sm font-semibold rounded-xl border transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'text-blue-500 bg-white border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'
                }`
              }
            >
              Log In
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
}
