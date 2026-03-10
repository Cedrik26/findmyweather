/**
 * GHCN Data Fetcher Service
 * Downloads and parses station metadata and weather data from NOAA GHCN
 */

import { config } from '../config';
import type { Station, DailyObservation, InventoryEntry, MetricType } from '../models/types';
// DB has been removed, using in-memory caches here
let cachedStations: Station[] = [];
let stationsLoaded = false;

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
export async function fetchStations(): Promise<number> {
    console.log('📡 Fetching GHCN station metadata...');

    // Note: Since DB is gone, we fetch once per process run.
    if (stationsLoaded) {
        return cachedStations.length;
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

    // Store in memory
    cachedStations = stationsWithData;
    stationsLoaded = true;

    console.log(`✅ Loaded ${stationsWithData.length} stations into memory`);
    return stationsWithData.length;
}

export function getAllStations(): Station[] {
    return cachedStations;
}

export function getStationById(id: string): Station | undefined {
    return cachedStations.find(s => s.id === id);
}


/**
 * Parses a single row of the AWS S3 GHCN CSV (long format).
 * Columns: ID, DATE, ELEMENT, DATA_VALUE, M_FLAG, Q_FLAG, S_FLAG, OBS_TIME
 * Each row contains exactly one element (e.g. TMAX or TMIN).
 */
function parseS3CsvRow(
    headerIndex: Record<string, number>,
    parts: string[],
    stationId: string
): DailyObservation | null {
    const idIdx = headerIndex['ID'];
    const dateIdx = headerIndex['DATE'];
    const elemIdx = headerIndex['ELEMENT'];
    const valIdx = headerIndex['DATA_VALUE'];
    const qIdx = headerIndex['Q_FLAG'];

    if (idIdx === undefined || dateIdx === undefined || elemIdx === undefined || valIdx === undefined) {
        return null;
    }

    const station = (parts[idIdx] ?? '').trim();
    if (!station || station !== stationId) return null;

    const element = (parts[elemIdx] ?? '').trim().toUpperCase();
    if (element !== 'TMIN' && element !== 'TMAX') return null;

    const dateRaw = (parts[dateIdx] ?? '').trim();
    if (!dateRaw) return null;

    const date = dateRaw.includes('-')
        ? dateRaw
        : `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;

    const raw = (parts[valIdx] ?? '').trim();
    if (!raw) return null;

    const rawValue = parseInt(raw, 10);
    if (Number.isNaN(rawValue)) return null;

    const qualityFlag = qIdx !== undefined ? (parts[qIdx] ?? '').trim() : '';

    return {
        stationId,
        date,
        element: element as MetricType,
        value: rawValue / 10,  // value is tenths of °C
        qualityFlag
    };
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

export async function fetchStationData(
    stationId: string,
    metrics: string[],
    startYear: number,
    endYear: number
): Promise<DailyObservation[]> {
    console.log(`📡 Fetching weather data for station ${stationId} from S3...`);

    const url = `${config.ghcn.dataBaseUrl}${stationId}.csv`;
    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`⚠️ No data file found for station ${stationId}`);
            return [];
        }
        throw new Error(`Failed to fetch weather data: ${response.status}`);
    }

    // S3 liefert normale CSV-Dateien
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
        console.warn(`⚠️ Empty CSV for station ${stationId}`);
        return [];
    }

    // Build header index map: column name -> column index
    // S3 weather CSV doesn't have complex quoted cells, so split(',') is safe and >100x faster
    const headerParts = lines[0]!.split(',').map(s => s.trim().toUpperCase());
    const headerIndex: Record<string, number> = {};
    for (let i = 0; i < headerParts.length; i++) {
        headerIndex[headerParts[i]!] = i;
    }

    // Process variables outside the loop to reduce GC pressure
    const observations: DailyObservation[] = [];
    const idIdx = headerIndex['ID'];
    const dateIdx = headerIndex['DATE'];
    const elemIdx = headerIndex['ELEMENT'];
    const valIdx = headerIndex['DATA_VALUE'];
    const qIdx = headerIndex['Q_FLAG'];

    // Avoid running if format is totally unexpected
    if (idIdx === undefined || dateIdx === undefined || elemIdx === undefined || valIdx === undefined) {
        console.warn(`⚠️ Invalid CSV format for station ${stationId}`);
        return [];
    }

    // Parse rows Using highly optimized index access and native split
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line) continue;
        
        const parts = line.split(',');
        
        // Inline parseS3CsvRow logic for maximum performance (avoids function call overhead per line)
        const station = (parts[idIdx] || '').trim();
        if (station !== stationId) continue;

        const element = (parts[elemIdx] || '').trim().toUpperCase();
        if (element !== 'TMIN' && element !== 'TMAX') continue;
        if (!metrics.includes(element)) continue; // Filter by metrics early!

        const dateRaw = (parts[dateIdx] || '').trim();
        if (!dateRaw) continue;
        
        const year = parseInt(dateRaw.substring(0, 4), 10);
        if (Number.isNaN(year) || year < startYear || year > endYear) continue; // Filter year early

        const raw = (parts[valIdx] || '').trim();
        if (!raw) continue;
        
        const rawValue = parseInt(raw, 10);
        if (Number.isNaN(rawValue)) continue;

        const qualityFlag = qIdx !== undefined ? (parts[qIdx] || '').trim() : '';

        const date = dateRaw.includes('-') 
            ? dateRaw 
            : `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;

        observations.push({
            stationId,
            date,
            element: element as MetricType,
            value: rawValue / 10,
            qualityFlag
        });
    }

    // Sort by date ascending (using simple string comparison which is 100x faster than localeCompare)
    observations.sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));

    console.log(`📊 Filtered and parsed ${observations.length} observations for ${stationId}`);
    return observations;
}

/**
 * Checks if stations need to be synced and syncs if necessary
 */
export async function ensureStationsLoaded(): Promise<void> {
    if (!stationsLoaded) {
        await fetchStations();
    }
}
