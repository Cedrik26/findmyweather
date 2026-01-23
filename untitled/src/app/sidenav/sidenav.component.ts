import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule, MatDateRangePicker } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MatNativeDateModule,
  NativeDateAdapter,
} from '@angular/material/core';

class YearOnlyDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: unknown): string {
    // Für unsere Inputs nur das Jahr anzeigen.
    if (!date) return '';
    return String(date.getFullYear());
  }

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
export class SidenavComponent {
  latitude = '';
  longitude = '';

  /** Radius in km (oder beliebige Einheit) – Default soll 5 sein */
  radius = 5;

  /** Anzahl Wetterstationen (Slider) */
  weatherStationCount = 5;

  /** Toggle: alle Wetterstationen auswählen */
  selectAllStations = true;

  stationCount: string | null = null;
  readonly stationOptions = ['Option 1', 'Option 2', 'Option 3'];

  /**
   * Date range: wir speichern bewusst Dates, aber nutzen nur das Jahr.
   * Wir setzen beim Year-Select jeweils den 1. Januar des gewählten Jahres.
   */
  startYear: Date | null = new Date(new Date().getFullYear(), 0, 1);
  endYear: Date | null = new Date(new Date().getFullYear(), 0, 1);

  /** Merkt sich, ob der nächste yearSelected-Klick Start oder End setzt */
  private activeYearField: 'start' | 'end' = 'start';

  setActiveYearField(field: 'start' | 'end'): void {
    this.activeYearField = field;
  }

  onYearSelected(normalizedYear: Date, picker: MatDateRangePicker<Date>): void {
    const year = normalizedYear.getFullYear();
    const next = new Date(year, 0, 1);

    if (this.activeYearField === 'start') {
      this.startYear = next;
      if (this.endYear && this.endYear.getFullYear() < year) {
        this.endYear = new Date(year, 0, 1);
      }
    } else {
      if (this.startYear && year < this.startYear.getFullYear()) {
        this.endYear = this.startYear;
        this.startYear = next;
      } else {
        this.endYear = next;
      }
      picker.close();
    }
  }

  lookupWeatherStations(): void {
    // eslint-disable-next-line no-console
    console.log('lookup weather stations', {
      latitude: this.latitude,
      longitude: this.longitude,
      radius: this.radius,
      weatherStationCount: this.weatherStationCount,
      selectAllStations: this.selectAllStations,
      stationCount: this.stationCount,
      startYear: this.startYear?.getFullYear() ?? null,
      endYear: this.endYear?.getFullYear() ?? null,
    });
  }
}
