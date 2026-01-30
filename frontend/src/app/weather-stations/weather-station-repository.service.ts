import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { WeatherStation, WeatherStationDetails, WeatherStationInfo, WeatherStationQuery } from './weather-station.models';

@Injectable({ providedIn: 'root' })
export class WeatherStationRepositoryService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Ruft nahe Stationen vom Backend ab.
   * Backend: GET /api/stations?lat=..&lon=..&radiusKm=..&maxStations=..&startYear=..&endYear=..
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

  private getStationInfo(stationId: string): Observable<WeatherStationInfo> {
    return this.http.get<WeatherStationInfo>(`/api/stations/${encodeURIComponent(stationId)}`);
  }

  /**
   * Lädt Chart/Detaildaten + Station-Metadaten.
   * Backend:
   *  - GET /api/stations/:id
   *  - GET /api/stations/:id/data?...
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
