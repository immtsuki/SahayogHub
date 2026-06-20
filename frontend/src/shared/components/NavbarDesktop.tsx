import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, MapIcon, NotificationIcon, CameraIcon } from './NavIcons';
import { useAuth } from '../context/AuthContext';
import logoDesktop from '../../assets/SahayogHub.png';

const navLinks = [
  { to: '/',              label: 'Home',          Icon: HomeIcon         },
  { to: '/search',        label: 'Search',        Icon: SearchIcon       },
  { to: '/maps',          label: 'Maps',          Icon: MapIcon          },
  { to: '/notifications', label: 'Notifications', Icon: NotificationIcon },
];

export default function NavbarDesktop() {
  const { user } = useAuth();

  return (
    <header className="hidden md:flex items-center justify-between px-3 sm:px-4 md:px-5 lg:px-8 h-14 bg-[#141B3A] border-b border-[#141B3A] sticky top-0 z-50 shadow-sm shrink-0">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
      <div className="flex items-center gap-2 shrink-0">
        <img src={logoDesktop} alt="Sahayog Hub" className="h-9 w-auto object-contain" />
        <span className="text-lg font-bold tracking-tight" style={{ color: '#D4AF37' }}>SahayogHub</span>
      </div>

      <nav className="flex items-center gap-1">
        {navLinks.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-[#D4AF37] bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
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
                ? 'bg-[#D4AF37] text-[#141B3A] border-[#D4AF37]'
                : 'bg-transparent text-[#D4AF37] border-[#D4AF37]/50 hover:bg-[#D4AF37] hover:text-[#141B3A] hover:border-[#D4AF37]'
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
              `ml-1 rounded-full ring-2 transition-all ${isActive ? 'ring-[#D4AF37]' : 'ring-white/20 hover:ring-[#D4AF37]'}`
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
                    ? 'bg-[#D4AF37] text-[#141B3A] border-[#D4AF37]'
                    : 'text-[#D4AF37] bg-transparent border-[#D4AF37]/50 hover:bg-[#D4AF37] hover:text-[#141B3A] hover:border-[#D4AF37]'
                }`
              }
            >
              Log In
            </NavLink>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
