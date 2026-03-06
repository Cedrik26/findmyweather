import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WeatherStationRepositoryService } from './weather-station-repository.service';

describe('WeatherStationRepositoryService', () => {
  let service: WeatherStationRepositoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WeatherStationRepositoryService],
    });

    service = TestBed.inject(WeatherStationRepositoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should build correct query params when selectAllStations=true (no maxStations)', () => {
    service
      .searchStations({
        latitude: 48.3,
        longitude: 10.9,
        radiusKm: 50,
        startYear: 2020,
        endYear: 2021,
        selectAllStations: true,
        limit: 5,
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/stations');
    expect(req.request.method).toBe('GET');

    const params = req.request.params;
    expect(params.get('lat')).toBe('48.3');
    expect(params.get('lon')).toBe('10.9');
    expect(params.get('radiusKm')).toBe('50');
    expect(params.get('startYear')).toBe('2020');
    expect(params.get('endYear')).toBe('2021');
    expect(params.has('maxStations')).toBe(false);

    req.flush([]);
    httpMock.verify();
  });

  it('should include maxStations when selectAllStations=false and limit is set', () => {
    service
      .searchStations({
        latitude: 10,
        longitude: 10,
        radiusKm: null,
        startYear: null,
        endYear: null,
        selectAllStations: false,
        limit: 12,
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/stations');
    const params = req.request.params;

    expect(params.get('lat')).toBe('10');
    expect(params.get('lon')).toBe('10');
    expect(params.has('radiusKm')).toBe(false);
    expect(params.get('maxStations')).toBe('12');
    expect(params.has('startYear')).toBe(false);
    expect(params.has('endYear')).toBe(false);

    req.flush([]);
    httpMock.verify();
  });

  it('getStationDetails should default metrics to TMIN,TMAX and merge station info', () => {
    service.getStationDetails('DE/ID 1').subscribe((details) => {
      expect(details.station).toBeTruthy();
      expect((details.station as any).name).toBe('Test');
      expect(details.labels).toEqual(['2000']);
      expect(details.datasets.length).toBe(1);
    });

    const infoReq = httpMock.expectOne('/api/stations/DE%2FID%201');
    expect(infoReq.request.method).toBe('GET');
    infoReq.flush({ id: 'DE/ID 1', name: 'Test', lat: 1, lon: 2, elevation: 3, firstYear: 1990, lastYear: 2020 });

    const dataReq = httpMock.expectOne((r) => r.url === '/api/stations/DE%2FID%201/data');
    expect(dataReq.request.method).toBe('GET');
    expect(dataReq.request.params.get('metrics')).toBe('TMIN,TMAX');
    expect(dataReq.request.params.has('startYear')).toBe(false);
    expect(dataReq.request.params.has('endYear')).toBe(false);

    dataReq.flush({ labels: ['2000'], datasets: [{ label: 'TMIN', data: [1] }] });

    httpMock.verify();
  });

  it('getStationDetails should pass years + custom metrics when provided', () => {
    service
      .getStationDetails('X', { startYear: 2001, endYear: 2005, metrics: ['TMIN_MEAN_SPRING'] })
      .subscribe();

    httpMock.expectOne('/api/stations/X').flush({ id: 'X', name: 'X', lat: 0, lon: 0, elevation: 0, firstYear: 0, lastYear: 0 });

    const dataReq = httpMock.expectOne((r) => r.url === '/api/stations/X/data');
    expect(dataReq.request.params.get('startYear')).toBe('2001');
    expect(dataReq.request.params.get('endYear')).toBe('2005');
    expect(dataReq.request.params.get('metrics')).toBe('TMIN_MEAN_SPRING');

    dataReq.flush({ labels: [], datasets: [] });

    httpMock.verify();
  });
});

