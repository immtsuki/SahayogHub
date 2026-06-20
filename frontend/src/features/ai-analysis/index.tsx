import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import EditDetailsForm from './components/EditDetailsForm';
import type { FormData } from './components/EditDetailsForm';
import CameraModal from './components/CameraModal';
import { useReports } from '../../shared/context/ReportContext';
import type { SubmittedReport } from '../../shared/context/ReportContext';

type ReportType    = 'lost' | 'found';
type ReportCategory = 'item' | 'human' | 'document';
type Step = 'category' | 'select' | 'lost-upload' | 'found-upload' | 'analysis';

// ── Shared helpers ─────────────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition cursor-pointer shrink-0"
      aria-label="Back"
    >
      ←
    </button>
  );
}

// ── Step 0 — Pick category: Item / Human / Document ───────────
const CATEGORIES: { key: ReportCategory; label: string; sub: string; color: string; hover: string; icon: ReactNode }[] = [
  {
    key: 'item', label: 'Item', sub: 'Lost or found object',
    color: 'border-gray-100 hover:border-blue-400',
    hover: 'bg-blue-50 group-hover:bg-blue-100',
    icon: (
      <svg width="28" height="28" fill="none" stroke="#3b82f6" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    key: 'human', label: 'Person', sub: 'Missing or found person',
    color: 'border-gray-100 hover:border-purple-400',
    hover: 'bg-purple-50 group-hover:bg-purple-100',
    icon: (
      <svg width="28" height="28" fill="none" stroke="#a855f7" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    key: 'document', label: 'Document', sub: 'ID, passport, certificate',
    color: 'border-gray-100 hover:border-amber-400',
    hover: 'bg-amber-50 group-hover:bg-amber-100',
    icon: (
      <svg width="28" height="28" fill="none" stroke="#f59e0b" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
];

function SelectCategoryPage({ onSelect }: { onSelect: (c: ReportCategory) => void }) {
  return (
    <div className="bg-gray-50 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create a Report</h1>
          <p className="text-sm text-gray-400 mt-1.5">What type of report?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CATEGORIES.map(({ key, label, sub, color, hover, icon }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 bg-white border-2 ${color} rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-md transition-all cursor-pointer text-left sm:text-center`}
            >
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl ${hover} flex items-center justify-center transition-colors shrink-0`}>
                {icon}
              </div>
              <div className="flex-1 sm:flex-none sm:text-center">
                <p className="font-bold text-gray-900 text-base">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 1 — Select Lost / Found ───────────────────────────────
function SelectTypePage({ onSelect, onBack }: { onSelect: (t: ReportType) => void; onBack: () => void }) {
  return (
    <div className="bg-gray-50 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-5">

        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lost or Found?</h1>
            <p className="text-sm text-gray-400 mt-0.5">Choose the situation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Lost card */}
          <button
            onClick={() => onSelect('lost')}
            className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 bg-white border-2 border-gray-100 hover:border-red-400 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-md transition-all cursor-pointer text-left sm:text-center"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors shrink-0">
              <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                <path d="M11 8v3l2 2"/>
              </svg>
            </div>
            <div className="flex-1 sm:flex-none sm:text-center">
              <p className="font-bold text-gray-900 text-base">Lost</p>
              <p className="text-xs text-gray-400 mt-0.5">I lost something</p>
            </div>
            <span className="text-xs font-semibold text-red-500 bg-red-50 group-hover:bg-red-100 px-3 py-1 rounded-full transition-colors shrink-0">
              LOST
            </span>
          </button>

          {/* Found card */}
          <button
            onClick={() => onSelect('found')}
            className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 bg-white border-2 border-gray-100 hover:border-green-400 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-md transition-all cursor-pointer text-left sm:text-center"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-green-50 group-hover:bg-green-100 flex items-center justify-center transition-colors shrink-0">
              <svg width="24" height="24" fill="none" stroke="#22c55e" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="flex-1 sm:flex-none sm:text-center">
              <p className="font-bold text-gray-900 text-base">Found</p>
              <p className="text-xs text-gray-400 mt-0.5">I found something</p>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 group-hover:bg-green-100 px-3 py-1 rounded-full transition-colors shrink-0">
              FOUND
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 1A — Lost: multi-photo upload ────────────────────────
function LostUploadPage({
  onNext,
  onBack,
}: {
  onNext: (img: string | null) => void;
  onBack: () => void;
}) {
  const [photos,       setPhotos]       = useState<string[]>([]);
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [dragging,     setDragging]     = useState(false);
  const [cameraOpen,   setCameraOpen]   = useState(false);
  const [cameraReview, setCameraReview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const urls: string[] = [];
    Array.from(files).forEach((f) => {
      if (f.type.startsWith('image/')) urls.push(URL.createObjectURL(f));
    });
    setPhotos((prev) => {
      const next = [...prev, ...urls];
      setActiveIdx(next.length - 1);
      return next;
    });
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPhotos((prev) => {
      const next = [...prev, url];
      setActiveIdx(next.length - 1);
      return next;
    });
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx(Math.max(0, idx - 1));
      return next;
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  // Camera modal open
  if (cameraOpen) {
    return (
      <CameraModal
        onCapture={(dataUrl) => { setCameraOpen(false); setCameraReview(dataUrl); }}
        onClose={() => setCameraOpen(false)}
      />
    );
  }

  // Review captured photo
  if (cameraReview) {
    return (
      <div className="fixed left-0 right-0 bottom-0 top-0 md:top-14 z-[9999] bg-black flex flex-col overflow-hidden">
        <div className="flex-1 relative min-h-0">
          <img src={cameraReview} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
        </div>
        <div
          className="bg-gray-900 px-5 flex flex-col gap-3 shrink-0"
          style={{ paddingTop: '1.25rem', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom) + 4rem)' }}
        >
          <p className="text-white text-sm font-medium text-center">Use this photo?</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => { setCameraReview(null); setCameraOpen(true); }}
              className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Retake
            </button>
            <button
              onClick={() => {
                const url = cameraReview;
                setPhotos((prev) => { const next = [...prev, url]; setActiveIdx(next.length - 1); return next; });
                setCameraReview(null);
                setCameraOpen(true);
              }}
              className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              Add Another
            </button>
            <button
              onClick={() => {
                const url = cameraReview;
                setPhotos((prev) => { const next = [...prev, url]; setActiveIdx(next.length - 1); return next; });
                setCameraReview(null);
              }}
              className="flex flex-col items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Use Photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasPhotos = photos.length > 0;  return (
    <div className="bg-gray-50 px-4 pt-6 pb-24 sm:py-10 flex flex-col items-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 flex flex-col gap-5">

        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Report Lost Item</h1>
            <p className="text-sm text-gray-400 mt-0.5">Upload photos to help identify your item.</p>
          </div>
        </div>

        {/* Main image / drop zone */}
        {hasPhotos ? (
          <div className="relative rounded-2xl overflow-hidden bg-gray-100" style={{ height: '220px' }}>
            <img
              src={photos[activeIdx]}
              alt={`Photo ${activeIdx + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Remove */}
            <button
              onClick={() => removePhoto(activeIdx)}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-base cursor-pointer"
            >×</button>
            {/* Counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
              {activeIdx + 1} / {photos.length}
            </div>
            {/* Arrows */}
            {photos.length > 1 && (
              <>
                <button onClick={() => setActiveIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow text-gray-700 cursor-pointer">‹</button>
                <button onClick={() => setActiveIdx((i) => (i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow text-gray-700 cursor-pointer">›</button>
              </>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl cursor-pointer transition-colors p-8 ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <svg width="28" height="28" fill="none" stroke="#3b82f6" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Drag & drop an image here</p>
            <p className="text-xs text-gray-400">or click to browse · PNG, JPG, WEBP</p>
          </div>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setActiveIdx(i)} className={`rounded-full transition-all cursor-pointer ${i === activeIdx ? 'w-4 h-2 bg-blue-500' : 'w-2 h-2 bg-gray-300'}`} />
            ))}
          </div>
        )}

        {/* Add more / camera */}
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>
            </svg>
            {hasPhotos ? 'Add More' : 'Browse'}
          </button>
          <button
            onClick={() => setCameraOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            Camera
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

        <button
          onClick={() => onNext(photos[0] ?? null)}
          disabled={!hasPhotos}
          className={`w-full text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer ${hasPhotos ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          Continue → ({photos.length} photo{photos.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

// ── Step 1B — Found: Tinder-style multi-photo upload ───────────
function FoundUploadPage({
  onNext,
  onBack,
}: {
  onNext: (imgs: string[]) => void;
  onBack: () => void;
}) {
  const [photos, setPhotos]             = useState<string[]>([]);
  const [activeIdx, setActiveIdx]       = useState(0);
  const [cameraReview, setCameraReview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [addAfterReview, setAddAfterReview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const urls: string[] = [];
    Array.from(files).forEach((f) => {
      if (f.type.startsWith('image/')) urls.push(URL.createObjectURL(f));
    });
    setPhotos((prev) => {
      const next = [...prev, ...urls];
      setActiveIdx(next.length - 1);
      return next;
    });
  }

  function handleCameraCapture(dataUrl: string) {
    setCameraOpen(false);
    setCameraReview(dataUrl);
    setAddAfterReview(false);
  }

  function confirmCameraPhoto() {
    if (!cameraReview) return;
    setPhotos((prev) => {
      const next = [...prev, cameraReview!];
      setActiveIdx(next.length - 1);
      return next;
    });
    if (addAfterReview) {
      setCameraReview(null);
      setCameraOpen(true);
    } else {
      setCameraReview(null);
    }
  }

  function retakePhoto() {
    setCameraReview(null);
    setCameraOpen(true);
  }

  function addAnotherPhoto() {
    setAddAfterReview(true);
    confirmCameraPhoto();
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx(Math.max(0, idx - 1));
      return next;
    });
  }

  const canContinue = photos.length >= 2;

  // ── Camera modal ──────────────────────────────────────────────
  if (cameraOpen) {
    return <CameraModal onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />;
  }

  // ── Camera review overlay ─────────────────────────────────────
  if (cameraReview) {
    return (
      <div className="fixed left-0 right-0 bottom-0 top-0 md:top-14 z-[9999] bg-black flex flex-col overflow-hidden">
        <div className="flex-1 relative min-h-0">
          <img src={cameraReview} alt="Captured" className="w-full h-full object-contain" />
        </div>
        <div
          className="bg-gray-900 px-5 flex flex-col gap-3 shrink-0"
          style={{ paddingTop: '1.25rem', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom) + 4rem)' }}
        >
          <p className="text-white text-sm font-medium text-center mb-1">Use this photo?</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={retakePhoto}
              className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Retake
            </button>
            <button
              onClick={addAnotherPhoto}
              className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              Add Another
            </button>
            <button
              onClick={confirmCameraPhoto}
              className="flex flex-col items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-3 rounded-2xl transition-colors cursor-pointer"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 px-4 pt-6 pb-24 sm:py-10 flex flex-col items-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 flex flex-col gap-5">

        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Report Found Item</h1>
            <p className="text-sm text-gray-400 mt-0.5">Add 2+ photos from different angles.</p>
          </div>
        </div>

        {/* Tinder-style card area */}
        <div className="relative flex items-center justify-center">

          {photos.length === 0 ? (
            /* Empty state */
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-56 sm:h-72 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:border-blue-300 hover:bg-gray-50 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <svg width="28" height="28" fill="none" stroke="#22c55e" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">Tap to add photos</p>
              <p className="text-xs text-gray-400">Add at least 2 from different views</p>
            </div>
          ) : (
            /* Card stack */
            <div className="relative w-full h-56 sm:h-72">
              {/* Stack shadows behind */}
              {photos.length > 2 && (
                <div className="absolute inset-x-6 bottom-0 h-full bg-gray-100 rounded-3xl -rotate-3 scale-95 origin-bottom" />
              )}
              {photos.length > 1 && (
                <div className="absolute inset-x-3 bottom-0 h-full bg-gray-200 rounded-3xl rotate-2 scale-[0.97] origin-bottom" />
              )}

              {/* Active card */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-lg">
                <img
                  src={photos[activeIdx]}
                  alt={`Photo ${activeIdx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Remove button */}
                <button
                  onClick={() => removePhoto(activeIdx)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-lg leading-none transition-colors cursor-pointer"
                  aria-label="Remove photo"
                >
                  ×
                </button>
                {/* Counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {activeIdx + 1} / {photos.length}
                </div>
              </div>

              {/* Prev / Next arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveIdx((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow text-gray-600 cursor-pointer z-10"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setActiveIdx((i) => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow text-gray-600 cursor-pointer z-10"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {photos.length > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`rounded-full transition-all cursor-pointer ${i === activeIdx ? 'w-4 h-2 bg-blue-500' : 'w-2 h-2 bg-gray-300'}`}
              />
            ))}
          </div>
        )}

        {/* Add more / camera */}
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>
            </svg>
            Add Photos
          </button>
          <button
            onClick={() => setCameraOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="sm:hidden">Camera</span>
            <span className="hidden sm:inline">Take Photo</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

        {!canContinue && photos.length > 0 && (
          <p className="text-xs text-amber-500 text-center -mt-2">Add at least one more photo from a different angle.</p>
        )}

        <button
          onClick={() => onNext(photos)}
          disabled={!canContinue}
          className={`w-full text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer ${canContinue ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          Continue → ({photos.length} photo{photos.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

// ── Image carousel ─────────────────────────────────────────────
const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700&auto=format&fit=crop',
];

const BACKEND_CATEGORY_BY_LABEL: Record<string, string> = {
  'Bags & Luggage': 'bags_luggage',
  Electronics: 'electronics',
  Clothing: 'clothing',
  Keys: 'keys',
  Accessories: 'other',
  Wallet: 'other',
  Other: 'other',
};

function createReportId() {
  return `r-${crypto.randomUUID?.() ?? Date.now().toString()}`;
}

function buildSubmittedReport({
  formData,
  images,
  reportType,
  submittedAt,
}: {
  formData: FormData;
  images: string[];
  reportType: ReportType;
  submittedAt: string;
}): SubmittedReport {
  const title = formData.itemName.trim() || 'Untitled report';
  const categoryLabel = formData.category || 'Other';

  return {
    id: createReportId(),
    category: reportType,
    status: reportType === 'lost' ? 'not_found' : 'owner_not_found',
    title,
    description: formData.description.trim() || `${categoryLabel} report for ${title}`,
    category_label: categoryLabel,
    location: formData.location?.label ?? 'Unknown location',
    lat: formData.location?.lat ?? null,
    lng: formData.location?.lng ?? null,
    contact: {
      name: formData.contactName.trim() || 'Unknown user',
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
    },
    images: [...images],
    timeAgo: 'Just now',
    read: false,
    submittedAt,
  };
}

function buildBackendReportPayload(report: SubmittedReport) {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    status: report.category,
    category: BACKEND_CATEGORY_BY_LABEL[report.category_label] ?? 'other',
    category_label: report.category_label,
    location_label: report.location,
    latitude: report.lat,
    longitude: report.lng,
    contact: report.contact,
    image_urls: report.images,
    reported_at: report.submittedAt,
    client_report: report,
  };
}

async function submitReportToBackend(report: SubmittedReport) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBackendReportPayload(report)),
  });

  if (!response.ok) {
    throw new Error(`Report API responded with ${response.status}`);
  }
}

function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  const total = images.length;

  // Auto-slide every 3 s
  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % total), 3000);
    return () => clearInterval(id);
  }, [total]);

  // Touch/drag swipe
  const startX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { startX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -40) setIdx((i) => (i + 1) % total);
    if (dx >  40) setIdx((i) => (i - 1 + total) % total);
    startX.current = null;
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden w-full select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div className="relative w-full h-56 sm:h-72 md:h-80 bg-gray-100">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Photo ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
          />
        ))}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all cursor-pointer ${i === idx ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
              aria-label={`Photo ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Arrows (desktop) */}
      {total > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + total) % total)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-sm cursor-pointer transition-colors"
          >‹</button>
          <button
            onClick={() => setIdx((i) => (i + 1) % total)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-sm cursor-pointer transition-colors"
          >›</button>
        </>
      )}
    </div>
  );
}

// ── Step 2 — Analysis ──────────────────────────────────────────
function AnalysisPage({ images, onBack, reportType }: { images: string[]; onBack: () => void; reportType: 'lost' | 'found' }) {
  const navigate    = useNavigate();
  const { addReport } = useReports();
  const imgs        = images.length > 0 ? images : FALLBACK_IMGS;
  const [toast, setToast]       = useState(false);
  const formDataRef = useRef<FormData>({
    itemName: 'Black Nike Backpack',
    category: 'Bags & Luggage',
    description: '',
    contactName: 'Jordan Blake',
    email: 'jordan.blake@email.com',
    phone: '',
    location: null,
  });

  async function handleContinue() {
    const fd = formDataRef.current;
    const now = new Date().toISOString();

    const report = buildSubmittedReport({
      formData: fd,
      images,
      reportType,
      submittedAt: now,
    });

    addReport(report);

    try {
      await submitReportToBackend(report);
    } catch (error) {
      console.warn('Backend report submit failed; report is available locally.', error);
    }

    setToast(true);
    setTimeout(() => {
      setToast(false);
      navigate('/notifications');
    }, 2000);
  }

  return (
    <div className="bg-gray-50">

      {/* ── Success toast ── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl animate-fade-in-down">
          <svg width="18" height="18" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Report submitted successfully!
        </div>
      )}

      <div className="hidden md:flex md:flex-col">
        <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 md:px-5 lg:px-8 py-8 flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <BackButton onClick={onBack} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Review {reportType} report</h1>
              <p className="text-sm text-gray-400 mt-0.5">Confirm the details before submitting.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <ImageCarousel images={imgs} />
          </div>
          <EditDetailsForm onDataChange={(d) => { formDataRef.current = d; }} />
          <div className="flex justify-end">
            <button onClick={handleContinue} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
              Continue →
            </button>
          </div>
        </main>
      </div>

      <div className="md:hidden px-3 sm:px-4 pt-5 pb-24 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Review {reportType} report</h1>
            <p className="text-xs text-gray-400 mt-0.5">Confirm the details before submitting.</p>
          </div>
        </div>
        <ImageCarousel images={imgs} />
        <EditDetailsForm onDataChange={(d) => { formDataRef.current = d; }} />
        <button onClick={handleContinue} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function AIAnalysisPage() {
  const [step,     setStep]     = useState<Step>('category');
  const [, setCategory] = useState<ReportCategory>('item');
  const [type,     setType]     = useState<ReportType>('lost');
  const [images,   setImages]   = useState<string[]>([]);

  function handleCategorySelect(c: ReportCategory) {
    setCategory(c);
    setStep('select');
  }

  function handleTypeSelect(t: ReportType) {
    setType(t);
    setStep(t === 'lost' ? 'lost-upload' : 'found-upload');
  }

  function handleLostNext(img: string | null) {
    setImages(img ? [img] : []);
    setStep('analysis');
  }
  function handleFoundNext(imgs: string[]) {
    setImages(imgs);
    setStep('analysis');
  }

  if (step === 'category')     return <SelectCategoryPage onSelect={handleCategorySelect} />;
  if (step === 'select')       return <SelectTypePage onSelect={handleTypeSelect} onBack={() => setStep('category')} />;
  if (step === 'lost-upload')  return <LostUploadPage onNext={handleLostNext} onBack={() => setStep('select')} />;
  if (step === 'found-upload') return <FoundUploadPage onNext={handleFoundNext} onBack={() => setStep('select')} />;
  return <AnalysisPage images={images} onBack={() => setStep(type === 'lost' ? 'lost-upload' : 'found-upload')} reportType={type} />;
}
