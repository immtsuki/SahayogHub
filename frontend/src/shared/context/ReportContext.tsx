import { createContext, useContext, useEffect, useState } from 'react';
import type { NotifCategory, NotifStatus } from '../../features/notifications/data';

export interface SubmittedReport {
  id: string;
  category: NotifCategory;
  status: NotifStatus;
  title: string;
  description: string;
  category_label: string;
  location: string;
  lat: number | null;
  lng: number | null;
  contact?: {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  images: string[];
  timeAgo: string;
  read: boolean;
  submittedAt: string; // ISO string
}

interface ReportContextValue {
  reports: SubmittedReport[];
  addReport: (r: SubmittedReport) => void;
}

const STORAGE_KEY = 'sahayog-submitted-reports';

function loadStoredReports() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as SubmittedReport[] : [];
  } catch {
    return [];
  }
}

const ReportContext = createContext<ReportContextValue>({
  reports: [],
  addReport: () => {},
});

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<SubmittedReport[]>(loadStoredReports);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  function addReport(r: SubmittedReport) {
    setReports((prev) => [r, ...prev.filter((report) => report.id !== r.id)]);
  }

  return (
    <ReportContext.Provider value={{ reports, addReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportContext);
}
