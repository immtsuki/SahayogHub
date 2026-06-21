import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { useAuth } from './shared/context/AuthContext';
import NavbarDesktop from './shared/components/NavbarDesktop';
import MobileHeader from './shared/components/MobileHeader';
import NavbarMobile from './shared/components/NavbarMobile';
import HomePage from './features/home';
import MapsPage from './features/maps';
import ProfilePage from './features/profile';
import SearchPage from './features/search';
import AIAnalysisPage from './features/ai-analysis';
import NotificationsPage from './features/notifications';
import AuthPage from './features/auth';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50 text-sm font-medium text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex flex-col h-screen bg-gray-50">
          <NavbarDesktop />
          <MobileHeader />
          <main className="flex-1 overflow-y-auto overscroll-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <Routes>
              <Route path="/"               element={<HomePage />} />
              <Route path="/maps"           element={<MapsPage />} />
              <Route path="/search"         element={<SearchPage />} />
              <Route path="/notifications"  element={<NotificationsPage />} />
              <Route path="/profile"        element={<ProfilePage />} />
              <Route
                path="/report"
                element={(
                  <RequireAuth>
                    <AIAnalysisPage />
                  </RequireAuth>
                )}
              />
              <Route path="/login"          element={<AuthPage />} />
              <Route path="*"               element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <NavbarMobile />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
