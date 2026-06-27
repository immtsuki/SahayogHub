import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, MapIcon, NotificationIcon, CameraIcon, ProfileIcon } from './NavIcons';
import { useAuth } from '../context/AuthContext';

const leftLinks = [
  { to: '/',       label: 'Home',   Icon: HomeIcon   },
  { to: '/search', label: 'Search', Icon: SearchIcon },
];
const rightLinks = [
  { to: '/maps',          label: 'Maps',  Icon: MapIcon          },
  { to: '/notifications', label: 'Alerts', Icon: NotificationIcon },
];

export default function NavbarMobile() {
  const { user } = useAuth();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141B3A] border-t border-[#141B3A]"
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
                isActive ? 'text-[#D4AF37]' : 'text-white/55'
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
              isActive ? 'text-[#D4AF37]' : 'text-white/55'
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
                isActive ? 'text-[#D4AF37]' : 'text-white/55'
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

        {/* Profile or Login */}
        {user ? (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#D4AF37]' : 'text-white/55'
              }`
            }
          >
            {() => (
              <>
                <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                <span>Profile</span>
              </>
            )}
          </NavLink>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#D4AF37]' : 'text-white/55'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <ProfileIcon active={isActive} />
                <span>Log In</span>
              </>
            )}
          </NavLink>
        )}
      </div>
    </nav>
  );
}
