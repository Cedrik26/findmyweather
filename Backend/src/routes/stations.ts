/**
 * Station Routes
 * API endpoints for searching stations and retrieving weather data
 */

import { Router, type Request, type Response } from 'express';
import {
    validateStationSearch,
    validateStationData,
    type ValidatedStationSearch,
    type ValidatedStationData
} from '../middleware/validation';
import { fetchStationData, ensureStationsLoaded, getAllStations, getStationById } from '../services/ghcnFetcher';
import { filterStationsByDistance } from '../services/distanceCalculator';
import { combineMetricsForChartJS } from '../services/weatherProcessor';
import {
    searchCache,
    weatherCache,
    getSearchCacheKey,
    getWeatherCacheKey
} from '../utils/cache';
import type { StationMetadata, ChartJSDataset, MetricType } from '../models/types';

const router = Router();

// ==========================================
// GET /stations - Search for nearby stations
// ==========================================

router.get(
    '/stations',
    validateStationSearch,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const params = (req as Request & { validated: ValidatedStationSearch }).validated;
            const { lat, lon, radiusKm, maxStations, startYear, endYear } = params;

            // Check cache
            const cacheKey = getSearchCacheKey(lat, lon, radiusKm, maxStations, startYear, endYear);
            const cached = searchCache.get<StationMetadata[]>(cacheKey);
            if (cached) {
                res.json(cached);
                return;
            }

            // Ensure stations are loaded
            await ensureStationsLoaded();

            // Get all stations from memory
            let stations = getAllStations();

            // Filter by year range if specified
            if (startYear || endYear) {
                stations = stations.filter(s => {
                    if (endYear && s.lastYear < endYear) return false;
                    if (startYear && s.firstYear > startYear) return false;
                    return true;
                });
            }

            const nearbyStations = filterStationsByDistance(
                stations,
                lat,
                lon,
                radiusKm,
                maxStations
            );

            const result: StationMetadata[] = nearbyStations.map(s => ({
                id: s.id,
                name: s.name,
                distanceKm: s.distanceKm,
                elevation: s.elevation,
                lat: s.lat,
                lon: s.lon,
                firstYear: s.firstYear,
                lastYear: s.lastYear
            }));

            searchCache.set(cacheKey, result);

            res.json(result);
        } catch (error) {
            console.error('Error in GET /stations:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
);

// ==========================================
// GET /stations/:id - Get station details
// ==========================================

router.get(
    '/stations/:id',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({
                    error: 'Bad Request',
                    message: 'Station ID is required'
                });
                return;
            }

            await ensureStationsLoaded();
            const station = getStationById(id);

            if (!station) {
                res.status(404).json({
                    error: 'Not Found',
                    message: `Station with ID '${id}' not found`
                });
                return;
            }

            res.json(station);
        } catch (error) {
            console.error('Error in GET /stations/:id:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
);

// ==========================================
// GET /stations/:id/data - Get weather data
// ==========================================

router.get(
    '/stations/:id/data',
    validateStationData,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.params.id as string;
            const params = (req as Request & { validated: ValidatedStationData }).validated;
            const { startYear, endYear, metrics } = params;

            if (!id) {
                res.status(400).json({
                    error: 'Bad Request',
                    message: 'Station ID is required'
                });
                return;
            }

            // Verify station exists
            await ensureStationsLoaded();
            const station = getStationById(id);
            if (!station) {
                res.status(404).json({
                    error: 'Not Found',
                    message: `Station with ID '${id}' not found`
                });
                return;
            }

            // Check cache
            const cacheKey = getWeatherCacheKey(id, startYear, endYear, metrics);
            const cached = weatherCache.get<ChartJSDataset>(cacheKey);
            if (cached) {
                res.json(cached);
                return;
            }

            // Fetch and filter data from GHCN S3 directly
            const observations = await fetchStationData(id, metrics as string[], startYear, endYear);

            if (observations.length === 0) {
                res.json({
                    labels: [],
                    datasets: [],
                    message: 'No data available for the specified time range'
                });
                return;
            }

            // Process data into Chart.js format
            const chartData = combineMetricsForChartJS(
                observations,
                startYear,
                endYear,
                metrics as MetricType[],
                true,  // Include seasonal data
                station.lat
            );

            // Cache result
            weatherCache.set(cacheKey, chartData);

            res.json(chartData);
        } catch (error) {
            console.error('Error in GET /stations/:id/data:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
);

export default router; 