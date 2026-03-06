import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherStationSearchService } from './weather-station-search.service';
import { WeatherStationRepositoryService } from './weather-station-repository.service';
import { of } from 'rxjs';

/**
 * Zustzliche Unit-Tests fr die Search-Facade.
 *
 * Ziel: Coverage fr `weather-station-search.service.ts` von ~0% Funktionen
 * nach oben bringen.
 */
describe('WeatherStationSearchService', () => {
  let repoSpy: { searchStations: any };
  let svc: WeatherStationSearchService;

  beforeEach(() => {
    repoSpy = { searchStations: vi.fn() };
    svc = new WeatherStationSearchService(repoSpy as unknown as WeatherStationRepositoryService);
  });

  it('should delegate search() to repository.searchStations with the same query', async () => {
    const query: any = {
      latitude: 10,
      longitude: 20,
      radiusKm: 5,
      startYear: 2000,
      endYear: 2001,
      selectAllStations: true,
      limit: 5,
    };

    const expected = [{ id: 'X', name: 'Station X' }];
    repoSpy.searchStations.mockReturnValue(of(expected));

    const result = await new Promise<any[]>((resolve) => {
      svc.search(query).subscribe((v) => resolve(v));
    });

    expect(repoSpy.searchStations).toHaveBeenCalledTimes(1);
    expect(repoSpy.searchStations).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });
});

