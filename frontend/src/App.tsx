import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavbarDesktop from './shared/components/NavbarDesktop';
import MobileHeader from './shared/components/MobileHeader';
import NavbarMobile from './shared/components/NavbarMobile';
import HomePage from './features/home';
import MapsPage from './features/maps';
import ProfilePage from './features/profile';
import SearchPage from './features/search';
import AIAnalysisPage from './features/ai-analysis';
import NotificationsPage from './features/notifications';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-50">
        <NavbarDesktop />
        <MobileHeader />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"               element={<HomePage />} />
            <Route path="/maps"           element={<MapsPage />} />
            <Route path="/search"         element={<SearchPage />} />
            <Route path="/notifications"  element={<NotificationsPage />} />
            <Route path="/profile"        element={<ProfilePage />} />
            <Route path="/report"         element={<AIAnalysisPage />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <NavbarMobile />
      </div>
    </BrowserRouter>
  );
}
