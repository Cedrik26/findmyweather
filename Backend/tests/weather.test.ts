/**
 * Weather Processor Tests
 */

import { describe, expect, test } from 'bun:test';
import {
    calculateAnnualAverage,
    calculateSeasonalAverages,
    processWeatherData,
    formatForChartJS,
    combineMetricsForChartJS
} from '../src/services/weatherProcessor';
import type { DailyObservation } from '../src/models/types';

// Helper to create mock observations
function createObs(
    date: string,
    value: number,
    element: 'TMIN' | 'TMAX' = 'TMAX',
    qualityFlag: string = ''
): DailyObservation {
    return {
        stationId: 'TEST001',
        date,
        element,
        value,
        qualityFlag
    };
}

describe('calculateAnnualAverage', () => {
    test('should return null for empty array', () => {
        const result = calculateAnnualAverage([]);
        expect(result).toBeNull();
    });

    test('should calculate average correctly', () => {
        const observations: DailyObservation[] = [
            createObs('2020-01-15', 10),
            createObs('2020-06-15', 20),
            createObs('2020-12-15', 5),
        ];

        const result = calculateAnnualAverage(observations);
        expect(result).toBe(11.67);  // (10 + 20 + 5) / 3 = 11.67
    });

    test('should exclude observations with quality flags', () => {
        const observations: DailyObservation[] = [
            createObs('2020-01-15', 10),
            createObs('2020-06-15', 100, 'TMAX', 'X'),  // Quality flag, should be excluded
            createObs('2020-12-15', 20),
        ];

        const result = calculateAnnualAverage(observations);
        expect(result).toBe(15);  // (10 + 20) / 2 = 15
    });
});

describe('calculateSeasonalAverages', () => {
    test('should calculate all four seasons correctly', () => {
        const observations: DailyObservation[] = [
            // Spring (March-May)
            createObs('2020-03-15', 10),
            createObs('2020-04-15', 12),
            createObs('2020-05-15', 15),
            // Summer (June-August)
            createObs('2020-06-15', 25),
            createObs('2020-07-15', 28),
            createObs('2020-08-15', 26),
            // Fall (September-November)
            createObs('2020-09-15', 18),
            createObs('2020-10-15', 12),
            createObs('2020-11-15', 8),
            // Winter (December 2020, January-February 2021)
            createObs('2020-12-15', 2),
            createObs('2021-01-15', 0),
            createObs('2021-02-15', 3),
        ];

        const result = calculateSeasonalAverages(observations, 2020);

        expect(result.spring).toBe(12.33);  // (10 + 12 + 15) / 3
        expect(result.summer).toBe(26.33);  // (25 + 28 + 26) / 3
        expect(result.fall).toBe(12.67);    // (18 + 12 + 8) / 3
        expect(result.winter).toBe(1.67);   // (2 + 0 + 3) / 3
    });

    test('should return null for missing seasons', () => {
        const observations: DailyObservation[] = [
            createObs('2020-06-15', 25),  // Only summer data
            createObs('2020-07-15', 28),
        ];

        const result = calculateSeasonalAverages(observations, 2020);

        expect(result.spring).toBeNull();
        expect(result.summer).toBe(26.5);
        expect(result.fall).toBeNull();
        expect(result.winter).toBeNull();
    });

    test('should handle winter year crossover correctly', () => {
        const observations: DailyObservation[] = [
            // Winter 2019-2020 (belongs to year 2019)
            createObs('2019-12-15', -5),
            createObs('2020-01-15', -3),
            createObs('2020-02-15', 0),
            // Winter 2020-2021 (belongs to year 2020)
            createObs('2020-12-15', 2),
            createObs('2021-01-15', 1),
            createObs('2021-02-15', 3),
        ];

        // For year 2019, winter should include Dec 2019, Jan 2020, Feb 2020
        const result2019 = calculateSeasonalAverages(observations, 2019);
        expect(result2019.winter).toBe(-2.67);  // (-5 + -3 + 0) / 3

        // For year 2020, winter should include Dec 2020, Jan 2021, Feb 2021
        const result2020 = calculateSeasonalAverages(observations, 2020);
        expect(result2020.winter).toBe(2);  // (2 + 1 + 3) / 3
    });
});

describe('processWeatherData', () => {
    test('should process data for specified year range', () => {
        const observations: DailyObservation[] = [
            createObs('2018-06-15', 20),
            createObs('2019-06-15', 22),
            createObs('2020-06-15', 25),
            createObs('2021-06-15', 23),
            createObs('2022-06-15', 24),
        ];

        const result = processWeatherData(observations, 2019, 2021, 'TMAX');

        expect(result).toHaveLength(3);
        expect(result[0]?.year).toBe(2019);
        expect(result[1]?.year).toBe(2020);
        expect(result[2]?.year).toBe(2021);
    });

    test('should filter by metric type', () => {
        const observations: DailyObservation[] = [
            createObs('2020-06-15', 25, 'TMAX'),
            createObs('2020-06-15', 15, 'TMIN'),
        ];

        const resultMax = processWeatherData(observations, 2020, 2020, 'TMAX');
        expect(resultMax[0]?.annualAvg).toBe(25);

        const resultMin = processWeatherData(observations, 2020, 2020, 'TMIN');
        expect(resultMin[0]?.annualAvg).toBe(15);
    });

    test('should handle years with no data', () => {
        const observations: DailyObservation[] = [
            createObs('2018-06-15', 20),
            createObs('2020-06-15', 25),
        ];

        const result = processWeatherData(observations, 2018, 2020, 'TMAX');

        expect(result).toHaveLength(3);
        expect(result[0]?.annualAvg).toBe(20);
        expect(result[1]?.annualAvg).toBeNull();  // 2019 has no data
        expect(result[2]?.annualAvg).toBe(25);
    });
});

describe('formatForChartJS', () => {
    test('should format data correctly for Chart.js', () => {
        const yearlyData = [
            {
                year: 2020,
                annualAvg: 15.5,
                seasons: { spring: 12, summer: 25, fall: 15, winter: 2 }
            },
            {
                year: 2021,
                annualAvg: 16.2,
                seasons: { spring: 13, summer: 26, fall: 14, winter: 3 }
            }
        ];

        const result = formatForChartJS(yearlyData, 'TMAX', true);

        expect(result.labels).toEqual([2020, 2021]);
        expect(result.datasets).toHaveLength(5);  // Annual + 4 seasons
        expect(result.datasets[0]?.label).toContain('TMAX');
        expect(result.datasets[0]?.label).toContain('Jahresdurchschnitt');
        expect(result.datasets[0]?.data).toEqual([15.5, 16.2]);
    });

    test('should handle null values correctly', () => {
        const yearlyData = [
            {
                year: 2020,
                annualAvg: 15.5,
                seasons: { spring: null, summer: 25, fall: null, winter: 2 }
            }
        ];

        const result = formatForChartJS(yearlyData, 'TMAX', true);

        // Null values should be preserved for Chart.js to handle gaps
        const springDataset = result.datasets.find(d => d.label.includes('Frühling'));
        expect(springDataset?.data[0]).toBeNull();
    });

    test('should exclude seasons when flag is false', () => {
        const yearlyData = [
            {
                year: 2020,
                annualAvg: 15.5,
                seasons: { spring: 12, summer: 25, fall: 15, winter: 2 }
            }
        ];

        const result = formatForChartJS(yearlyData, 'TMAX', false);

        expect(result.datasets).toHaveLength(1);  // Only annual
    });
});

describe('combineMetricsForChartJS', () => {
    test('should combine multiple metrics into one dataset', () => {
        const observations: DailyObservation[] = [
            createObs('2020-06-15', 25, 'TMAX'),
            createObs('2020-06-15', 15, 'TMIN'),
            createObs('2021-06-15', 27, 'TMAX'),
            createObs('2021-06-15', 17, 'TMIN'),
        ];

        const result = combineMetricsForChartJS(observations, 2020, 2021, ['TMAX', 'TMIN'], false);

        expect(result.labels).toEqual([2020, 2021]);
        expect(result.datasets).toHaveLength(2);  // TMAX and TMIN

        const tmaxDataset = result.datasets.find(d => d.label.includes('TMAX'));
        const tminDataset = result.datasets.find(d => d.label.includes('TMIN'));

        expect(tmaxDataset).toBeDefined();
        expect(tminDataset).toBeDefined();
    });
});
