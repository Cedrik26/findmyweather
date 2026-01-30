/**
 * GHCN Data Fetcher Service
 * Downloads and parses station metadata and weather data from NOAA GHCN
 */

import { config } from '../config';
import type { Station, DailyObservation, InventoryEntry, MetricType } from '../models/types';
import {
    insertStationsBatch,
    insertInventoryBatch,
    insertWeatherDataBatch,
    updateSyncStatus,
    getSyncStatus,
    getStationsCount,
    hasWeatherDataForStation
} from '../models/database';

// ==========================================
// Station Metadata Parsing
// ==========================================

/**
 * Parses the GHCN stations.txt fixed-width format
 * Format: ID (11 chars), LAT (8 chars), LON (9 chars), ELEV (6 chars), STATE (2 chars), NAME (30 chars)
 */
function parseStationsLine(line: string): Station | null {
    if (line.length < 85) return null;

    try {
        const id = line.substring(0, 11).trim();
        const lat = parseFloat(line.substring(12, 20).trim());
        const lon = parseFloat(line.substring(21, 30).trim());
        const elevation = parseFloat(line.substring(31, 37).trim()) || 0;
        const name = line.substring(41, 71).trim();

        if (!id || isNaN(lat) || isNaN(lon)) return null;

        return {
            id,
            name,
            lat,
            lon,
            elevation,
            firstYear: 0,  // Will be updated from inventory
            lastYear: 0
        };
    } catch {
        return null;
    }
}

/**
 * Parses the GHCN inventory.txt fixed-width format
 * Format: ID (11 chars), LAT (8 chars), LON (9 chars), ELEMENT (4 chars), FIRSTYEAR (4 chars), LASTYEAR (4 chars)
 */
function parseInventoryLine(line: string): InventoryEntry | null {
    if (line.length < 45) return null;

    try {
        const stationId = line.substring(0, 11).trim();
        const element = line.substring(31, 35).trim();
        const firstYear = parseInt(line.substring(36, 40).trim(), 10);
        const lastYear = parseInt(line.substring(41, 45).trim(), 10);

        if (!stationId || !element || isNaN(firstYear) || isNaN(lastYear)) return null;

        return { stationId, element, firstYear, lastYear };
    } catch {
        return null;
    }
}

/**
 * Downloads and parses station metadata from GHCN
 */
export async function fetchAndStoreStations(): Promise<number> {
    console.log('📡 Fetching GHCN station metadata...');

    // Check if we need to sync (sync once per day)
    const lastSync = getSyncStatus('stations');
    if (lastSync) {
        const lastSyncDate = new Date(lastSync.lastSync);
        const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceSync < 24 && lastSync.recordCount > 0) {
            console.log(`✅ Using cached stations (synced ${Math.round(hoursSinceSync)}h ago)`);
            return lastSync.recordCount;
        }
    }

    // Fetch stations
    const stationsResponse = await fetch(config.ghcn.stationsUrl);
    if (!stationsResponse.ok) {
        throw new Error(`Failed to fetch stations: ${stationsResponse.status}`);
    }
    const stationsText = await stationsResponse.text();

    // Parse stations
    const stations: Station[] = [];
    const stationMap = new Map<string, Station>();

    for (const line of stationsText.split('\n')) {
        const station = parseStationsLine(line);
        if (station) {
            stations.push(station);
            stationMap.set(station.id, station);
        }
    }

    console.log(`📊 Parsed ${stations.length} stations`);

    // Fetch inventory to get year ranges
    console.log('📡 Fetching GHCN inventory...');
    const inventoryResponse = await fetch(config.ghcn.inventoryUrl);
    if (!inventoryResponse.ok) {
        throw new Error(`Failed to fetch inventory: ${inventoryResponse.status}`);
    }
    const inventoryText = await inventoryResponse.text();

    // Parse inventory and update station year ranges
    const inventoryEntries: InventoryEntry[] = [];

    for (const line of inventoryText.split('\n')) {
        const entry = parseInventoryLine(line);
        if (entry && (entry.element === 'TMIN' || entry.element === 'TMAX')) {
            inventoryEntries.push(entry);

            // Update station year range
            const station = stationMap.get(entry.stationId);
            if (station) {
                if (station.firstYear === 0 || entry.firstYear < station.firstYear) {
                    station.firstYear = entry.firstYear;
                }
                if (entry.lastYear > station.lastYear) {
                    station.lastYear = entry.lastYear;
                }
            }
        }
    }

    console.log(`📊 Parsed ${inventoryEntries.length} inventory entries`);

    // Filter stations that have temperature data
    const stationsWithData = stations.filter(s => s.firstYear > 0 && s.lastYear > 0);
    console.log(`📊 ${stationsWithData.length} stations have temperature data`);

    // Store in database
    console.log('💾 Storing stations in database...');
    insertStationsBatch(stationsWithData);
    insertInventoryBatch(inventoryEntries);

    updateSyncStatus('stations', stationsWithData.length);
    updateSyncStatus('inventory', inventoryEntries.length);

    console.log('✅ Station sync complete');
    return stationsWithData.length;
}

// ==========================================
// Weather Data Parsing (CSV format)
// ==========================================

/**
 * Parses a line from GHCN daily access CSV format.
 * Format (see NOAA access/*.csv):
 *   "STATION","DATE","LATITUDE","LONGITUDE","ELEVATION","NAME",
 *   ... many element columns ...
 *   Each element value is like "   28" (tenths) and followed by "flag" column like ",,E".
 */
function parseWeatherAccessCsv(
    headerParts: string[],
    parts: string[],
    stationId: string
): DailyObservation[] {
    const out: DailyObservation[] = [];

    const station = unquote(parts[0] ?? '').trim();
    if (!station || station !== stationId) return out;

    const dateRaw = unquote(parts[1] ?? '').trim();
    if (!dateRaw) return out;

    const date = dateRaw.includes('-')
        ? dateRaw
        : `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;

    // Map header -> value
    for (let i = 0; i < headerParts.length && i < parts.length; i++) {
        const key = unquote(headerParts[i] ?? '').trim().toUpperCase();
        if (key !== 'TMIN' && key !== 'TMAX') continue;

        const raw = unquote(parts[i] ?? '').trim();
        if (!raw) continue;

        // value is tenths of °C
        const rawValue = parseInt(raw, 10);
        if (Number.isNaN(rawValue)) continue;

        out.push({
            stationId,
            date,
            element: key as MetricType,
            value: rawValue / 10,
            qualityFlag: '' // quality flags are in separate columns; we ignore them for now
        });
    }

    return out;
}

function unquote(v: string): string {
    const s = v ?? '';
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    return s;
}

/**
 * Minimaler CSV-Parser (RFC4180-ish) für NOAA GHCN access CSV.
 * Wichtig: Linien enthalten quoted Felder (z.B. "KOSCHING, GM").
 */
function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;

        if (ch === '"') {
            // Escaped quote innerhalb von Quotes ("")
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
            continue;
        }

        cur += ch;
    }

    out.push(cur);
    return out;
}

/**
 * Fetches and stores weather data for a specific station
 */
export async function fetchAndStoreStationData(stationId: string): Promise<number> {
    // Check if we already have data
    if (hasWeatherDataForStation(stationId)) {
        console.log(`✅ Using cached weather data for ${stationId}`);
        return 0;
    }

    console.log(`📡 Fetching weather data for station ${stationId}...`);

    const url = `${config.ghcn.dataBaseUrl}${stationId}.csv`;
    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`⚠️ No data file found for station ${stationId}`);
            return 0;
        }
        throw new Error(`Failed to fetch weather data: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
        console.warn(`⚠️ Empty CSV for station ${stationId}`);
        return 0;
    }

    const headerParts = parseCsvLine(lines[0]! ).map(s => s.trim());

    // Parse rows
    const observations: DailyObservation[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]!;
        const parts = parseCsvLine(line);
        const obs = parseWeatherAccessCsv(headerParts, parts, stationId);
        if (obs.length) observations.push(...obs);
    }

    console.log(`📊 Parsed ${observations.length} observations for ${stationId}`);

    if (observations.length > 0) {
        // Insert in batches to avoid memory issues
        const BATCH_SIZE = 5000;
        for (let i = 0; i < observations.length; i += BATCH_SIZE) {
            const batch = observations.slice(i, i + BATCH_SIZE);
            insertWeatherDataBatch(batch);
        }

        updateSyncStatus(`weather_${stationId}`, observations.length);
        console.log(`✅ Stored weather data for ${stationId}`);
    }

    return observations.length;
}

/**
 * Checks if stations need to be synced and syncs if necessary
 */
export async function ensureStationsLoaded(): Promise<void> {
    const count = getStationsCount();
    if (count === 0) {
        await fetchAndStoreStations();
    }
}
