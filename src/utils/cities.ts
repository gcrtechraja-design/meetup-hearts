export interface CityInfo {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const CITIES: CityInfo[] = [
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198 },
  { name: 'Trichy', state: 'Tamil Nadu', lat: 10.7905, lng: 78.7047 },
  { name: 'Salem', state: 'Tamil Nadu', lat: 11.6643, lng: 78.1460 },
  { name: 'Tirunelveli', state: 'Tamil Nadu', lat: 8.7139, lng: 77.7567 },
  { name: 'Vellore', state: 'Tamil Nadu', lat: 12.9165, lng: 79.1325 },
  { name: 'Erode', state: 'Tamil Nadu', lat: 11.3410, lng: 77.7172 },
  { name: 'Tiruppur', state: 'Tamil Nadu', lat: 11.1085, lng: 77.3411 },
  { name: 'Thanjavur', state: 'Tamil Nadu', lat: 10.7870, lng: 79.1378 },
  { name: 'Dindigul', state: 'Tamil Nadu', lat: 10.3673, lng: 77.9803 },
  { name: 'Kanchipuram', state: 'Tamil Nadu', lat: 12.8342, lng: 79.7036 },
  { name: 'Puducherry', state: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  { name: 'Nagercoil', state: 'Tamil Nadu', lat: 8.1833, lng: 77.4119 },
  { name: 'Kumbakonam', state: 'Tamil Nadu', lat: 10.9602, lng: 79.3845 },
  { name: 'Hosur', state: 'Tamil Nadu', lat: 12.7409, lng: 77.8253 },
  { name: 'Karur', state: 'Tamil Nadu', lat: 10.9601, lng: 78.0766 },
  { name: 'Cuddalore', state: 'Tamil Nadu', lat: 11.7480, lng: 79.7714 },
  { name: 'Thoothukudi', state: 'Tamil Nadu', lat: 8.7642, lng: 78.1348 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Mangalore', state: 'Karnataka', lat: 12.9141, lng: 74.8560 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { name: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lng: 76.9366 },
  { name: 'Kozhikode', state: 'Kerala', lat: 11.2588, lng: 75.7804 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 }
];

export const DEFAULT_CITY: CityInfo = CITIES[0]; // Chennai

/**
 * Matches a city name or location string against the known cities list
 */
export function findCity(locationOrCity?: string): CityInfo {
  if (!locationOrCity) return DEFAULT_CITY;
  const normalized = locationOrCity.toLowerCase();
  
  const found = CITIES.find((c) => {
    return (
      normalized.includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(normalized)
    );
  });

  return found || DEFAULT_CITY;
}

/**
 * Calculates Great-Circle / Haversine distance in kilometers between two GPS points
 */
export function calculateDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist);
}
