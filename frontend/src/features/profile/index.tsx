import { useState } from 'react';
import ProfilePostCard from './components/ProfilePostCard';
import { profileUser, profilePosts, savedPosts } from './data';

const TABS = ['Posts', 'Saved', 'Activity'] as const;
type Tab = typeof TABS[number];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Posts');
  const { name, verified, trustScore, stats, badges } = profileUser;

  const posts = activeTab === 'Posts' ? profilePosts
               : activeTab === 'Saved' ? savedPosts
               : [];

  return (
    <div className="min-h-full bg-gray-50">

      {/* ── Hero banner ─────────────────────────────────────────────
          Mobile: blue gradient, real avatar photo
          Desktop: blue-to-navy gradient, white circle with person icon  */}
      <div className="bg-gradient-to-b from-blue-500 via-blue-600 to-[#1a2a4a] pt-12 pb-14 md:pb-10 flex flex-col items-center text-white text-center w-full">

        {/* Avatar */}
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden shrink-0">
          <img
            src={profileUser.avatar}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">{name}</h1>

        <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
          {verified && (
            <span className="bg-white/15 backdrop-blur border border-white/25 text-white text-xs font-medium px-4 py-1.5 rounded-full">
              Verified User
            </span>
          )}
          <span className="bg-white/15 backdrop-blur border border-white/25 text-white text-xs font-medium px-4 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="text-yellow-400">★</span>
            {trustScore} Trust Score
          </span>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────── */}
      <div className="w-full px-3 sm:px-4 md:px-5 lg:px-8 py-6 pb-24 md:pb-10">
        <div className="md:flex md:gap-6 md:items-start">

          {/* ── Sidebar ─────────────────────────────────────────── */}
          <aside className="md:w-[260px] md:shrink-0 space-y-4 mb-6 md:mb-0">

            {/* Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {[
                { label: 'Lost Posted',  value: stats.lostPosted,  color: 'text-gray-900' },
                { label: 'Found Posted', value: stats.foundPosted, color: 'text-gray-900' },
                { label: 'Recoveries',   value: stats.recoveries,  color: 'text-green-500' },
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

            {/* Reputation Badges */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Reputation Badges</h2>
              <div className="grid grid-cols-2 gap-2">
                {badges.map((badge) => (
                  <span
                    key={badge.id}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-full bg-white hover:border-blue-300 transition-colors"
                  >
                    <span>{badge.emoji}</span>
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Contact</h2>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Full Name</p>
                  <p className="text-sm text-gray-800 font-medium">{profileUser.contact.fullName}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Email</p>
                  <a
                    href={`mailto:${profileUser.contact.email}`}
                    className="text-sm text-blue-500 hover:underline break-all"
                  >
                    {profileUser.contact.email}
                  </a>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Phone</p>
                  <a
                    href={`tel:${profileUser.contact.phone}`}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {profileUser.contact.phone}
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main content ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Tabs */}
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

            {/* Grid */}
            {posts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {posts.map((post) => (
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
