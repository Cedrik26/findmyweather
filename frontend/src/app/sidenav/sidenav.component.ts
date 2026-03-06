import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';
import { WeatherStationQuery } from '../weather-stations/weather-station.models';

/**
 * Custom DateAdapter that handles only years.
 * Override format and parse to support year-only input fields.
 */
class YearOnlyDateAdapter extends NativeDateAdapter {
  /**
   * Formats a date to show only the full year.
   * @param date The date to format.
   * @param displayFormat The format to use (ignored here).
   * @returns The year as a string.
   */
  override format(date: Date, displayFormat: unknown): string {
    // Für unsere Inputs nur das Jahr anzeigen.
    if (!date) return '';
    return String(date.getFullYear());
  }

  /**
   * Parses a user input string into a Date object (January 1st of that year).
   * @param value The input value to parse.
   * @returns A Date object or null if invalid.
   */
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const year = Number(trimmed);
    if (!Number.isFinite(year) || year < 1 || year > 9999) return null;

    return new Date(year, 0, 1);
  }
}

const YEAR_ONLY_DATE_FORMATS = {
  parse: {
    dateInput: 'YYYY',
  },
  display: {
    dateInput: 'YYYY',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'YYYY',
    monthYearA11yLabel: 'YYYY',
  },
};

@Component({
  selector: 'app-sidenav',
  standalone: true,
  providers: [
    { provide: DateAdapter, useClass: YearOnlyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: YEAR_ONLY_DATE_FORMATS },
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.css',
})
/**
 * Main side navigation component for weather station search control.
 * Handles inputs for coordinates, radius, station count, and date range selection.
 */
export class SidenavComponent implements OnChanges {
  /** Event emitted when coordinates input changes. */
  @Output() coordinatesChange = new EventEmitter<{ latitude: string; longitude: string }>();

  /** Event emitted when radius slider changes. */
  @Output() radiusChange = new EventEmitter<number>();

  /** Event emitted to trigger a station lookup with the collected query parameters. */
  @Output() lookupStations = new EventEmitter<WeatherStationQuery>();

  /** Latitude input from parent (for two-way binding or initial set). */
  @Input() latitude = '';

  /** Longitude input from parent (for two-way binding or initial set). */
  @Input() longitude = '';

  /** True, wenn die letzte Suche keine Wetterstationen geliefert hat. */
  @Input() noStationsFound = false;

  /** Internal value for latitude input field. */
  latitudeValue = '';

  /** Internal value for longitude input field. */
  longitudeValue = '';

  /** Search radius in kilometers. Defaults to 5 km. */
  radius = 5;

  /** Number of weather stations to limit the search to. */
  weatherStationCount = 5;

  /** Toggle state for selecting all available weather stations. */
  selectAllStations = true;

  /** Darkmode State (UI Switch) */
  darkMode = false;

  stationCount: string | null = null;
  readonly stationOptions = ['Option 1', 'Option 2', 'Option 3'];

  /** Maximal wählbares Jahr */
  readonly maxYear = 2025;
  readonly maxDate = new Date(this.maxYear, 11, 31);

  /** Start-/Endjahr: wir speichern Dates, zeigen aber nur YYYY */
  startYear: Date | null = null;
  endYear: Date | null = null;

  /**
   * Lifecycle hook called when input properties change.
   * Updates internal values if parent inputs change.
   * @param changes Object containing changed properties.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['latitude']) {
      this.latitudeValue = this.latitude ?? '';
    }
    if (changes['longitude']) {
      this.longitudeValue = this.longitude ?? '';
    }

    // Initial state anwenden (falls Komponente neu erstellt wird)
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', this.darkMode);
    }
  }

  /**
   * Sets the start year from the date picker.
   * Adjusts the end year if it is before the new start year.
   * @param normalizedYear The date selected in the picker.
   * @param picker The datepicker instance to close.
   */
  setStartYear(normalizedYear: Date, picker: MatDatepicker<Date>): void {
    const year = normalizedYear.getFullYear();
    this.startYear = new Date(year, 0, 1);

    // Endjahr ggf. anpassen
    if (this.endYear && this.endYear.getFullYear() < year) {
      this.endYear = new Date(year, 0, 1);
    }

    picker.close();
  }

  /**
   * Sets the end year from the date picker.
   * Swaps start and end year if end year is before start year.
   * @param normalizedYear The date selected in the picker.
   * @param picker The datepicker instance to close.
   */
  setEndYear(normalizedYear: Date, picker: MatDatepicker<Date>): void {
    const year = normalizedYear.getFullYear();
    const end = new Date(year, 0, 1);

    if (this.startYear && year < this.startYear.getFullYear()) {
      // komfortabel tauschen
      this.endYear = this.startYear;
      this.startYear = end;
    } else {
      this.endYear = end;
    }

    picker.close();
  }

  /**
   * Emits the current coordinates when inputs change.
   */
  onCoordinatesInputChange(): void {
    this.coordinatesChange.emit({
      latitude: this.latitudeValue,
      longitude: this.longitudeValue,
    });
  }

  /**
   * Handles changes to the radius slider.
   * updates the radius and emits the change event.
   * @param value The new radius value.
   */
  onRadiusChange(value: number): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.radius = n;
    this.radiusChange.emit(n);
  }

  /**
   * Toggles dark mode by adding/removing a class on the document body.
   */
  onDarkModeToggle(enabled: boolean): void {
    this.darkMode = !!enabled;

    // globaler Toggle, damit auch Graphwindow/Tabellenhintergründe betroffen sind
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', this.darkMode);
    }
  }

  /**
   * Triggers the weather station lookup.
   * Collects all form data, validates coordinates, and emits the query object.
   */
  lookupWeatherStations(): void {
    const lat = parseCoordOrNull(this.latitudeValue);
    const lng = parseCoordOrNull(this.longitudeValue);
    if (lat == null || lng == null) return;

    this.lookupStations.emit({
      latitude: lat,
      longitude: lng,
      radiusKm: Number(this.radius),
      startYear: this.startYear?.getFullYear() ?? null,
      endYear: this.endYear?.getFullYear() ?? null,
      selectAllStations: this.selectAllStations,
      limit: Number(this.weatherStationCount),
    });
  }
}

/**
 * Helper function to parse coordinate strings.
 * Handles decimal points, commas, and validates numbers.
 * @param raw The raw string input.
 * @returns The parsed number or null if invalid.
 */
function parseCoordOrNull(raw: string): number | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(',', '.');
  if (normalized === '-' || normalized === '.' || normalized === '-.') return null;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
