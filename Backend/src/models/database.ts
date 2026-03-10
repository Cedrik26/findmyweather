/**
 * Database Layer using PostgreSQL (pg)
 * Async connection pool for scalability
 */

import { Pool } from 'pg';
import { config } from '../config';
import type { Station, DailyObservation, InventoryEntry } from './types';

// ==========================================
// Connection Pool
// ==========================================

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Flag to track if database is initialized
let isInitialized = false;

// ==========================================
// Schema Initialization
// ==========================================

export async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;

  await pool.query(`
        CREATE TABLE IF NOT EXISTS stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lon DOUBLE PRECISION NOT NULL,
            elevation DOUBLE PRECISION,
            first_year INTEGER,
            last_year INTEGER
        )
    `);

  await pool.query(`
        CREATE TABLE IF NOT EXISTS weather_data (
            id SERIAL PRIMARY KEY,
            station_id TEXT NOT NULL REFERENCES stations(id),
            date TEXT NOT NULL,
            element TEXT NOT NULL,
            value DOUBLE PRECISION,
            quality_flag TEXT
        )
    `);

  await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_weather_station_date 
        ON weather_data(station_id, date)
    `);

  await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_weather_station_element 
        ON weather_data(station_id, element)
    `);

  await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_stations_coords 
        ON stations(lat, lon)
    `);

  await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
            station_id TEXT NOT NULL,
            element TEXT NOT NULL,
            first_year INTEGER,
            last_year INTEGER,
            PRIMARY KEY (station_id, element),
            FOREIGN KEY (station_id) REFERENCES stations(id)
        )
    `);

  await pool.query(`
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
// Station Operations
// ==========================================

export async function insertStation(station: Station): Promise<void> {
  await pool.query(
    `INSERT INTO stations (id, name, lat, lon, elevation, first_year, last_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           lat = EXCLUDED.lat,
           lon = EXCLUDED.lon,
           elevation = EXCLUDED.elevation,
           first_year = EXCLUDED.first_year,
           last_year = EXCLUDED.last_year`,
    [station.id, station.name, station.lat, station.lon, station.elevation, station.firstYear, station.lastYear]
  );
}

export async function insertStationsBatch(stations: Station[]): Promise<void> {
  if (stations.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Process in batches of 1000 to avoid exceeding parameter limits
    const BATCH_SIZE = 1000;
    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);
      const params: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;
      
      for (const station of batch) {
        placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(station.id, station.name, station.lat, station.lon, station.elevation, station.firstYear, station.lastYear);
      }
      
      const stmt = `
          INSERT INTO stations (id, name, lat, lon, elevation, first_year, last_year)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            elevation = EXCLUDED.elevation,
            first_year = EXCLUDED.first_year,
            last_year = EXCLUDED.last_year
      `;
      
      await client.query(stmt, params);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllStations(): Promise<Station[]> {
  const result = await pool.query(
    `SELECT id, name, lat, lon, elevation, first_year AS "firstYear", last_year AS "lastYear"
         FROM stations`
  );
  return result.rows as Station[];
}

export async function getStationById(id: string): Promise<Station | undefined> {
  const result = await pool.query(
    `SELECT id, name, lat, lon, elevation, first_year AS "firstYear", last_year AS "lastYear"
         FROM stations
         WHERE id = $1`,
    [id]
  );
  return (result.rows[0] as Station) ?? undefined;
}

export async function getStationsCount(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) AS count FROM stations');
  return parseInt(result.rows[0].count, 10);
}

// ==========================================
// Weather Data Operations
// ==========================================

export async function insertWeatherData(data: DailyObservation): Promise<void> {
  await pool.query(
    `INSERT INTO weather_data (station_id, date, element, value, quality_flag)
         VALUES ($1, $2, $3, $4, $5)`,
    [data.stationId, data.date, data.element, data.value, data.qualityFlag]
  );
}

export async function insertWeatherDataBatch(observations: DailyObservation[]): Promise<void> {
  if (observations.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // observations already comes from ghcnFetcher in batches of 5000, 
    // which gives 25000 parameters (well under the 65535 limit)
    const params: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const obs of observations) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(obs.stationId, obs.date, obs.element, obs.value, obs.qualityFlag);
    }

    const stmt = `
        INSERT INTO weather_data (station_id, date, element, value, quality_flag)
        VALUES ${placeholders.join(', ')}
    `;

    await client.query(stmt, params);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getWeatherData(
  stationId: string,
  metrics: string[],
  startYear: number,
  endYear: number
): Promise<DailyObservation[]> {
  const result = await pool.query(
    `SELECT station_id AS "stationId", date, element, value, quality_flag AS "qualityFlag"
         FROM weather_data
         WHERE station_id = $1
           AND element = ANY($2::text[])
           AND substring(date, 1, 4)::integer BETWEEN $3 AND $4
         ORDER BY date`,
    [stationId, metrics, startYear, endYear]
  );
  return result.rows as DailyObservation[];
}

export async function hasWeatherDataForStation(stationId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM weather_data WHERE station_id = $1',
    [stationId]
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

// ==========================================
// Inventory Operations
// ==========================================

export async function insertInventoryBatch(entries: InventoryEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Process in batches of 10000 to keep parameter count below 65535 (10000 * 4 = 40000)
    const BATCH_SIZE = 10000;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const params: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;
      
      for (const entry of batch) {
        placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(entry.stationId, entry.element, entry.firstYear, entry.lastYear);
      }
      
      const stmt = `
          INSERT INTO inventory (station_id, element, first_year, last_year)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (station_id, element) DO UPDATE SET
            first_year = EXCLUDED.first_year,
            last_year = EXCLUDED.last_year
      `;
      
      await client.query(stmt, params);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getInventoryForStation(stationId: string): Promise<InventoryEntry[]> {
  const result = await pool.query(
    `SELECT station_id AS "stationId", element, first_year AS "firstYear", last_year AS "lastYear"
         FROM inventory
         WHERE station_id = $1`,
    [stationId]
  );
  return result.rows as InventoryEntry[];
}

// ==========================================
// Sync Status Operations
// ==========================================

export async function updateSyncStatus(key: string, recordCount: number): Promise<void> {
  await pool.query(
    `INSERT INTO sync_status (key, last_sync, record_count)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           last_sync = EXCLUDED.last_sync,
           record_count = EXCLUDED.record_count`,
    [key, new Date().toISOString(), recordCount]
  );
}

export async function getSyncStatus(key: string): Promise<{ lastSync: string; recordCount: number } | undefined> {
  const result = await pool.query(
    `SELECT last_sync AS "lastSync", record_count AS "recordCount"
         FROM sync_status
         WHERE key = $1`,
    [key]
  );
  return result.rows[0] as { lastSync: string; recordCount: number } | undefined;
}

// ==========================================
// Cleanup
// ==========================================

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export { pool };
