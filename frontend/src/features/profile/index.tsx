import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfilePostCard from './components/ProfilePostCard';
import { useAuth } from '../../shared/context/AuthContext';
import { fetchReports, toProfilePost } from '../../shared/api/reports';
import type { ApiReport } from '../../shared/api/reports';

const TABS = ['Posts', 'Saved', 'Activity'] as const;
type Tab = typeof TABS[number];

const GUEST_AVATAR = 'https://i.pravatar.cc/120?u=sahayog-guest';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Posts');
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadProfileReports() {
      if (authLoading) return;
      if (!user) {
        setReports([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextReports = await fetchReports({ mine: true });
        if (active) setReports(nextReports);
      } catch {
        if (active) setReports([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfileReports();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const posts = useMemo(() => reports.map(toProfilePost), [reports]);
  const visiblePosts = activeTab === 'Posts' ? posts : [];

  const lostPosted = reports.filter((report) => report.report_type === 'lost').length;
  const foundPosted = reports.filter((report) => report.report_type === 'found').length;
  const recoveries = reports.filter((report) => report.status === 'found' || report.status === 'owner_found').length;
  const trustScore = user ? Math.min(100, 80 + reports.length * 2) : 0;
  const badges = user
    ? [
        { id: 'verified', marker: 'ID', label: 'Verified' },
        { id: 'database', marker: 'DB', label: 'Synced' },
      ]
    : [];

  const displayName = user?.name ?? 'Guest User';
  const displayAvatar = user?.avatar ?? GUEST_AVATAR;
  const email = user?.email ?? '';
  const phone = user?.phone ?? '';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-gradient-to-b from-[#141B3A] via-[#141B3A] to-[#6E5BFF] pt-12 pb-14 md:pb-10 flex flex-col items-center text-white text-center w-full">
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden shrink-0">
          <img
            src={displayAvatar}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">{displayName}</h1>

        <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
          {user && (
            <span className="bg-white/15 backdrop-blur border border-white/25 text-white text-xs font-medium px-4 py-1.5 rounded-full">
              Verified User
            </span>
          )}
          <span className="bg-white/15 backdrop-blur border border-white/25 text-white text-xs font-medium px-4 py-1.5 rounded-full">
            {trustScore} Trust Score
          </span>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 md:px-5 lg:px-8 py-6 pb-24 md:pb-10">
        <div className="max-w-7xl mx-auto md:flex md:gap-6 md:items-start">
          <aside className="md:w-[260px] md:shrink-0 space-y-4 mb-6 md:mb-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {[
                { label: 'Lost Posted', value: lostPosted, color: 'text-gray-900' },
                { label: 'Found Posted', value: foundPosted, color: 'text-gray-900' },
                { label: 'Recoveries', value: recoveries, color: 'text-green-500' },
              ].map(({ label, value, color }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-5 py-3.5 ${
                    i < arr.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {badges.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Reputation Badges</h2>
                <div className="grid grid-cols-2 gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-full bg-white"
                    >
                      <span className="text-[10px] font-bold text-blue-500">{badge.marker}</span>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Contact</h2>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Full Name</p>
                  <p className="text-sm text-gray-800 font-medium">{displayName}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Email</p>
                  <p className="text-sm text-blue-500 break-all">{email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Phone</p>
                  <p className="text-sm text-blue-500">{phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="w-full bg-white border border-red-100 text-red-500 hover:bg-red-50 text-sm font-semibold py-3 rounded-2xl shadow-sm transition-colors cursor-pointer"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-3 rounded-2xl shadow-sm transition-colors cursor-pointer"
              >
                Login to view profile
              </button>
            )}
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex gap-0 border-b border-gray-200 mb-5">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-400 border-transparent hover:text-gray-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {authLoading || loading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                Loading profile...
              </div>
            ) : !user ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                Sign in to see your database-backed reports.
              </div>
            ) : visiblePosts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {visiblePosts.map((post) => (
                  <ProfilePostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
