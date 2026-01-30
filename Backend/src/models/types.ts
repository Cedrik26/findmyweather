// ==========================================
// Request Types
// ==========================================

export interface StationSearchParams {
    lat: number;
    lon: number;
    radiusKm?: number;
    maxStations?: number;
    startYear?: number;
    endYear?: number;
}

export interface StationDataParams {
    stationId: string;
    startYear: number;
    endYear: number;
    metrics?: MetricType[];
}

export type MetricType = 'TMIN' | 'TMAX';

// ==========================================
// Response Types
// ==========================================

export interface StationMetadata {
    id: string;
    name: string;
    distanceKm: number;
    elevation: number;
    lat: number;
    lon: number;
    firstYear: number;
    lastYear: number;
}

export interface SeasonalData {
    spring: number | null;   // März-Mai (Nordhalbkugel)
    summer: number | null;   // Juni-August
    fall: number | null;     // September-November
    winter: number | null;   // Dezember-Februar
}

export interface YearlyWeatherData {
    year: number;
    annualAvg: number | null;
    seasons: SeasonalData;
}

// Chart.js kompatibles Format
export interface ChartJSDataset {
    labels: number[];
    datasets: ChartJSDatasetEntry[];
}

export interface ChartJSDatasetEntry {
    label: string;
    data: (number | null)[];
    borderColor?: string;
    backgroundColor?: string;
    tension?: number;
    fill?: boolean;
}

// ==========================================
// Database Types
// ==========================================

export interface Station {
    id: string;
    name: string;
    lat: number;
    lon: number;
    elevation: number;
    firstYear: number;
    lastYear: number;
}

export interface DailyObservation {
    stationId: string;
    date: string;          // YYYY-MM-DD Format
    element: MetricType;
    value: number;         // Temperatur in °C (bereits konvertiert von 1/10°C)
    qualityFlag: string;
}

export interface InventoryEntry {
    stationId: string;
    element: string;
    firstYear: number;
    lastYear: number;
}

// ==========================================
// API Error Types
// ==========================================

export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
}
