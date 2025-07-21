import { useState, useEffect } from 'react';
import { detectUserLocation, LocationData } from '@/services/geolocation';
import { ENABLE_AUTO_LOCATION } from '@/utils/stateMapping';

interface UseUserLocationResult {
  location: LocationData | null;
  isLoading: boolean;
  error: string | null;
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run if feature is enabled
    if (!ENABLE_AUTO_LOCATION) {
      return;
    }

    const fetchLocation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const locationData = await detectUserLocation();
        setLocation(locationData);
      } catch (err) {
        setError('Failed to detect location');
        console.error('Location detection error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocation();
  }, []); // Run once on mount

  return { location, isLoading, error };
}