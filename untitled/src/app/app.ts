import { AfterViewInit, Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SidenavComponent } from './sidenav/sidenav.component';
import { Graphwindow } from './graphwindow/graphwindow';
import { LatLng, MapService } from './map/map.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, MatSidenavModule, SidenavComponent, Graphwindow],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  @ViewChild('map', { static: true })
  private mapEl!: ElementRef<HTMLDivElement>;

  @ViewChild('appSidenav', { read: ElementRef })
  private sidenavEl?: ElementRef<HTMLElement>;

  private sidenavResizeObserver?: ResizeObserver;

  latitude = '';
  longitude = '';

  showGraph = false;

  constructor(
    private readonly mapService: MapService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  openGraph(): void {
    this.showGraph = true;
  }

  closeGraph(): void {
    this.showGraph = false;
  }

  private updateSidenavWidthCssVar(): void {
    const el = this.sidenavEl?.nativeElement;
    if (!el) return;

    const width = Math.round(el.getBoundingClientRect().width);
    document.documentElement.style.setProperty('--sidenav-width', `${width}px`);
  }

  private onMapClick(pos: LatLng): void {
    this.latitude = pos.lat.toFixed(6);
    this.longitude = pos.lng.toFixed(6);
    this.mapService.setMarker(pos);

    // sofort rendern (hilft bei zoneless/edge cases)
    this.cdr.detectChanges();
  }

  onCoordinatesChange(ev: { latitude: string; longitude: string }): void {
    const lat = this.parseCoord(ev.latitude);
    const lng = this.parseCoord(ev.longitude);

    // immer die aktuell getippten Strings anzeigen
    this.latitude = ev.latitude;
    this.longitude = ev.longitude;

    if (lat === null || lng === null) return;
    if (lat < -90 || lat > 90) return;
    if (lng < -180 || lng > 180) return;

    const pos = { lat, lng };
    this.mapService.setMarker(pos);
    this.mapService.panTo(pos);
  }

  private parseCoord(raw: string): number | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;

    // Akzeptiere Dezimalkomma
    const normalized = trimmed.replace(',', '.');

    // Verhindere Sprünge bei unfertigen Eingaben wie '-' oder '12.'
    if (normalized === '-' || normalized === '.' || normalized === '-.') return null;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  onRadiusChange(radiusKm: number): void {
    const km = Number(radiusKm);
    if (!Number.isFinite(km) || km <= 0) return;
    this.mapService.setRadiusMeters(km * 1000);
  }

  ngAfterViewInit(): void {
    this.mapService.initMap(this.mapEl.nativeElement);
    this.mapService.onClick((pos) => this.onMapClick(pos));

    // Sidenav-Breite initial + bei Änderungen aktualisieren
    this.updateSidenavWidthCssVar();
    if (this.sidenavEl?.nativeElement) {
      this.sidenavResizeObserver = new ResizeObserver(() => this.updateSidenavWidthCssVar());
      this.sidenavResizeObserver.observe(this.sidenavEl.nativeElement);
    }

    queueMicrotask(() => {
      this.mapService.invalidateSize();
      this.updateSidenavWidthCssVar();
    });
  }
}
