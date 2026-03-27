const STORAGE_KEY = 'last_known_location';

interface CachedLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

export function saveLocation(lat: number, lng: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() }));
}

export function getCachedLocation(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed: CachedLocation = JSON.parse(data);
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}
