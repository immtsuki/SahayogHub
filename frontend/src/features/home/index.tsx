import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import FeedCard from './components/FeedCard';
import QuickStatsWidget from './components/QuickStatsWidget';
import NearbyActivityWidget from './components/NearbyActivityWidget';
import CommunityWidget from './components/CommunityWidget';
import type { CommunityMember, FeedItem, QuickStats } from './types';
import { fetchReportsWithTotal, fetchReportStats, toFeedItem } from '../../shared/api/reports';

const FILTER_TABS = ['All', 'Lost', 'Found', 'Nearby', 'Recent'];
const PAGE_SIZE = 9;

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<QuickStats>({ lost: 0, found: 0, recoveries: 0 });
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<{ ts: number; stats: QuickStats; members: CommunityMember[] } | null>(null);
  const CACHE_TTL = 60_000;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

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
      setLoading(true);
      try {
        const [{ reports, total }, reportStats] = await Promise.all([
          fetchReportsWithTotal({ recent: true, page, page_size: PAGE_SIZE }),
          cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL
            ? Promise.resolve({ quickStats: cacheRef.current.stats, communityMembers: cacheRef.current.members })
            : fetchReportStats(),
        ]);
        if (!active) return;
        const nextItems   = reports.map(toFeedItem);
        const nextStats   = reportStats.quickStats;
        const nextMembers = reportStats.communityMembers;
        cacheRef.current  = { ts: Date.now(), stats: nextStats, members: nextMembers };
        setItems(nextItems);
        setTotalItems(total);
        setStats(nextStats);
        setMembers(nextMembers);
        setError(null);
      } catch {
        if (!active) return;
        setItems([]);
        setTotalItems(0);
        setStats({ lost: 0, found: 0, recoveries: 0 });
        setMembers([]);
        setError('Could not load reports from the database.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHomeData();
    return () => { active = false; };
  }, [page]);

  const filteredItems: FeedItem[] = useMemo(() => items.filter((item) => {
    if (activeFilter === 'Lost') return item.status === 'LOST';
    if (activeFilter === 'Found') return item.status === 'FOUND';
    return true;
  }), [items, activeFilter]);

  const handleFilterChange = useCallback((f: string) => {
    setActiveFilter(f);
    setPage(1);
  }, []);

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
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <FeedCard key={item.id} item={item} />
                  ))}
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 px-1">
                    <button
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page === 1}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6"/>
                      </svg>
                      Prev
                    </button>

                    <span className="text-sm text-gray-500 font-medium">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page === totalPages}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                )}
              </>
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
