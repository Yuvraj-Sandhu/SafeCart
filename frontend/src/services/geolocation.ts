import { STATE_NAME_TO_CODE } from '@/utils/stateMapping';

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

export interface LocationData {
  state: string;
  stateCode: string;
  city?: string;
  ip?: string;
}

// Get user location from IP
export async function detectUserLocation(): Promise<LocationData | null> {
  try {
    // Try multiple geolocation services in order of preference
    
    // Option 1: Try ipapi.co (supports HTTPS)
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();
        if (data.country_code === 'US' && data.region_code) {
          return {
            state: data.region,
            stateCode: data.region_code,
            city: data.city,
            ip: data.ip
          };
        }
        // If not US, still return null but don't try fallback
        return null;
      }
    } catch (e) {
      console.warn('ipapi.co failed, trying fallback service');
    }

    // Option 2: Try Vercel's built-in headers (fallback only if option 1 failed)
    try {
      const response = await fetch('/api/location');
      if (response.ok) {
        const data = await response.json();
        if (data.country === 'US' && data.region) {
          return {
            state: data.region,
            stateCode: data.regionCode,
            city: data.city,
            ip: data.ip
          };
        }
      }
    } catch (e) {
      console.warn('Vercel location API not available');
    }

    return null;
  } catch (error) {
    console.error('Error detecting location:', error);
    return null;
  }
}

// Get default state with location detection
export async function getDefaultState(): Promise<string> {
  try {
    const location = await detectUserLocation();
    
    if (location && location.stateCode) {
      // Convert state code to full state name
      const stateName = Object.entries(STATE_NAME_TO_CODE).find(
        ([name, code]) => code === location.stateCode
      )?.[0];
      
      if (stateName) {
        return stateName;
      }
    }
  } catch (error) {
    console.error('Error getting default state:', error);
  }

  // Default to California (full name)
  return 'California';
}