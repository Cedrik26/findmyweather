import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import * as L from 'leaflet';
import { SidenavComponent } from './sidenav/sidenav.component';

@Component({
  selector: 'app-root',
  imports: [MatSidenavModule, SidenavComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  @ViewChild('map', { static: true })
  private mapEl!: ElementRef<HTMLDivElement>;

  private map?: L.Map;

  ngAfterViewInit(): void {
    // Guard: prevent double-init in dev/hmr scenarios
    if (this.map) return;

    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    }).setView([51.1657, 10.4515], 6); // Germany as a sensible default

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Ensure correct sizing once everything is laid out
    queueMicrotask(() => this.map?.invalidateSize());
  }
}
