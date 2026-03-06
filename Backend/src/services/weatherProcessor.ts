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
 * Groups daily observations by month and calculates per-month averages.
 * Returns a Map<month, average> with only months that have valid data.
 */
function calculateMonthlyAverages(observations: DailyObservation[]): Map<number, number> {
    // Group values by month
    const monthGroups = new Map<number, number[]>();

    for (const obs of observations) {
        if (obs.value === null || obs.qualityFlag !== '') continue;
        const month = getMonth(obs.date);
        if (!monthGroups.has(month)) {
            monthGroups.set(month, []);
        }
        monthGroups.get(month)!.push(obs.value);
    }

    // Calculate average per month
    const monthlyAvgs = new Map<number, number>();
    for (const [month, values] of monthGroups) {
        const avg = calculateAverage(values);
        if (avg !== null) {
            monthlyAvgs.set(month, avg);
        }
    }

    return monthlyAvgs;
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


function isCrossYearSeason(month: number, latitude: number): boolean {
    const season = getSeasonForMonth(month, latitude);
    return (month === 12 || month <= 2) &&
        (season === 'winter' || season === 'summer');
}

function getCrossYearSeasonYear(date: string): number {
    const year = getYear(date);
    const month = getMonth(date);
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


export function calculateAnnualAverage(observations: DailyObservation[]): number | null {
    const monthlyAvgs = calculateMonthlyAverages(observations);
    if (monthlyAvgs.size === 0) return null;

    const monthValues = Array.from(monthlyAvgs.values());
    return calculateAverage(monthValues);
}

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

    // Group observations by (season, month) — each month collects daily values
    const seasonMonthGroups: Record<keyof SeasonalData, Map<number, number[]>> = {
        spring: new Map(),
        summer: new Map(),
        fall: new Map(),
        winter: new Map()
    };

    for (const obs of observations) {
        if (obs.value === null || obs.qualityFlag !== '') continue;

        const month = getMonth(obs.date);
        const obsYear = getYear(obs.date);
        const season = getSeasonForMonth(month, latitude);

        // Handle cross-year seasons (northern winter OR southern summer)
        if (isCrossYearSeason(month, latitude)) {
            const seasonYear = getCrossYearSeasonYear(obs.date);
            if (seasonYear === year) {
                if (!seasonMonthGroups[season].has(month)) {
                    seasonMonthGroups[season].set(month, []);
                }
                seasonMonthGroups[season].get(month)!.push(obs.value);
            }
        } else if (obsYear === year) {
            if (!seasonMonthGroups[season].has(month)) {
                seasonMonthGroups[season].set(month, []);
            }
            seasonMonthGroups[season].get(month)!.push(obs.value);
        }
    }

    // For each season: compute monthly averages, then average of those
    for (const season of ['spring', 'summer', 'fall', 'winter'] as (keyof SeasonalData)[]) {
        const monthMap = seasonMonthGroups[season];
        const monthlyAvgs: number[] = [];

        for (const [, values] of monthMap) {
            const avg = calculateAverage(values);
            if (avg !== null) {
                monthlyAvgs.push(avg);
            }
        }

        seasonalData[season] = calculateAverage(monthlyAvgs);
    }

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

        // For cross-year season calculations (northern winter / southern summer),
        // we need Dec from the previous year and Jan+Feb from the next year
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
