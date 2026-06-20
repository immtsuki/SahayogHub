import logoMobile from '../../assets/SahayogHub.png';

export default function MobileHeader() {
  return (
    <header className="md:hidden flex items-center justify-between px-3 sm:px-4 h-14 bg-[#141B3A] border-b border-[#141B3A] sticky top-0 z-50 shadow-sm shrink-0">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoMobile} alt="Sahayog Hub" className="h-9 w-auto object-contain" />
          <span className="text-sm font-bold tracking-tight" style={{ color: '#D4AF37' }}>SahayogHub</span>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Notifications" className="relative p-2 rounded-full hover:bg-white/10 transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" className="text-white/70">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <button aria-label="Messages" className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" className="text-white/70">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
