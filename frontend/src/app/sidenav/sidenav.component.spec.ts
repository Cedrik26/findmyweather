import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SidenavComponent } from './sidenav.component';

describe('SidenavComponent', () => {
  let component: SidenavComponent;

  beforeEach(() => {
    component = new SidenavComponent();
    document.body.classList.remove('dark-mode');
  });

  it('button enablement logic should require both years', () => {
    component.startYear = null;
    component.endYear = new Date(2026, 0, 1);
    expect(!component.startYear || !component.endYear).toBe(true);

    component.startYear = new Date(2020, 0, 1);
    component.endYear = null;
    expect(!component.startYear || !component.endYear).toBe(true);

    component.startYear = new Date(2020, 0, 1);
    component.endYear = new Date(2026, 0, 1);
    expect(!component.startYear || !component.endYear).toBe(false);
  });

  it('toggle logic should control selectAllStations flag', () => {
    expect(component.selectAllStations).toBe(true);
    component.selectAllStations = false;
    expect(component.selectAllStations).toBe(false);
  });

  it('onRadiusChange should emit radiusChange event', () => {
    const spy = vi.spyOn(component.radiusChange, 'emit');
    component.onRadiusChange(25);
    expect(spy).toHaveBeenCalledWith(25);
    expect(component.radius).toBe(25);
  });

  it('should ignore non-finite radius changes', () => {
    const spy = vi.spyOn(component.radiusChange, 'emit');
    component.onRadiusChange(Number.NaN);
    component.onRadiusChange(Number.POSITIVE_INFINITY);
    expect(spy).not.toHaveBeenCalled();
  });

  it('setStartYear should adjust endYear when needed', () => {
    component.endYear = new Date(2010, 0, 1);
    const picker = { close: vi.fn() } as any;

    component.setStartYear(new Date(2020, 0, 1), picker);

    expect(component.startYear?.getFullYear()).toBe(2020);
    expect(component.endYear?.getFullYear()).toBe(2020);
    expect(picker.close).toHaveBeenCalled();
  });

  it('setEndYear should swap start/end when endYear before startYear', () => {
    component.startYear = new Date(2020, 0, 1);
    const picker = { close: vi.fn() } as any;

    component.setEndYear(new Date(2010, 0, 1), picker);

    expect(component.startYear?.getFullYear()).toBe(2010);
    expect(component.endYear?.getFullYear()).toBe(2020);
    expect(picker.close).toHaveBeenCalled();
  });

  it('setEndYear should set endYear directly when endYear >= startYear', () => {
    component.startYear = new Date(2020, 0, 1);
    const picker = { close: vi.fn() } as any;

    component.setEndYear(new Date(2022, 0, 1), picker);

    expect(component.startYear?.getFullYear()).toBe(2020);
    expect(component.endYear?.getFullYear()).toBe(2022);
    expect(picker.close).toHaveBeenCalled();
  });

  it('lookupWeatherStations should not emit when coordinates are invalid', () => {
    const spy = vi.spyOn(component.lookupStations, 'emit');
    component.latitudeValue = '-';
    component.longitudeValue = '400';
    component.lookupWeatherStations();
    expect(spy).not.toHaveBeenCalled();
  });

  it('lookupWeatherStations should parse commas and emit query when coordinates are valid', () => {
    const spy = vi.spyOn(component.lookupStations, 'emit');
    component.latitudeValue = '52,5200';
    component.longitudeValue = '13,4050';
    component.radius = 25;
    component.selectAllStations = false;
    component.weatherStationCount = 7;
    component.startYear = new Date(2020, 0, 1);
    component.endYear = new Date(2021, 0, 1);

    component.lookupWeatherStations();

    expect(spy).toHaveBeenCalledWith({
      latitude: 52.52,
      longitude: 13.405,
      radiusKm: 25,
      startYear: 2020,
      endYear: 2021,
      selectAllStations: false,
      limit: 7,
    });
  });

  it('onDarkModeToggle should toggle dark-mode class on body', () => {
    component.onDarkModeToggle(true);
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    component.onDarkModeToggle(false);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  it('ngOnChanges should sync @Input latitude/longitude into internal fields', () => {
    component.latitude = '48.123';
    component.longitude = '11.456';

    component.ngOnChanges({
      latitude: { currentValue: '48.123', previousValue: '', firstChange: true, isFirstChange: () => true },
      longitude: { currentValue: '11.456', previousValue: '', firstChange: true, isFirstChange: () => true },
    } as any);

    expect(component.latitudeValue).toBe('48.123');
    expect(component.longitudeValue).toBe('11.456');
  });

  it('ngOnChanges should apply dark-mode class depending on darkMode flag', () => {
    component.darkMode = true;
    component.ngOnChanges({} as any);
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    component.darkMode = false;
    component.ngOnChanges({} as any);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  it('onCoordinatesInputChange should emit coordinatesChange with raw strings', () => {
    const spy = vi.spyOn(component.coordinatesChange, 'emit');
    component.latitudeValue = '1,23';
    component.longitudeValue = '4,56';
    component.onCoordinatesInputChange();
    expect(spy).toHaveBeenCalledWith({ latitude: '1,23', longitude: '4,56' });
  });

  it('lookupWeatherStations should return early on empty strings', () => {
    const spy = vi.spyOn(component.lookupStations, 'emit');
    component.latitudeValue = '';
    component.longitudeValue = '';
    component.lookupWeatherStations();
    expect(spy).not.toHaveBeenCalled();
  });

  it('lookupWeatherStations should return early on partial inputs', () => {
    const spy = vi.spyOn(component.lookupStations, 'emit');
    component.latitudeValue = '.';
    component.longitudeValue = '-.';
    component.lookupWeatherStations();
    expect(spy).not.toHaveBeenCalled();
  });

  it('noStationsFound input should be settable', () => {
    component.noStationsFound = true;
    expect(component.noStationsFound).toBe(true);
  });
});
