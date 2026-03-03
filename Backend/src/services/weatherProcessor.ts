/**
 * Weather Processor Service
 * Handles calculation of annual and seasonal averages from daily observations
 */

import type {
    DailyObservation,
    YearlyWeatherData,
    SeasonalData,
    ChartJSDataset,
    ChartJSDatasetEntry,
    MetricType
} from '../models/types';

// ==========================================
// Season Definitions (International Standard, Northern Hemisphere)
// ==========================================

interface SeasonRange {
    name: keyof SeasonalData;
    startMonth: number;  // 1-12
    endMonth: number;    // 1-12
}

// Meteorological seasons (Northern Hemisphere)
const SEASONS: SeasonRange[] = [
    { name: 'spring', startMonth: 3, endMonth: 5 },    // März - Mai
    { name: 'summer', startMonth: 6, endMonth: 8 },    // Juni - August
    { name: 'fall', startMonth: 9, endMonth: 11 },     // September - November
    { name: 'winter', startMonth: 12, endMonth: 2 }    // Dezember - Februar
];

// ==========================================
// Helper Functions
// ==========================================

/**
 * Extracts year from date string (YYYY-MM-DD)
 */
function getYear(date: string): number {
    return parseInt(date.substring(0, 4), 10);
}

/**
 * Extracts month from date string (YYYY-MM-DD)
 */
function getMonth(date: string): number {
    return parseInt(date.substring(5, 7), 10);
}

/**
 * Calculates average of numbers, handling null/empty arrays
 */
function calculateAverage(values: number[]): number | null {
    if (values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100; // Round to 2 decimals
}

/**
 * Gets the season for a given month
 */
function getSeasonForMonth(month: number, latitude: number): keyof SeasonalData {
    const isNorth = latitude >= 0;

    if (month >= 3 && month <= 5) return isNorth ? 'spring' : 'fall';
    if (month >= 6 && month <= 8) return isNorth ? 'summer' : 'winter';
    if (month >= 9 && month <= 11) return isNorth ? 'fall' : 'spring';

    // Monat 12, 1, 2
    return isNorth ? 'winter' : 'summer';
}

/**
 * Determines the "winter year" for a date.
 * Winter Dec 2020 - Feb 2021 belongs to winter year 2020.
 */
function getWinterYear(date: string): number {
    const year = getYear(date);
    const month = getMonth(date);
    // January and February belong to the previous year's winter
    if (month <= 2) return year - 1;
    return year;
}

// ==========================================
// Main Processing Functions
// ==========================================

/**
 * Groups observations by year
 */
function groupByYear(observations: DailyObservation[]): Map<number, DailyObservation[]> {
    const grouped = new Map<number, DailyObservation[]>();

    for (const obs of observations) {
        const year = getYear(obs.date);
        if (!grouped.has(year)) {
            grouped.set(year, []);
        }
        grouped.get(year)!.push(obs);
    }

    return grouped;
}

/**
 * Calculates annual average for a set of observations
 */
export function calculateAnnualAverage(observations: DailyObservation[]): number | null {
    const values = observations
        .filter(obs => obs.value !== null && obs.qualityFlag === '')
        .map(obs => obs.value);

    return calculateAverage(values);
}

/**
 * Calculates seasonal averages for a specific year
 */
export function calculateSeasonalAverages(
    observations: DailyObservation[],
    year: number,
    latitude: number
): SeasonalData {
    const seasonalData: SeasonalData = {
        spring: null,
        summer: null,
        fall: null,
        winter: null
    };

    // Group by season
    const seasonGroups: Record<keyof SeasonalData, number[]> = {
        spring: [],
        summer: [],
        fall: [],
        winter: []
    };

    for (const obs of observations) {
        if (obs.value === null || obs.qualityFlag !== '') continue;

        const month = getMonth(obs.date);
        const obsYear = getYear(obs.date);
        const season = getSeasonForMonth(month, latitude);

        // Handle winter specially (crosses year boundary)
        if (season === 'winter') {
            const winterYear = getWinterYear(obs.date);
            if (winterYear === year) {
                seasonGroups.winter.push(obs.value);
            }
        } else if (obsYear === year) {
            seasonGroups[season].push(obs.value);
        }
    }

    // Calculate averages
    seasonalData.spring = calculateAverage(seasonGroups.spring);
    seasonalData.summer = calculateAverage(seasonGroups.summer);
    seasonalData.fall = calculateAverage(seasonGroups.fall);
    seasonalData.winter = calculateAverage(seasonGroups.winter);

    return seasonalData;
}

/**
 * Processes observations into yearly weather data
 */
export function processWeatherData(
    observations: DailyObservation[],
    startYear: number,
    endYear: number,
    metric: MetricType,
    latitude: number
): YearlyWeatherData[] {
    // Filter by metric
    const filteredObs = observations.filter(obs => obs.element === metric);

    // Group by year
    const yearGroups = groupByYear(filteredObs);

    // Generate results for all years in range
    const results: YearlyWeatherData[] = [];

    for (let year = startYear; year <= endYear; year++) {
        const yearObs = yearGroups.get(year) || [];

        // For winter calculations, we also need data from adjacent years
        const extendedObs = [
            ...(yearGroups.get(year - 1)?.filter(o => getMonth(o.date) === 12) || []),
            ...yearObs,
            ...(yearGroups.get(year + 1)?.filter(o => getMonth(o.date) <= 2) || [])
        ];

        results.push({
            year,
            annualAvg: calculateAnnualAverage(yearObs),
            seasons: calculateSeasonalAverages(extendedObs, year, latitude)
        });
    }

    return results;
}

/**
 * Formats yearly data for Chart.js consumption
 */
export function formatForChartJS(
    yearlyData: YearlyWeatherData[],
    metric: MetricType,
    includeSeasons: boolean = true
): ChartJSDataset {
    const labels = yearlyData.map(d => d.year);
    const datasets: ChartJSDatasetEntry[] = [];

    // Annual average dataset
    datasets.push({
        label: `${metric} Jahresdurchschnitt`,
        data: yearlyData.map(d => d.annualAvg),
    });

    // Seasonal datasets (optional)
    if (includeSeasons) {
        const seasonNames: (keyof SeasonalData)[] = ['spring', 'summer', 'fall', 'winter'];
        const seasonLabels: Record<keyof SeasonalData, string> = {
            spring: 'Frühling',
            summer: 'Sommer',
            fall: 'Herbst',
            winter: 'Winter'
        };

        for (const season of seasonNames) {
            datasets.push({
                label: `${metric} ${seasonLabels[season]}`,
                data: yearlyData.map(d => d.seasons[season]),
            });
        }
    }

    return { labels, datasets };
}

/**
 * Combines multiple metrics into a single Chart.js dataset
 */
export function combineMetricsForChartJS(
    observations: DailyObservation[],
    startYear: number,
    endYear: number,
    metrics: MetricType[],
    includeSeasons: boolean = false,
    latitude: number
): ChartJSDataset {
    const labels: number[] = [];
    const datasets: ChartJSDatasetEntry[] = [];

    // Initialize labels
    for (let year = startYear; year <= endYear; year++) {
        labels.push(year);
    }

    for (const metric of metrics) {
        const yearlyData = processWeatherData(observations, startYear, endYear, metric, latitude);
        const chartData = formatForChartJS(yearlyData, metric, includeSeasons);
        datasets.push(...chartData.datasets);
    }

    return { labels, datasets };
}
