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
    if (activeFilter === 'Lost')  return item.status === 'LOST';
    if (activeFilter === 'Found') return item.status === 'FOUND';
    return true;
  });

  return (
    <div className="w-full px-3 sm:px-4 md:px-5 lg:px-8 py-4 pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_256px] lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 items-start">
        <section className="min-w-0">
          <FilterTabs
            tabs={FILTER_TABS}
            active={activeFilter}
            onChange={setActiveFilter}
            scroll
            className="mb-4"
          />
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
  );
}
