/**
 * Distance Calculator Tests
 */

import { describe, expect, test } from 'bun:test';
import { haversineDistance, getBoundingBox, filterStationsByDistance } from '../src/services/distanceCalculator';

describe('haversineDistance', () => {
    test('should return 0 for same coordinates', () => {
        const distance = haversineDistance(52.52, 13.405, 52.52, 13.405);
        expect(distance).toBe(0);
    });

    test('should calculate distance between Berlin and Munich correctly', () => {
        // Berlin: 52.52, 13.405
        // Munich: 48.1351, 11.582
        // Expected distance: ~504 km
        const distance = haversineDistance(52.52, 13.405, 48.1351, 11.582);
        expect(distance).toBeGreaterThan(500);
        expect(distance).toBeLessThan(510);
    });

    test('should calculate distance between New York and London correctly', () => {
        // New York: 40.7128, -74.0060
        // London: 51.5074, -0.1278
        // Expected distance: ~5570 km
        const distance = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
        expect(distance).toBeGreaterThan(5550);
        expect(distance).toBeLessThan(5600);
    });

    test('should handle antipodal points', () => {
        // North Pole to South Pole
        const distance = haversineDistance(90, 0, -90, 0);
        // Half Earth circumference: ~20,000 km
        expect(distance).toBeGreaterThan(19900);
        expect(distance).toBeLessThan(20100);
    });

    test('should handle crossing the date line', () => {
        // Tokyo: 35.6762, 139.6503
        // Los Angeles: 34.0522, -118.2437
        const distance = haversineDistance(35.6762, 139.6503, 34.0522, -118.2437);
        // Expected: ~8815 km
        expect(distance).toBeGreaterThan(8700);
        expect(distance).toBeLessThan(9000);
    });
});

describe('getBoundingBox', () => {
    test('should return correct bounding box for Berlin with 50km radius', () => {
        const box = getBoundingBox(52.52, 13.405, 50);

        // 50km is roughly 0.45 degrees latitude
        expect(box.minLat).toBeLessThan(52.52);
        expect(box.maxLat).toBeGreaterThan(52.52);
        expect(box.minLon).toBeLessThan(13.405);
        expect(box.maxLon).toBeGreaterThan(13.405);

        // Check approximate range
        expect(box.maxLat - box.minLat).toBeGreaterThan(0.8);
        expect(box.maxLat - box.minLat).toBeLessThan(1.0);
    });

    test('should handle equator location', () => {
        const box = getBoundingBox(0, 0, 100);

        expect(box.minLat).toBeLessThan(0);
        expect(box.maxLat).toBeGreaterThan(0);
        expect(box.minLon).toBeLessThan(0);
        expect(box.maxLon).toBeGreaterThan(0);
    });
});

describe('filterStationsByDistance', () => {
    const mockStations = [
        { id: '1', name: 'Station 1', lat: 52.52, lon: 13.405 },      // Berlin
        { id: '2', name: 'Station 2', lat: 52.5, lon: 13.4 },         // Near Berlin
        { id: '3', name: 'Station 3', lat: 48.1351, lon: 11.582 },    // Munich
        { id: '4', name: 'Station 4', lat: 51.5074, lon: -0.1278 },   // London
    ];

    test('should return empty array when no stations in radius', () => {
        const result = filterStationsByDistance(
            mockStations,
            35.6762, 139.6503,  // Tokyo
            100,  // 100km radius
            10
        );
        expect(result).toHaveLength(0);
    });

    test('should find nearby stations in Berlin', () => {
        const result = filterStationsByDistance(
            mockStations,
            52.52, 13.405,  // Berlin center
            50,  // 50km radius
            10
        );

        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result[0]?.id).toBe('1');  // Berlin station should be closest (distance 0)
        expect(result[0]?.distanceKm).toBe(0);
    });

    test('should respect maxStations limit', () => {
        const result = filterStationsByDistance(
            mockStations,
            52.52, 13.405,
            1000,  // Large radius to include Munich
            2
        );

        expect(result).toHaveLength(2);
    });

    test('should sort by distance ascending', () => {
        const result = filterStationsByDistance(
            mockStations,
            52.52, 13.405,
            600,
            10
        );

        for (let i = 1; i < result.length; i++) {
            expect(result[i]!.distanceKm).toBeGreaterThanOrEqual(result[i - 1]!.distanceKm);
        }
    });

    test('should include distanceKm in result', () => {
        const result = filterStationsByDistance(
            mockStations,
            52.52, 13.405,
            600,
            10
        );

        for (const station of result) {
            expect(station.distanceKm).toBeDefined();
            expect(typeof station.distanceKm).toBe('number');
        }
    });
});
