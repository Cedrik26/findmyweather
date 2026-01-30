/**
 * Database Layer using Bun's built-in SQLite
 * No external dependencies required!
 */

import { Database } from 'bun:sqlite';
import { config } from '../config';
import type { Station, DailyObservation, InventoryEntry } from './types';
import * as fs from 'fs';
import * as path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
const db = new Database(config.dbPath);

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL');

// Flag to track if database is initialized
let isInitialized = false;

// ==========================================
// Schema Initialization
// ==========================================

export function initializeDatabase(): void {
  if (isInitialized) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      elevation REAL,
      first_year INTEGER,
      last_year INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL,
      date TEXT NOT NULL,
      element TEXT NOT NULL,
      value REAL,
      quality_flag TEXT,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_weather_station_date 
    ON weather_data(station_id, date)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_weather_station_element 
    ON weather_data(station_id, element)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_stations_coords 
    ON stations(lat, lon)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      station_id TEXT NOT NULL,
      element TEXT NOT NULL,
      first_year INTEGER,
      last_year INTEGER,
      PRIMARY KEY (station_id, element),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_status (
      key TEXT PRIMARY KEY,
      last_sync TEXT,
      record_count INTEGER
    )
  `);

  isInitialized = true;
  console.log('✅ Database initialized successfully');
}

// ==========================================
// Lazy Statement Preparation
// ==========================================

// Cache for prepared statements
const statements: Record<string, ReturnType<typeof db.prepare>> = {};

function getStatement(name: string, sql: string) {
  if (!statements[name]) {
    statements[name] = db.prepare(sql);
  }
  return statements[name]!;
}

// ==========================================
// Station Operations
// ==========================================

export function insertStation(station: Station): void {
  const stmt = getStatement('insertStation', `
    INSERT OR REPLACE INTO stations (id, name, lat, lon, elevation, first_year, last_year)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    station.id,
    station.name,
    station.lat,
    station.lon,
    station.elevation,
    station.firstYear,
    station.lastYear
  );
}

export function insertStationsBatch(stations: Station[]): void {
  const stmt = getStatement('insertStation', `
    INSERT OR REPLACE INTO stations (id, name, lat, lon, elevation, first_year, last_year)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction(() => {
    for (const station of stations) {
      stmt.run(
        station.id,
        station.name,
        station.lat,
        station.lon,
        station.elevation,
        station.firstYear,
        station.lastYear
      );
    }
  });
  insertMany();
}

export function getAllStations(): Station[] {
  const stmt = getStatement('getAllStations', `
    SELECT id, name, lat, lon, elevation, first_year as firstYear, last_year as lastYear
    FROM stations
  `);
  return stmt.all() as Station[];
}

export function getStationById(id: string): Station | undefined {
  const stmt = getStatement('getStationById', `
    SELECT id, name, lat, lon, elevation, first_year as firstYear, last_year as lastYear
    FROM stations
    WHERE id = ?
  `);
  return stmt.get(id) as Station | undefined;
}

export function getStationsCount(): number {
  const stmt = getStatement('getStationsCount', `
    SELECT COUNT(*) as count FROM stations
  `);
  const result = stmt.get() as { count: number };
  return result.count;
}

// ==========================================
// Weather Data Operations
// ==========================================

export function insertWeatherData(data: DailyObservation): void {
  const stmt = getStatement('insertWeather', `
    INSERT INTO weather_data (station_id, date, element, value, quality_flag)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.stationId,
    data.date,
    data.element,
    data.value,
    data.qualityFlag
  );
}

export function insertWeatherDataBatch(observations: DailyObservation[]): void {
  const stmt = getStatement('insertWeather', `
    INSERT INTO weather_data (station_id, date, element, value, quality_flag)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction(() => {
    for (const obs of observations) {
      stmt.run(
        obs.stationId,
        obs.date,
        obs.element,
        obs.value,
        obs.qualityFlag
      );
    }
  });
  insertMany();
}

export function getWeatherData(
  stationId: string,
  metrics: string[],
  startYear: number,
  endYear: number
): DailyObservation[] {
  const stmt = getStatement('getWeatherData', `
    SELECT station_id as stationId, date, element, value, quality_flag as qualityFlag
    FROM weather_data
    WHERE station_id = ?
      AND element IN (SELECT value FROM json_each(?))
      AND substr(date, 1, 4) BETWEEN ? AND ?
    ORDER BY date
  `);
  return stmt.all(
    stationId,
    JSON.stringify(metrics),
    startYear.toString(),
    endYear.toString()
  ) as DailyObservation[];
}

export function hasWeatherDataForStation(stationId: string): boolean {
  const stmt = getStatement('getWeatherDataCount', `
    SELECT COUNT(*) as count FROM weather_data WHERE station_id = ?
  `);
  const result = stmt.get(stationId) as { count: number };
  return result.count > 0;
}

// ==========================================
// Inventory Operations
// ==========================================

export function insertInventoryBatch(entries: InventoryEntry[]): void {
  const stmt = getStatement('insertInventory', `
    INSERT OR REPLACE INTO inventory (station_id, element, first_year, last_year)
    VALUES (?, ?, ?, ?)
  `);
  const insertMany = db.transaction(() => {
    for (const entry of entries) {
      stmt.run(
        entry.stationId,
        entry.element,
        entry.firstYear,
        entry.lastYear
      );
    }
  });
  insertMany();
}

export function getInventoryForStation(stationId: string): InventoryEntry[] {
  const stmt = getStatement('getInventoryForStation', `
    SELECT station_id as stationId, element, first_year as firstYear, last_year as lastYear
    FROM inventory
    WHERE station_id = ?
  `);
  return stmt.all(stationId) as InventoryEntry[];
}

// ==========================================
// Sync Status Operations
// ==========================================

export function updateSyncStatus(key: string, recordCount: number): void {
  const stmt = getStatement('updateSyncStatus', `
    INSERT OR REPLACE INTO sync_status (key, last_sync, record_count)
    VALUES (?, ?, ?)
  `);
  stmt.run(key, new Date().toISOString(), recordCount);
}

export function getSyncStatus(key: string): { lastSync: string; recordCount: number } | undefined {
  const stmt = getStatement('getSyncStatus', `
    SELECT last_sync as lastSync, record_count as recordCount
    FROM sync_status
    WHERE key = ?
  `);
  return stmt.get(key) as { lastSync: string; recordCount: number } | undefined;
}

// ==========================================
// Cleanup
// ==========================================

export function closeDatabase(): void {
  db.close();
}

export { db };
