
export interface RouteResult {
  durationText: string; // e.g., "15 mins"
  distanceText: string; // e.g., "4 miles"
  googleMapsUrl: string;
}

// Regex for UK Postcodes (Standard formats)
const UK_POSTCODE_REGEX = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/i;

// Helper to cleanup address for geocoding
// Priority: 1. Extracted Postcode 2. Cleaned Address
const cleanAddressForGeocode = (addr: string): string => {
  if (!addr || addr === 'TBD') return '';

  // Try to find a postcode first
  const postcodeMatch = addr.match(UK_POSTCODE_REGEX);
  if (postcodeMatch && postcodeMatch[0]) {
    return postcodeMatch[0].toUpperCase();
  }

  // Fallback: Remove newlines and extra spaces
  return addr.replace(/\n/g, ', ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
};

const cleanAddressForUrl = (addr: string): string => {
    if (!addr) return '';
    return addr.replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
}

export const getGoogleMapsUrl = (origin: string, destination: string) => {
  const o = encodeURIComponent(cleanAddressForUrl(origin));
  const d = encodeURIComponent(cleanAddressForUrl(destination));
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`;
};

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const cleaned = cleanAddressForGeocode(address);
    const query = encodeURIComponent(cleaned);
    
    // Skip empty queries
    if (!query || query.length < 3) return null;

    console.log(`[Geocode] Requesting: ${cleaned}`);

    // NOTE: We cannot set 'User-Agent' in a browser fetch (Forbidden Header Name).
    // We rely on the browser's default headers.
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    
    if (!response.ok) {
        console.warn(`[Geocode] Failed: ${response.status} ${response.statusText}`);
        return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      console.log(`[Geocode] Found: ${data[0].lat}, ${data[0].lon}`);
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    console.warn(`[Geocode] No results for: ${cleaned}`);
    return null;
  } catch (e) {
    console.warn('Geocoding error for:', address, e);
    return null;
  }
}

export async function estimateTravelTime(origin: string, destination: string): Promise<RouteResult | null> {
  console.log(`[Routing] Start: "${origin}" -> "${destination}"`);
  
  const googleMapsUrl = getGoogleMapsUrl(origin, destination);
  
  if (!origin || !destination) return null;

  try {
    // 1. Geocode both addresses
    const [start, end] = await Promise.all([geocode(origin), geocode(destination)]);
    
    if (!start || !end) {
      console.warn("[Routing] Geocoding failed for one or both addresses.");
      return null; 
    }

    // 2. Get Route from OSRM
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`
    );
    
    if (!response.ok) {
         console.warn(`[OSRM] Request failed: ${response.status}`);
         return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const seconds = data.routes[0].duration;
      const meters = data.routes[0].distance;
      
      const mins = Math.round(seconds / 60);
      const miles = (meters * 0.000621371).toFixed(1);

      console.log(`[Routing] Success: ${mins} mins, ${miles} mi`);

      return {
        durationText: `${mins} mins`,
        distanceText: `${miles} mi`,
        googleMapsUrl
      };
    }
  } catch (error) {
    console.error("[Routing] Unexpected error", error);
  }

  return null;
}
