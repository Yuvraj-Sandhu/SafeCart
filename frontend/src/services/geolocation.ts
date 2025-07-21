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
    // Using ip-api.com free service (no API key required)
    // Note: Free tier only supports HTTP
    const response = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,query');
    
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }

    const data: IpApiResponse = await response.json();

    // Check if request was successful and user is in US
    if (data.status === 'success' && data.countryCode === 'US' && data.region) {
      return {
        state: data.regionName,
        stateCode: data.region, // ip-api returns state code in 'region' field
        city: data.city,
        ip: data.query
      };
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