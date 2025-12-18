
import React, { useEffect, useState } from 'react';
import { estimateTravelTime, RouteResult, getGoogleMapsUrl } from '../services/routingService';

interface TravelConnectorProps {
  origin?: string;
  destination?: string;
  index?: number; // Used for staggering API calls
}

export const TravelConnector: React.FC<TravelConnectorProps> = ({ origin, destination, index = 0 }) => {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [missingAddress, setMissingAddress] = useState(false);

  const fallbackUrl = (origin && destination) ? getGoogleMapsUrl(origin, destination) : '#';

  useEffect(() => {
    let isMounted = true;
    const STAGGER_DELAY_MS = 1200; // 1.2s delay per item to be safe with Nominatim limits

    if (!origin || !destination || origin.trim() === '' || destination.trim() === '') {
        setMissingAddress(true);
        setLoading(false);
        return;
    } else {
        setMissingAddress(false);
    }

    const fetchRoute = async () => {
      // Stagger the request based on index
      await new Promise(r => setTimeout(r, index * STAGGER_DELAY_MS));
      
      if (!isMounted) return;

      try {
        const result = await estimateTravelTime(origin, destination);
        if (isMounted) {
            if (result) {
                setRoute(result);
                setFailed(false);
            } else {
                setFailed(true);
            }
            setLoading(false);
        }
      } catch (e) {
          if (isMounted) {
              setFailed(true);
              setLoading(false);
          }
      }
    };

    setLoading(true);
    fetchRoute();

    return () => { isMounted = false; };
  }, [origin, destination, index]);

  // If we don't have addresses, we still show the connector line, but maybe a different badge or nothing
  if (missingAddress) {
      return (
        <div className="relative flex flex-col items-center py-3">
            <div className="absolute inset-0 left-1/2 -ml-px w-0.5 border-l-2 border-dashed border-slate-800 h-full z-0"></div>
            {/* Optional: Show a small dot or '?' if addresses are missing */}
            <div className="relative z-10 w-2 h-2 rounded-full bg-slate-700"></div>
        </div>
      );
  }

  return (
    <div className="relative flex flex-col items-center py-3">
      {/* Dotted Line */}
      <div className="absolute inset-0 left-1/2 -ml-px w-0.5 border-l-2 border-dashed border-slate-700 h-full z-0"></div>
      
      {/* Badge */}
      <a 
        href={route?.googleMapsUrl || fallbackUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className={`relative z-10 text-xs rounded-full px-3 py-1 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group border ${
            failed 
            ? 'bg-amber-900/80 border-amber-700 text-amber-200 hover:bg-amber-800 hover:border-amber-500' 
            : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-400 hover:text-cyan-300 hover:border-cyan-500'
        }`}
        title="Click to open Google Maps navigation"
      >
        {loading ? (
           <>
             <span className="animate-spin">⏳</span>
             <span>Calculating...</span>
           </>
        ) : failed ? (
           <>
             <span>⚠️</span>
             <span className="font-semibold">Tap to Route</span>
           </>
        ) : (
           <>
             <span className="text-lg leading-none">🚗</span>
             <span className="font-medium">{route?.durationText} <span className="opacity-50 mx-1">|</span> {route?.distanceText}</span>
           </>
        )}
      </a>
    </div>
  );
};
