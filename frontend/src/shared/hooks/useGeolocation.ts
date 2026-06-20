import { useState, useEffect } from 'react';

export interface GeoState {
  coords: [number, number] | null;
  loading: boolean;
  error: string | null;
}

/**
 * Gets the device's current position once using getCurrentPosition.
 * Much cheaper on battery than watchPosition.
 * Pass `watch: true` only on pages that need live updates (e.g. the map page).
 */
export function useGeolocation(options?: { watch?: boolean }): GeoState {
  const hasGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const watch  = options?.watch ?? false;

  const [state, setState] = useState<GeoState>(() => ({
    coords:  null,
    loading: hasGeo,
    error:   hasGeo ? null : 'Geolocation is not supported by your browser.',
  }));

  useEffect(() => {
    if (!hasGeo) return;

    const onSuccess = ({ coords }: GeolocationPosition) => {
      setState({ coords: [coords.latitude, coords.longitude], loading: false, error: null });
    };
    const onError = (err: GeolocationPositionError) => {
      setState({ coords: null, loading: false, error: err.message });
    };
    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 };

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, opts);
      return () => navigator.geolocation.clearWatch(id);
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
    }
  }, [hasGeo, watch]);

  return state;
}
