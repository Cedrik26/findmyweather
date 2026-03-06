/**
 * Station API Tests
 * Integration tests for the station endpoints
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';

// Note: These are integration tests that require the server to be running
// For now, we'll test the validation logic directly

import { stationSearchSchema, stationDataSchema } from '../src/middleware/validation';

describe('stationSearchSchema validation', () => {
    test('should accept valid coordinates', () => {
        const result = stationSearchSchema.safeParse({
            lat: 52.52,
            lon: 13.405
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lat).toBe(52.52);
            expect(result.data.lon).toBe(13.405);
            expect(result.data.radiusKm).toBe(50);  // Default
            expect(result.data.maxStations).toBe(100);  // Default
        }
    });

    test('should reject invalid latitude', () => {
        const result = stationSearchSchema.safeParse({
            lat: 95,  // Invalid: > 90
            lon: 13.405
        });

        expect(result.success).toBe(false);
    });

    test('should reject invalid longitude', () => {
        const result = stationSearchSchema.safeParse({
            lat: 52.52,
            lon: 200  // Invalid: > 180
        });

        expect(result.success).toBe(false);
    });

    test('should reject radius > 500km', () => {
        const result = stationSearchSchema.safeParse({
            lat: 52.52,
            lon: 13.405,
            radiusKm: 600
        });

        expect(result.success).toBe(false);
    });

    test('should reject startYear > endYear', () => {
        const result = stationSearchSchema.safeParse({
            lat: 52.52,
            lon: 13.405,
            startYear: 2020,
            endYear: 2019
        });

        expect(result.success).toBe(false);
    });

    test('should coerce string values to numbers', () => {
        const result = stationSearchSchema.safeParse({
            lat: '52.52',
            lon: '13.405',
            radiusKm: '100'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lat).toBe(52.52);
            expect(result.data.radiusKm).toBe(100);
        }
    });
});

describe('stationDataSchema validation', () => {
    test('should accept valid parameters', () => {
        const result = stationDataSchema.safeParse({
            startYear: 2000,
            endYear: 2020
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startYear).toBe(2000);
            expect(result.data.endYear).toBe(2020);
            expect(result.data.metrics).toEqual(['TMAX', 'TMIN']);  // Default
        }
    });

    test('should parse comma-separated metrics', () => {
        const result = stationDataSchema.safeParse({
            startYear: 2000,
            endYear: 2020,
            metrics: 'TMAX,TMIN'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metrics).toContain('TMAX');
            expect(result.data.metrics).toContain('TMIN');
        }
    });

    test('should filter invalid metrics', () => {
        const result = stationDataSchema.safeParse({
            startYear: 2000,
            endYear: 2020,
            metrics: 'TMAX,INVALID,TMIN'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metrics).toEqual(['TMAX', 'TMIN']);
            expect(result.data.metrics).not.toContain('INVALID');
        }
    });

    test('should reject invalid field values', () => {
        const result = stationDataSchema.safeParse({
            startYear: 'not-a-number',
            endYear: 2020
        });

        expect(result.success).toBe(false);
    });

    test('should reject startYear > endYear', () => {
        const result = stationDataSchema.safeParse({
            startYear: 2020,
            endYear: 2010
        });

        expect(result.success).toBe(false);
    });

    test('should reject years outside valid range', () => {
        const result = stationDataSchema.safeParse({
            startYear: 1700,  // Too old
            endYear: 2020
        });

        expect(result.success).toBe(false);
    });
});
