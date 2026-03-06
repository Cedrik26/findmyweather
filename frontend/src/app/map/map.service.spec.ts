import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NgZone } from '@angular/core';
import { MapService } from './map.service';

// Leaflet ist in Unit-Tests schwergewichtig. Wir mocken nur die minimalen Teile,
// die MapService in den getesteten Paths anfasst.

// Shared mocks (werden in Tests konfiguriert)
// Wichtig: vi.mock factories sind hoisted -> keine top-level Symbole im Mock referenzieren.

type LeafletMockState = {
  mapOnHandlers: Record<string, Function>;
  mapOnceHandlers: Record<string, Function>;
  createdTileLayer: any;
  createdLayerGroup: any;
  lastMarker?: any;
};

function getLeafletState(): LeafletMockState {
  return (globalThis as any)['__leafletMockState__'] as LeafletMockState;
}

vi.mock('leaflet', () => {
  const state: LeafletMockState = {
    mapOnHandlers: {},
    mapOnceHandlers: {},
    createdTileLayer: undefined,
    createdLayerGroup: undefined,
    lastMarker: undefined,
  };
  (globalThis as any)['__leafletMockState__'] = state;

  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    on: vi.fn((evt: string, cb: any) => {
      state.mapOnHandlers[evt] = cb;
      return mapMock;
    }),
    panTo: vi.fn(),
    invalidateSize: vi.fn(),
  };

  state.createdTileLayer = {
    once: vi.fn((evt: string, cb: any) => {
      state.mapOnceHandlers[evt] = cb;
      return state.createdTileLayer;
    }),
    addTo: vi.fn(),
  };

  state.createdLayerGroup = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
  };

  const markerMockFactory = () => {
    const onHandlers: Record<string, Function> = {};
    return {
      addTo: vi.fn().mockReturnThis(),
      setLatLng: vi.fn(),
      setIcon: vi.fn(),
      bindPopup: vi.fn(),
      on: vi.fn((evt: string, cb: any) => {
        onHandlers[evt] = cb;
        return this;
      }),
      // helper for tests
      __fire: (evt: string, payload: any) => onHandlers[evt]?.(payload),
    };
  };

  const circleMockFactory = () => {
    return {
      addTo: vi.fn().mockReturnThis(),
      setLatLng: vi.fn(),
      setRadius: vi.fn(),
    };
  };

  return {
    icon: vi.fn(() => ({})),
    map: vi.fn(() => mapMock),
    tileLayer: vi.fn(() => state.createdTileLayer),
    layerGroup: vi.fn(() => state.createdLayerGroup),
    marker: vi.fn(() => {
      const m = markerMockFactory();
      state.lastMarker = m;
      return m;
    }),
    circle: vi.fn(() => circleMockFactory()),
    DomEvent: {
      disableClickPropagation: vi.fn(),
      disableScrollPropagation: vi.fn(),
      off: vi.fn(),
      on: vi.fn(),
      stop: vi.fn(),
    },
  };
});

describe('MapService', () => {
  const zoneStub: Pick<NgZone, 'run'> = {
    run: (fn: any) => fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    const st = getLeafletState();
    st.mapOnHandlers = {};
    st.mapOnceHandlers = {};
  });

  it('onTilesReady should call handler immediately when already ready', () => {
    const svc = new MapService(zoneStub as NgZone);

    // hasEmittedReady ist privat – wir setzen es in Tests bewusst via any.
    (svc as any).hasEmittedReady = true;

    const handler = vi.fn();
    svc.onTilesReady(handler);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onTilesReady should queue handler and emitTilesReadyOnce should flush exactly once', () => {
    const svc = new MapService(zoneStub as NgZone);

    const h1 = vi.fn();
    const h2 = vi.fn();

    svc.onTilesReady(h1);
    svc.onTilesReady(h2);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();

    (svc as any).emitTilesReadyOnce();

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);

    // 2. emit darf nichts mehr machen
    (svc as any).emitTilesReadyOnce();
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('initMap should create map, tileLayer, stationLayer and emit tiles-ready on load', () => {
    const svc = new MapService(zoneStub as NgZone);
    const host = document.createElement('div') as any as HTMLDivElement;

    const tilesReady = vi.fn();
    svc.onTilesReady(tilesReady);

    const map = svc.initMap(host);
    expect(map).toBeTruthy();

    const st = getLeafletState();

    // tile layer was created and load handler registered
    expect(st.createdTileLayer.once).toHaveBeenCalledWith('load', expect.any(Function));

    // Simuliere das Leaflet "load" Event
    st.mapOnceHandlers['load']?.();
    expect(tilesReady).toHaveBeenCalledTimes(1);

    // 2. initMap liefert die gleiche Instanz
    const map2 = svc.initMap(host);
    expect(map2).toBe(map);
  });

  it('onClick should wrap leaflet click into NgZone.run and forward lat/lng', () => {
    const svc = new MapService(zoneStub as NgZone);
    const host = document.createElement('div') as any as HTMLDivElement;
    svc.initMap(host);

    const handler = vi.fn();
    svc.onClick(handler);

    const st = getLeafletState();
    // simulate leaflet click event
    st.mapOnHandlers['click']?.({ latlng: { lat: 12.34, lng: 56.78 } });

    expect(handler).toHaveBeenCalledWith({ lat: 12.34, lng: 56.78 });
  });

  it('setMarker should create marker + circle on first call and update on second call', () => {
    const svc = new MapService(zoneStub as NgZone);
    const host = document.createElement('div') as any as HTMLDivElement;
    svc.initMap(host);

    // first call -> marker + circle created
    svc.setMarker({ lat: 1, lng: 2 });

    // second call -> updates existing
    svc.setMarker({ lat: 3, lng: 4 });

    // radius update works
    svc.setRadiusMeters(999);
    expect(svc.getRadiusMeters()).toBe(999);
  });

  it('setStationMarkers should bind popup and attach popupopen handler that wires lookup button click', async () => {
    const svc = new MapService(zoneStub as NgZone);
    const host = document.createElement('div') as any as HTMLDivElement;
    svc.initMap(host);

    const lookupSpy = vi.fn();
    svc.onLookupGraphForStation(lookupSpy);

    svc.setStationMarkers([
      {
        id: 'ST1',
        name: 'Station <1>',
        lat: 10,
        lon: 20,
        distanceKm: 1.23,
        firstYear: 2000,
        lastYear: 2020,
      } as any,
    ]);

    const st = getLeafletState();

    // ensure layer cleared
    expect(st.createdLayerGroup.clearLayers).toHaveBeenCalled();

    const markerInstance = st.lastMarker;
    expect(markerInstance).toBeTruthy();
    expect(markerInstance.bindPopup).toHaveBeenCalled();

    // simulate popupopen with a button
    const btn = document.createElement('button');
    btn.className = 'ws-lookup-graph';
    const popupRoot = document.createElement('div');
    popupRoot.appendChild(btn);

    const popup = {
      getElement: () => popupRoot,
    };

    markerInstance.__fire('popupopen', { popup });

    // DomEvent handlers were wired
    const domEvent = (await import('leaflet')).DomEvent as any;
    expect(domEvent.disableClickPropagation).toHaveBeenCalledWith(btn);
    expect(domEvent.disableScrollPropagation).toHaveBeenCalledWith(btn);
    expect(domEvent.off).toHaveBeenCalledWith(btn);

    // capture click handler
    const onCalls = domEvent.on.mock.calls;
    const clickCall = onCalls.find((c: any[]) => c[0] === btn && c[1] === 'click');
    expect(clickCall).toBeTruthy();

    // invoke click handler
    const clickHandler = clickCall![2];
    clickHandler({});

    expect(domEvent.stop).toHaveBeenCalled();
    expect(lookupSpy).toHaveBeenCalledWith('ST1');
  });

  it('clearStationMarkers should clear the layer if present', () => {
    const svc = new MapService(zoneStub as NgZone);
    const host = document.createElement('div') as any as HTMLDivElement;
    svc.initMap(host);

    svc.setStationMarkers([]);
    svc.clearStationMarkers();

    const st = getLeafletState();
    expect(st.createdLayerGroup.clearLayers).toHaveBeenCalled();
  });

  it('guard methods should no-op when map is not initialized', () => {
    const svc = new MapService(zoneStub as NgZone);

    // map ist undefined -> folgende Methoden dürfen nicht crashen
    expect(() => svc.onClick(() => {})).not.toThrow();
    expect(() => svc.setMarker({ lat: 1, lng: 2 })).not.toThrow();
    expect(() => svc.panTo({ lat: 1, lng: 2 })).not.toThrow();
    expect(() => svc.setStationMarkers([])).not.toThrow();

    // get/set radius funktioniert ohne map
    svc.setRadiusMeters(1234);
    expect(svc.getRadiusMeters()).toBe(1234);
  });
});

