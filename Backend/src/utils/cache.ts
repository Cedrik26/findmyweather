/**
 * Cache Utility
 * In-memory caching using node-cache for fast response times
 */

import NodeCache from 'node-cache';
import { config } from '../config';

// Station search results cache (short TTL)
export const searchCache = new NodeCache({
    stdTTL: config.cache.searchTTL,
    checkperiod: 60,
    useClones: false  // Better performance, but be careful with mutations
});

// Weather data cache (medium TTL)
export const weatherCache = new NodeCache({
    stdTTL: config.cache.weatherTTL,
    checkperiod: 120,
    useClones: false
});

// Station metadata cache (long TTL)
export const stationCache = new NodeCache({
    stdTTL: config.cache.stationsTTL,
    checkperiod: 600,
    useClones: false
});

/**
 * Generates a cache key for station search
 */
export function getSearchCacheKey(
    lat: number,
    lon: number,
    radiusKm: number,
    maxStations: number,
    startYear?: number,
    endYear?: number
): string {
    return `search:${lat}:${lon}:${radiusKm}:${maxStations}:${startYear || 'any'}:${endYear || 'any'}`;
}

/**
 * Generates a cache key for weather data
 */
export function getWeatherCacheKey(
    stationId: string,
    startYear: number,
    endYear: number,
    metrics: string[]
): string {
    return `weather:${stationId}:${startYear}:${endYear}:${metrics.sort().join(',')}`;
}

/**
 * Cache statistics for monitoring
 */
export function getCacheStats(): Record<string, unknown> {
    return {
        search: searchCache.getStats(),
        weather: weatherCache.getStats(),
        station: stationCache.getStats()
    };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
    searchCache.flushAll();
    weatherCache.flushAll();
    stationCache.flushAll();
}
