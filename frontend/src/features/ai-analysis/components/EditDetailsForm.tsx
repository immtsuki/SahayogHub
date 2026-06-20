import { useState, useEffect } from 'react';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { useAuth } from '../../../shared/context/AuthContext';
import LocationPreviewMap from '../../../shared/components/LocationPreviewMap';
import LocationPickerModal from './LocationPickerModal';
import type { PickedLocation } from './LocationPickerModal';
import type { SubjectType } from '../../../shared/types';

const CATEGORY_OPTIONS: Record<SubjectType, string[]> = {
  item: ['Bags & Luggage', 'Electronics', 'Clothing', 'Accessories', 'Keys', 'Wallet', 'Other'],
  human: ['Person', 'Missing Person', 'Found Person', 'Other'],
  document: ['Document', 'National ID', 'Passport', 'License', 'Certificate', 'Other'],
};

const inputCls = 'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

export interface FormData {
  itemName: string;
  category: string;
  description: string;
  contactName: string;
  email: string;
  phone: string;
  location: PickedLocation | null;
}

interface EditDetailsFormProps {
  subjectType: SubjectType;
  onDataChange?: (data: FormData) => void;
}

export default function EditDetailsForm({ subjectType, onDataChange }: EditDetailsFormProps) {
  const { user } = useAuth();
  const categoryOptions = CATEGORY_OPTIONS[subjectType];
  const [itemName,     setItemName]     = useState('');
  const [category,     setCategory]     = useState(categoryOptions[0] ?? 'Other');
  const [description,  setDescription]  = useState('');
  const [contactName,  setContactName]  = useState(user?.name ?? '');
  const [email,        setEmail]        = useState(user?.email ?? '');
  const [phone,        setPhone]        = useState(user?.phone ?? '');
  const [location,     setLocation]     = useState<PickedLocation | null>(null);
  const [pickerOpen,   setPickerOpen]   = useState(false);

  // Sync contact fields when the auth user becomes available (e.g. after page refresh)
  useEffect(() => {
    if (user) {
      setContactName((prev) => prev || user.name);
      setEmail((prev) => prev || (user.email ?? ''));
      setPhone((prev) => prev || (user.phone ?? ''));
    }
  }, [user]);

  const { coords, loading: geoLoading } = useGeolocation();
  const centre: [number, number] = coords ?? [40.78, -73.97];

  // Notify parent whenever form data changes
  useEffect(() => {
    onDataChange?.({ itemName, category, description, contactName, email, phone, location });
  }, [itemName, category, description, contactName, email, phone, location, onDataChange]);

  function handleUseCurrentLocation() {
    if (!coords) return;
    setLocation({ lat: coords[0], lng: coords[1], label: 'Current location' });
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[0]}&lon=${coords[1]}&format=json`)
      .then((r) => r.json())
      .then((d) => {
        const label = d.display_name?.split(',').slice(0, 3).join(', ') ?? 'Current location';
        setLocation({ lat: coords[0], lng: coords[1], label });
      })
      .catch(() => {});
  }

  return (
    <>
      {pickerOpen && (
        <LocationPickerModal
          initial={centre}
          onConfirm={(loc) => { setLocation(loc); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-gray-900 text-base">Edit Details</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Item Name</label>
          <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
              {categoryOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <span className="text-xs text-gray-400 font-normal italic">Please provide details of your lost item</span>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Contact Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">Shown on the detail card so people can reach you.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">User Name</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputCls}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Gmail / Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Contact Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
        </div>

        {/* ── Location ── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Location</label>

          {location ? (
            /* Location set — show label + change button + mini map */
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <svg className="shrink-0 text-blue-500" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                </svg>
                <span className="flex-1 text-sm text-blue-700 truncate">{location.label}</span>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium cursor-pointer transition-colors"
                >
                  Change
                </button>
              </div>

              {/* Mini map preview — key forces remount on location change so map fills new size */}
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '220px' }}>
                <LocationPreviewMap lat={location.lat} lng={location.lng} />
              </div>
            </div>
          ) : (
            /* No location yet — two options */
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUseCurrentLocation}
                disabled={geoLoading || !coords}
                className="flex items-center justify-center gap-2 w-full border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
                </svg>
                {geoLoading ? 'Getting location…' : 'Use Current Location'}
              </button>

              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center justify-center gap-2 w-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                </svg>
                Select actual location of item found
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
