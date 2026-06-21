import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import FeedCard from './components/FeedCard';
import QuickStatsWidget from './components/QuickStatsWidget';
import NearbyActivityWidget from './components/NearbyActivityWidget';
import CommunityWidget from './components/CommunityWidget';
import type { CommunityMember, FeedItem, QuickStats } from './types';
import { fetchReports, fetchReportStats, toFeedItem } from '../../shared/api/reports';

const FILTER_TABS = ['All', 'Lost', 'Found', 'Nearby', 'Recent'];

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<QuickStats>({ lost: 0, found: 0, recoveries: 0 });
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Cache: avoid re-fetching within 60 s when the user navigates away and back
  const cacheRef = useRef<{ ts: number; items: FeedItem[]; stats: QuickStats; members: CommunityMember[] } | null>(null);
  const CACHE_TTL = 60_000;

  // Detect when the sticky bar is actually stuck (sentinel scrolls out of view)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      // Serve from cache if fresh
      if (cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL) {
        setItems(cacheRef.current.items);
        setStats(cacheRef.current.stats);
        setMembers(cacheRef.current.members);
        setLoading(false);
        return;
      }
      try {
        const [reports, reportStats] = await Promise.all([
          fetchReports({ recent: true }),
          fetchReportStats(),
        ]);
        if (!active) return;
        const nextItems   = reports.map(toFeedItem);
        const nextStats   = reportStats.quickStats;
        const nextMembers = reportStats.communityMembers;
        cacheRef.current  = { ts: Date.now(), items: nextItems, stats: nextStats, members: nextMembers };
        setItems(nextItems);
        setStats(nextStats);
        setMembers(nextMembers);
        setError(null);
      } catch {
        if (!active) return;
        setItems([]);
        setStats({ lost: 0, found: 0, recoveries: 0 });
        setMembers([]);
        setError('Could not load reports from the database.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHomeData();
    return () => { active = false; };
  }, []);

  const filteredItems: FeedItem[] = useMemo(() => items.filter((item) => {
    if (activeFilter === 'Lost') return item.status === 'LOST';
    if (activeFilter === 'Found') return item.status === 'FOUND';
    return true;
  }), [items, activeFilter]);

  const handleFilterChange = useCallback((f: string) => setActiveFilter(f), []);

  return (
    <div className="w-full pb-20 md:pb-6">
      {/* Hero — blobs promoted to GPU layer to avoid repaint on scroll */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-[#141B3A] via-[#141B3A] to-[#6E5BFF] px-4 sm:px-8 py-12 sm:py-16 flex flex-col items-center text-center">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none will-change-transform" style={{ transform: 'translateZ(0)' }} />
        <div className="absolute -bottom-12 -right-8 w-72 h-72 bg-[#D4AF37]/20 rounded-full blur-3xl pointer-events-none will-change-transform" style={{ transform: 'translateZ(0)' }} />

        <p className="relative text-[#D4AF37] text-xs font-semibold uppercase tracking-widest mb-3">
          Sahayog Hub · Lost &amp; Found
        </p>
        <h1 className="relative text-white text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight max-w-2xl">
          Have you lost something<br />
          <span className="text-[#D4AF37]">and not found it yet?</span>
        </h1>
        <p className="relative text-white/75 text-sm sm:text-base mt-4 max-w-md">
          Browse community reports, connect with finders, and reunite with what's yours.
        </p>
      </div>

      {/* Sentinel — invisible div that sits just above the sticky bar */}
      <div ref={sentinelRef} className="h-px w-full" />

      {/* ── Sticky filter tabs bar ── */}
      <div className={`sticky top-0 z-40 w-full px-3 sm:px-4 md:px-5 lg:px-8 transition-[padding] duration-200 ${isStuck ? 'py-2' : 'py-3'}`}>
        <div className="max-w-7xl mx-auto">
          <FilterTabs
            tabs={FILTER_TABS}
            active={activeFilter}
            onChange={handleFilterChange}
            scroll
          />
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="px-3 sm:px-4 md:px-5 lg:px-8 pt-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_256px] lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 items-start">
          <section className="min-w-0">
            {loading ? (
              <div className="text-center py-16 text-sm text-gray-400">Loading reports...</div>
            ) : error ? (
              <div className="text-center py-16 text-sm text-red-400">{error}</div>
            ) : filteredItems.length === 0 ? (
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
            <QuickStatsWidget stats={stats} />
            <NearbyActivityWidget />
            <CommunityWidget members={members} />
          </aside>
        </div>
      </div>
    </div>
  );
}
