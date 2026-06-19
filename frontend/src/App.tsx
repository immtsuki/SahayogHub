import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavbarDesktop from './shared/components/NavbarDesktop';
import MobileHeader from './shared/components/MobileHeader';
import NavbarMobile from './shared/components/NavbarMobile';
import HomePage from './features/home';
import MapsPage from './features/maps';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-50">
        <NavbarDesktop />
        <MobileHeader />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"          element={<HomePage />} />
            <Route path="/maps"      element={<MapsPage />} />
            <Route path="/search"    element={<PlaceholderPage title="Search" />} />
            <Route path="/community" element={<PlaceholderPage title="Community" />} />
            <Route path="/profile"   element={<PlaceholderPage title="Profile" />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <NavbarMobile />
      </div>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-gray-400 text-lg font-medium">
      {title} — coming soon
    </div>
  );
}
