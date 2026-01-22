import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

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
  ],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.css',
})
export class SidenavComponent {
  latitude = '';
  longitude = '';
  radius = '';

  sliderValue = 1;

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
      sliderValue: this.sliderValue,
      stationCount: this.stationCount,
      start: this.start,
      end: this.end,
    });
  }
}
