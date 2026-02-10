import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WeatherStationQuery, WeatherStation } from './weather-station.models';
import { WeatherStationRepositoryService } from './weather-station-repository.service';

@Injectable({ providedIn: 'root' })
/**
 * facade service for searching weather stations.
 * Delegates the search execution to the repository.
 * Keeps the component layer decoupled from the repository implementation details.
 */
export class WeatherStationSearchService {
  constructor(private readonly repo: WeatherStationRepositoryService) {}

  /**
   * Executes a weather station search.
   * @param query The search query.
   * @returns List of matching weather stations.
   */
  search(query: WeatherStationQuery): Observable<WeatherStation[]> {
    return this.repo.searchStations(query);
  }
}
