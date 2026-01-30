/**
 * Distance Calculator Service
 * Implements Haversine formula for great-circle distance calculation
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * 
 * @param lat1 - Latitude of point 1 in degrees
 * @param lon1 - Longitude of point 1 in degrees
 * @param lat2 - Latitude of point 2 in degrees
 * @param lon2 - Longitude of point 2 in degrees
 * @returns Distance in kilometers
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Calculates approximate bounding box for initial filtering.
 * This is a performance optimization to reduce the number of Haversine calculations.
 * 
 * @param lat - Center latitude in degrees
 * @param lon - Center longitude in degrees
 * @param radiusKm - Radius in kilometers
 * @returns Bounding box coordinates
 */
export function getBoundingBox(
    lat: number,
    lon: number,
    radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
    // Approximate degrees per km at the equator
    const kmPerDegreeLat = 111.32;
    const kmPerDegreeLon = 111.32 * Math.cos(toRadians(lat));

    const deltaLat = radiusKm / kmPerDegreeLat;
    const deltaLon = radiusKm / (kmPerDegreeLon || 0.001); // Avoid division by zero at poles

    return {
        minLat: lat - deltaLat,
        maxLat: lat + deltaLat,
        minLon: lon - deltaLon,
        maxLon: lon + deltaLon
    };
}

/**
 * Filters stations by distance and returns sorted results
 * 
 * @param stations - Array of stations with lat/lon
 * @param centerLat - Search center latitude
 * @param centerLon - Search center longitude
 * @param radiusKm - Maximum distance in km
 * @param maxResults - Maximum number of results
 * @returns Sorted array of stations with calculated distances
 */
export function filterStationsByDistance<T extends { lat: number; lon: number }>(
    stations: T[],
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    maxResults: number
): (T & { distanceKm: number })[] {
    // First, apply bounding box filter for performance
    const box = getBoundingBox(centerLat, centerLon, radiusKm);

    const stationsWithDistance = stations
        .filter(station =>
            station.lat >= box.minLat &&
            station.lat <= box.maxLat &&
            station.lon >= box.minLon &&
            station.lon <= box.maxLon
        )
        .map(station => ({
            ...station,
            distanceKm: haversineDistance(centerLat, centerLon, station.lat, station.lon)
        }))
        .filter(station => station.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, maxResults);

    // Round distances to 2 decimal places
    return stationsWithDistance.map(s => ({
        ...s,
        distanceKm: Math.round(s.distanceKm * 100) / 100
    }));
}
