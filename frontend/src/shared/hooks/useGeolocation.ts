import { useState, useEffect } from 'react';

export interface GeoState {
  coords: [number, number] | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    coords: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, loading: false, error: 'Geolocation is not supported by your browser.' });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setState({
          coords: [coords.latitude, coords.longitude],
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({ coords: null, loading: false, error: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
