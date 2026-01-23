import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
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

  /** Freitext-Eingabe (falls du sie behalten willst) */
  stations = '';

  stationCount: string | null = null;
  readonly stationOptions = ['Option 1', 'Option 2', 'Option 3'];

  start = '';
  end = '';

  lookupWeatherStations(): void {
    // Placeholder: hier später API-Call/Navigation/etc.
    // eslint-disable-next-line no-console
    console.log('lookup weather stations', {
      latitude: this.latitude,
      longitude: this.longitude,
      radius: this.radius,
      weatherStationCount: this.weatherStationCount,
      selectAllStations: this.selectAllStations,
      stationCount: this.stationCount,
      start: this.start,
      end: this.end,
    });
  }
}
