import { useEffect, useRef, useState } from 'react';
import { NOTIFICATIONS } from './data';
import type { Notification, NotifStatus } from './data';
import { useReports } from '../../shared/context/ReportContext';
import type { SubmittedReport } from '../../shared/context/ReportContext';
import ItemDetailModal from '../../shared/components/ItemDetailModal';

const LOST_OPTIONS: { value: NotifStatus; label: string; dot: string }[] = [
  { value: 'found', label: 'Found', dot: 'bg-green-500' },
  { value: 'not_found', label: 'Not Found Yet', dot: 'bg-red-500' },
];

const FOUND_OPTIONS: { value: NotifStatus; label: string; dot: string }[] = [
  { value: 'owner_found', label: 'Owner Found', dot: 'bg-green-500' },
  { value: 'owner_not_found', label: 'Owner Not Found', dot: 'bg-red-500' },
];

const STATUS_STYLE: Record<NotifStatus, { color: string; dot: string }> = {
  found: { color: 'text-green-600', dot: 'bg-green-500' },
  not_found: { color: 'text-red-600', dot: 'bg-red-500' },
  owner_found: { color: 'text-green-600', dot: 'bg-green-500' },
  owner_not_found: { color: 'text-red-600', dot: 'bg-red-500' },
};

function StatusDropdown({
  status,
  category,
  onChange,
}: {
  status: NotifStatus;
  category: Notification['category'];
  onChange: (s: NotifStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = category === 'lost' ? LOST_OPTIONS : FOUND_OPTIONS;
  const s = STATUS_STYLE[status];
  const label = options.find((o) => o.value === status)?.label ?? status;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:border-gray-300 px-3 py-2 rounded-lg transition-colors cursor-pointer max-w-[140px] sm:max-w-none"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <span className={`${s.color} truncate hidden sm:inline`}>{label}</span>
        </span>
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-44">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer hover:bg-gray-50 ${
                status === opt.value ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotifCard({
  notif,
  onStatusChange,
}: {
  notif: Notification;
  onStatusChange: (id: string, s: NotifStatus) => void;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${notif.read ? 'border-gray-100' : 'border-blue-200'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <img src={notif.image} alt={notif.title} className="w-11 h-11 rounded-xl object-cover" />
          {!notif.read && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{notif.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{notif.description}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[45%] sm:max-w-none">
          <span className="text-[11px] text-gray-400">{notif.timeAgo}</span>
          <StatusDropdown
            status={notif.status}
            category={notif.category}
            onChange={(s) => onStatusChange(notif.id, s)}
          />
        </div>
      </div>
    </div>
  );
}

function SubmittedReportCard({ report }: { report: SubmittedReport }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isLost = report.category === 'lost';
  const img = report.images[0];
  const submittedDate = report.submittedAt ? new Date(report.submittedAt).toLocaleString() : report.timeAgo;

  return (
    <>
      {detailOpen && (
        <ItemDetailModal
          item={{
            id: report.id,
            title: report.title,
            description: report.description,
            image: img || 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?w=600&q=80',
            status: isLost ? 'LOST' : 'FOUND',
            date: submittedDate,
            location: report.location,
            lat: report.lat,
            lng: report.lng,
            distance: report.lat !== null && report.lng !== null ? 'Pinned location' : 'No distance',
            postedAgo: report.timeAgo,
            user: {
              name: report.contact?.name || 'Sahayog User',
              avatar: report.contact?.avatar || 'https://i.pravatar.cc/40?u=sahayog',
              email: report.contact?.email || undefined,
              phone: report.contact?.phone,
            },
          }}
          onClose={() => setDetailOpen(false)}
        />
      )}

      <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative shrink-0">
            {img ? (
              <img src={img} alt={report.title} className="w-11 h-11 rounded-xl object-cover" />
            ) : (
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-bold ${isLost ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {isLost ? 'LOST' : 'FOUND'}
              </div>
            )}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isLost ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {isLost ? 'LOST' : 'FOUND'}
              </span>
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Just submitted
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{report.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{report.description}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{report.location} / {report.category_label}</p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[11px] text-gray-400">{report.timeAgo}</span>
            <button
              onClick={() => setDetailOpen(true)}
              className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { reports: submittedReports } = useReports();

  function updateStatus(id: string, status: NotifStatus) {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, status, read: true } : n)
    );
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="min-h-full bg-gray-50 px-3 sm:px-4 md:px-5 lg:px-8 py-4 pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'All'}
              </button>
            ))}
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {submittedReports.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Submissions</p>
            <div className="flex flex-col gap-2">
              {submittedReports.map((r) => (
                <SubmittedReportCard key={r.id} report={r} />
              ))}
            </div>
            {visible.length > 0 && <div className="border-t border-gray-100 mt-4" />}
          </div>
        )}

        {visible.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visible.map((n) => (
              <NotifCard key={n.id} notif={n} onStatusChange={updateStatus} />
            ))}
          </div>
        ) : submittedReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-sm font-medium">No notifications</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
