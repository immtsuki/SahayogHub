import { useState } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import FeedCard from './components/FeedCard';
import QuickStatsWidget from './components/QuickStatsWidget';
import NearbyActivityWidget from './components/NearbyActivityWidget';
import CommunityWidget from './components/CommunityWidget';
import { feedItems, quickStats, communityMembers } from './data';
import type { FeedItem } from './types';

const FILTER_TABS = ['All', 'Lost', 'Found', 'Nearby', 'Recent'];

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredItems: FeedItem[] = feedItems.filter((item) => {
    if (activeFilter === 'Lost') return item.status === 'LOST';
    if (activeFilter === 'Found') return item.status === 'FOUND';
    return true;
  });

  return (
    <div className="w-full pb-20 md:pb-6">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-4 sm:px-8 py-12 sm:py-16 flex flex-col items-center text-center">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-8 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

        <p className="relative text-blue-100 text-xs font-semibold uppercase tracking-widest mb-3">
          Sahayog Hub · Lost &amp; Found
        </p>
        <h1 className="relative text-white text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight max-w-2xl">
          Have you lost something<br />
          <span className="text-blue-200">and not found it yet?</span>
        </h1>
        <p className="relative text-blue-100 text-sm sm:text-base mt-4 max-w-md">
          Browse community reports, connect with finders, and reunite with what's yours.
        </p>
      </div>

      <div className="w-full bg-gray-50 border-b border-gray-100 px-3 sm:px-4 md:px-5 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_256px] lg:grid-cols-[1fr_280px] gap-4 lg:gap-6">
          <FilterTabs
            tabs={FILTER_TABS}
            active={activeFilter}
            onChange={setActiveFilter}
            scroll
            className="w-full justify-start"
          />
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-5 lg:px-8 pt-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_256px] lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 items-start">
          <section className="min-w-0">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">No items found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          <aside className="hidden md:flex flex-col gap-4 sticky top-14 self-start min-w-0">
            <QuickStatsWidget stats={quickStats} />
            <NearbyActivityWidget />
            <CommunityWidget members={communityMembers} />
          </aside>
        </div>
      </div>
    </div>
  );
}
