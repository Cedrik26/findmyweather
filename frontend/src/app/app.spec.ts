import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { of, throwError } from 'rxjs';
import { App } from './app';
import { MapService } from './map/map.service';
import { WeatherStationSearchService } from './weather-stations/weather-station-search.service';

describe('App', () => {
  let component: App;
  let mapServiceSpy: any;
  let searchServiceSpy: any;
  let cdrSpy: any;

  beforeEach(() => {
    mapServiceSpy = {
      initMap: vi.fn(),
      onClick: vi.fn(),
      onLookupGraphForStation: vi.fn(),
      onTilesReady: vi.fn(),
      setMarker: vi.fn(),
      panTo: vi.fn(),
      invalidateSize: vi.fn(),
      setRadiusMeters: vi.fn(),
      clearStationMarkers: vi.fn(),
      setStationMarkers: vi.fn(),
    };

    searchServiceSpy = {
      search: vi.fn(),
    };

    cdrSpy = {
      detectChanges: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MapService, useValue: mapServiceSpy },
        { provide: WeatherStationSearchService, useValue: searchServiceSpy },
        { provide: ChangeDetectorRef, useValue: cdrSpy },
        {
          provide: NgZone,
          useValue: {
            run: (fn: () => unknown) => fn(),
            runOutsideAngular: (fn: () => unknown) => fn(),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new App());
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('onCoordinatesChange should update app state and map marker', () => {
    component.onCoordinatesChange({ latitude: '52.5200', longitude: '13.4050' });

    expect(component.latitude).toBe('52.5200');
    expect(component.longitude).toBe('13.4050');
    expect(mapServiceSpy.setMarker).toHaveBeenCalledWith({ lat: 52.52, lng: 13.405 });
    expect(mapServiceSpy.panTo).toHaveBeenCalledWith({ lat: 52.52, lng: 13.405 });
  });

  it('onCoordinatesChange should ignore invalid coordinates', () => {
    component.onCoordinatesChange({ latitude: '-', longitude: '500' });

    expect(mapServiceSpy.setMarker).not.toHaveBeenCalled();
    expect(mapServiceSpy.panTo).not.toHaveBeenCalled();
  });

  it('onRadiusChange should convert km to meters', () => {
    component.onRadiusChange(25);
    expect(mapServiceSpy.setRadiusMeters).toHaveBeenCalledWith(25000);
  });

  it('onLookupStations should pass results to map and clear noStationsFound for non-empty result', () => {
    searchServiceSpy.search.mockReturnValue(of([{ id: 'ST1', name: 'Station 1' }]));

    component.onLookupStations({
      latitude: 48.3,
      longitude: 10.9,
      radiusKm: 50,
      startYear: 2020,
      endYear: 2021,
      selectAllStations: true,
      limit: null,
    } as any);

    expect(searchServiceSpy.search).toHaveBeenCalled();
    expect(mapServiceSpy.setStationMarkers).toHaveBeenCalledWith([{ id: 'ST1', name: 'Station 1' }]);
    expect(component.noStationsFound).toBe(false);
    expect(component.selectedStartYear).toBe(2020);
    expect(component.selectedEndYear).toBe(2021);
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('onLookupStations should set noStationsFound=true for empty result', () => {
    searchServiceSpy.search.mockReturnValue(of([]));

    component.onLookupStations({
      latitude: 48.3,
      longitude: 10.9,
      radiusKm: 50,
      startYear: 2020,
      endYear: 2021,
      selectAllStations: true,
      limit: null,
    } as any);

    expect(component.noStationsFound).toBe(true);
    expect(mapServiceSpy.setStationMarkers).toHaveBeenCalledWith([]);
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('onLookupStations should clear markers and set noStationsFound=true on error', () => {
    searchServiceSpy.search.mockReturnValue(throwError(() => new Error('boom')));

    component.onLookupStations({
      latitude: 48.3,
      longitude: 10.9,
      radiusKm: 50,
      startYear: 2020,
      endYear: 2021,
      selectAllStations: true,
      limit: null,
    } as any);

    expect(component.noStationsFound).toBe(true);
    expect(mapServiceSpy.clearStationMarkers).toHaveBeenCalled();
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('closeGraph should hide overlay and clear selectedStationId', async () => {
    component.showGraph = true;
    component.selectedStationId = 'ST99';

    component.closeGraph();
    await Promise.resolve();

    expect(component.showGraph).toBe(false);
    expect(component.selectedStationId).toBeNull();
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('openGraph should show the graph overlay', () => {
    component.openGraph();
    expect(component.showGraph).toBe(true);
  });

  it('ngOnDestroy should unsubscribe search subscription and disconnect resize observer', () => {
    const unsub = vi.fn();
    const disconnect = vi.fn();
    (component as any).stationSearchSub = { unsubscribe: unsub };
    (component as any).sidenavResizeObserver = { disconnect };

    component.ngOnDestroy();

    expect(unsub).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('private onMapClick should update coordinates, set marker and trigger detectChanges', () => {
    (component as any).onMapClick({ lat: 1.23456789, lng: 9.87654321 });

    expect(component.latitude).toBe('1.234568');
    expect(component.longitude).toBe('9.876543');
    expect(mapServiceSpy.setMarker).toHaveBeenCalledWith({ lat: 1.23456789, lng: 9.87654321 });
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('private onLookupGraphForStation should set selection and open graph asynchronously', async () => {
    (component as any).onLookupGraphForStation('ST99');
    await new Promise((r) => setTimeout(r, 0));

    expect(component.selectedStationId).toBe('ST99');
    expect(component.showGraph).toBe(true);
    expect(cdrSpy.detectChanges).toHaveBeenCalled();
  });

  it('ngAfterViewInit should wire map callbacks, tilesReady, resize observer and size invalidation', async () => {
    const mapDiv = document.createElement('div');
    const sidenavEl = document.createElement('div');
    vi.spyOn(sidenavEl, 'getBoundingClientRect').mockReturnValue({ width: 321 } as DOMRect);

    (component as any).mapEl = { nativeElement: mapDiv };
    (component as any).sidenavEl = { nativeElement: sidenavEl };

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    let clickHandler: ((pos: any) => void) | undefined;
    let graphHandler: ((id: string) => void) | undefined;
    mapServiceSpy.onClick.mockImplementation((cb: (pos: any) => void) => { clickHandler = cb; });
    mapServiceSpy.onLookupGraphForStation.mockImplementation((cb: (id: string) => void) => { graphHandler = cb; });
    mapServiceSpy.onTilesReady.mockImplementation((cb: () => void) => cb());

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1 as any;
    });

    const resizeObserve = vi.fn();
    const resizeDisconnect = vi.fn();
    class ResizeObserverMock {
      observe = resizeObserve;
      disconnect = resizeDisconnect;
      constructor(_cb: ResizeObserverCallback) {}
    }
    (globalThis as any).ResizeObserver = ResizeObserverMock as any;

    component.ngAfterViewInit();
    await Promise.resolve();

    expect(mapServiceSpy.initMap).toHaveBeenCalledWith(mapDiv);
    expect(mapServiceSpy.onClick).toHaveBeenCalled();
    expect(mapServiceSpy.onLookupGraphForStation).toHaveBeenCalled();
    expect(mapServiceSpy.invalidateSize).toHaveBeenCalled();
    expect(component.mapLoading).toBe(false);
    expect(setPropertySpy).toHaveBeenCalledWith('--sidenav-width', '321px');
    expect(resizeObserve).toHaveBeenCalledWith(sidenavEl);
    expect(rafSpy).toHaveBeenCalled();

    clickHandler?.({ lat: 5, lng: 6 });
    expect(component.latitude).toBe('5.000000');
    expect(component.longitude).toBe('6.000000');

    graphHandler?.('ST-TEST');
    await new Promise((r) => setTimeout(r, 0));
    expect(component.selectedStationId).toBe('ST-TEST');
    expect(component.showGraph).toBe(true);
  });
});
