import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, MapIcon, NotificationIcon, CameraIcon } from './NavIcons';

const leftLinks = [
  { to: '/',       label: 'Home',   Icon: HomeIcon   },
  { to: '/search', label: 'Search', Icon: SearchIcon },
];
const rightLinks = [
  { to: '/maps',          label: 'Maps',  Icon: MapIcon          },
  { to: '/notifications', label: 'Alerts', Icon: NotificationIcon },
];

export default function NavbarMobile() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100"
      style={{ zIndex: 9999 }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        className="flex items-center justify-around max-w-lg mx-auto px-2 pt-1"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {leftLinks.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <NavLink
          to="/report"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-blue-500' : 'text-gray-400'
            }`
          }
          aria-label="Create new report"
        >
          {({ isActive }) => (
            <>
              <CameraIcon active={isActive} />
              <span>Report</span>
            </>
          )}
        </NavLink>

        {rightLinks.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
