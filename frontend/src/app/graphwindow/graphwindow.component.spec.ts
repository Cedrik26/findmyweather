import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Subject, throwError } from 'rxjs';
import Chart from 'chart.js/auto';
import { Graphwindow } from './graphwindow.component';
import { WeatherStationRepositoryService } from '../weather-stations/weather-station-repository.service';

describe('Graphwindow', () => {
  let component: Graphwindow;
  let repoSpy: any;
  let cdrSpy: any;

  beforeEach(() => {
    repoSpy = { getStationDetails: vi.fn() };
    cdrSpy = { detectChanges: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WeatherStationRepositoryService, useValue: repoSpy },
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

    component = TestBed.runInInjectionContext(() => new Graphwindow());
    document.body.classList.remove('dark-mode');
  });

  it('loading state should be true while details request is pending', () => {
    const subject = new Subject<any>();
    repoSpy.getStationDetails.mockReturnValue(subject.asObservable());

    component.stationId = 'TEST_ID';
    component.ngOnChanges({ stationId: {} as any });

    expect(component.loading).toBe(true);
    subject.complete();
  });

  it('error state should be set when repository errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    repoSpy.getStationDetails.mockReturnValue(throwError(() => new Error('Backend Fail')));

    component.stationId = 'TEST_ID';
    component.ngOnChanges({ stationId: {} as any });

    expect(component.loading).toBe(false);
    expect(component.error).toContain('Keine Detaildaten gefunden');
    consoleSpy.mockRestore();
  });

  it('should expose visibleDatasets based on datasetToggles', () => {
    component.details = {
      station: null,
      labels: ['2000'],
      datasets: [
        { label: 'TMIN Jahresdurchschnitt', data: [1] },
        { label: 'TMAX Sommer', data: [2] },
      ],
    } as any;
    component.datasetToggles = [
      { datasetIndex: 0, label: 'TMIN Jahresdurchschnitt', displayLabel: 'Jahresdurchschnitt', metric: 'TMIN', visible: true, color: '#0000FF' },
      { datasetIndex: 1, label: 'TMAX Sommer', displayLabel: 'Sommer', metric: 'TMAX', visible: false, color: '#d1d166' },
    ] as any;

    expect(component.visibleDatasets).toHaveLength(1);
    expect(component.visibleDatasets[0].label).toBe('TMIN Jahresdurchschnitt');
  });

  it('onToggleDataset should update visibility and rebuild tableRows', () => {
    component.details = {
      station: null,
      labels: ['2000', '2001'],
      datasets: [
        { label: 'A Jahresdurchschnitt', data: [1, 2] },
        { label: 'B Sommer', data: [3, 4] },
      ],
    } as any;
    component.datasetToggles = [
      { datasetIndex: 0, label: 'A Jahresdurchschnitt', displayLabel: 'A', metric: 'TMIN', visible: true, color: '#0000FF' },
      { datasetIndex: 1, label: 'B Sommer', displayLabel: 'B', metric: 'TMAX', visible: false, color: '#FF0000' },
    ] as any;
    component.tableRows = [{ label: '2000', values: [1] }] as any;

    const chartSpy = {
      setDatasetVisibility: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    (component as any).chart = chartSpy;

    const toggle = component.datasetToggles[1] as any;
    component.onToggleDataset(toggle, true);

    expect(toggle.visible).toBe(true);
    expect(component.tableRows[0].values.length).toBe(2);
    expect(chartSpy.setDatasetVisibility).toHaveBeenCalledWith(1, true);
    expect(chartSpy.update).toHaveBeenCalled();
  });

  it('onClose should emit close event', () => {
    const spy = vi.spyOn(component.close, 'emit');
    component.onClose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('scheduleChartRender should set pendingRender when view is not ready', () => {
    (component as any).viewReady = false;
    component.details = { station: null, labels: ['2000'], datasets: [{ label: 'X', data: [1] }] } as any;

    (component as any).scheduleChartRender();

    expect((component as any).pendingRender).toBe(true);
  });

  it('applyChartTheme should apply dark theme colors to chart options and defaults', () => {
    document.body.classList.add('dark-mode');
    const chartSpy: any = {
      options: {
        scales: { x: { ticks: {}, grid: {}, title: {} }, y: { ticks: {}, grid: {}, title: {} } },
        plugins: { title: {}, tooltip: {} },
      },
      update: vi.fn(),
      destroy: vi.fn(),
    };
    (component as any).chart = chartSpy;

    (component as any).applyChartTheme();

    expect(Chart.defaults.color).toContain('255,255,255');
    expect(chartSpy.update).toHaveBeenCalled();
  });

  it('applyChartTheme should apply light theme colors when dark-mode is not set', () => {
    const chartSpy: any = {
      options: {
        scales: { x: { ticks: {}, grid: {}, title: {} }, y: { ticks: {}, grid: {}, title: {} } },
        plugins: { title: {}, tooltip: {} },
      },
      update: vi.fn(),
      destroy: vi.fn(),
    };
    (component as any).chart = chartSpy;

    (component as any).applyChartTheme();

    expect(Chart.defaults.color).toContain('0,0,0');
    expect(chartSpy.update).toHaveBeenCalled();
  });
});

describe('Graphwindow helpers (via test hooks)', () => {
  it('should detect metrics and strip metric prefixes', () => {
    const hooks = (globalThis as any).__graphwindowTestHooks__;
    expect(hooks).toBeTruthy();

    expect(hooks.detectMetricFromLabel('TMIN Sommer')).toBe('TMIN');
    expect(hooks.detectMetricFromLabel('tmax winter')).toBe('TMAX');
    expect(hooks.detectMetricFromLabel('something else')).toBe('OTHER');

    expect(hooks.stripMetricPrefix('TMIN Jahresdurchschnitt', 'TMIN')).toBe('Jahresdurchschnitt');
    expect(hooks.stripMetricPrefix('TMAX Sommer', 'TMAX')).toBe('Sommer');
    expect(hooks.stripMetricPrefix('  ', 'OTHER')).toBe('');
  });

  it('should compute default visibility and colors for seasons + fallback', () => {
    const hooks = (globalThis as any).__graphwindowTestHooks__;

    expect(hooks.isDefaultVisible('TMIN Jahresdurchschnitt')).toBe(true);
    expect(hooks.isDefaultVisible('TMIN Sommer')).toBe(false);
    expect(hooks.getColor('TMAX Jahresdurchschnitt', 0)).toBe('#FF0000');
    expect(hooks.getColor('TMIN Jahresdurchschnitt', 0)).toBe('#0000FF');
    expect(hooks.getColor('TMAX Winter', 0)).toBe('#9de3ec');
    expect(hooks.getColor('TMIN Winter', 0)).toBe('#4583b8');
    expect(hooks.getColor('TMAX Frühling', 0)).toBe('#98FB98');
    expect(hooks.getColor('TMIN Fruehling', 0)).toBe('#228B22');
    expect(hooks.getColor('TMAX Sommer', 0)).toBe('#d1d166');
    expect(hooks.getColor('TMIN Sommer', 0)).toBe('#ffd700');
    expect(hooks.getColor('TMAX Herbst', 0)).toBe('#ff82ab');
    expect(hooks.getColor('TMIN Herbst', 0)).toBe('#ff1493');
    expect(hooks.getColor(undefined, 1)).toBeTruthy();
  });

  it('buildDatasetToggles should create toggles with displayLabel + metric + default visibility', () => {
    const hooks = (globalThis as any).__graphwindowTestHooks__;

    const details: any = {
      station: null,
      labels: ['2000'],
      datasets: [
        { label: 'TMIN Jahresdurchschnitt', data: [1] },
        { label: 'TMAX Sommer', data: [2] },
      ],
    };

    const toggles = hooks.buildDatasetToggles(details);
    expect(toggles).toHaveLength(2);
    expect(toggles[0].metric).toBe('TMIN');
    expect(toggles[0].displayLabel).toBe('Jahresdurchschnitt');
    expect(toggles[0].visible).toBe(true);
    expect(toggles[0].color).toBe('#0000FF');

    expect(toggles[1].metric).toBe('TMAX');
    expect(toggles[1].displayLabel).toBe('Sommer');
    expect(toggles[1].visible).toBe(false);
    expect(toggles[1].color).toBe('#d1d166');
  });
});
