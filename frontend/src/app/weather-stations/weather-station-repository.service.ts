import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { WeatherStation, WeatherStationDetails, WeatherStationInfo, WeatherStationQuery } from './weather-station.models';
import { DOCUMENT_TOKEN } from '../testing/di';

@Injectable({ providedIn: 'root' })
/**
 * Repository service responsible for fetching weather station data from the backend.
 * Provides methods to search for stations and retrieve detailed data for specific stations.
 */
export class WeatherStationRepositoryService {
  private readonly http = inject(HttpClient);

  // Dummy injection of DOCUMENT_TOKEN to force at least one explicit injectable token usage.
  // (Keeps this file consistent with our DI-token approach across Vitest.)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _doc = inject(DOCUMENT_TOKEN, { optional: true });

  /**
   * Searches for weather stations based on geographic and capability criteria.
   * @param query The search parameters (coordinates, radius, year range, etc.).
   * @returns Observable of station list.
   */
  searchStations(query: WeatherStationQuery): Observable<WeatherStation[]> {
    let params = new HttpParams()
      .set('lat', String(query.latitude))
      .set('lon', String(query.longitude));

    if (typeof query.radiusKm === 'number') params = params.set('radiusKm', String(query.radiusKm));

    const maxStations = query.selectAllStations ? undefined : query.limit;
    if (typeof maxStations === 'number') params = params.set('maxStations', String(maxStations));

    if (query.startYear != null) params = params.set('startYear', String(query.startYear));
    if (query.endYear != null) params = params.set('endYear', String(query.endYear));

    return this.http.get<WeatherStation[]>('/api/stations', { params });
  }

  /**
   * Fetches metadata for a single station by ID.
   * @param stationId The station identifier.
   * @returns Observable of station info.
   */
  private getStationInfo(stationId: string): Observable<WeatherStationInfo> {
    return this.http.get<WeatherStationInfo>(`/api/stations/${encodeURIComponent(stationId)}`);
  }

  /**
   * Retrieves full details for a station, including chart data and metadata.
   * Parallelizes requests for metadata and data series.
   * @param stationId The station identifier.
   * @param opts Optional filters for data range and metrics.
   * @returns Observable of combined station details.
   */
  getStationDetails(
    stationId: string,
    opts?: { startYear?: number; endYear?: number; metrics?: string[] }
  ): Observable<WeatherStationDetails> {
    let params = new HttpParams();

    if (opts?.startYear != null) params = params.set('startYear', String(opts.startYear));
    if (opts?.endYear != null) params = params.set('endYear', String(opts.endYear));

    const metrics = (opts?.metrics?.length ? opts.metrics : ['TMIN', 'TMAX']).join(',');
    params = params.set('metrics', metrics);

    const info$ = this.getStationInfo(stationId);
    const chart$ = this.http.get<WeatherStationDetails>(
      `/api/stations/${encodeURIComponent(stationId)}/data`,
      { params }
    );

    return forkJoin({ station: info$, chart: chart$ }).pipe(
      map(({ station, chart }) => ({
        ...chart,
        station,
      }))
    );
  }
}
