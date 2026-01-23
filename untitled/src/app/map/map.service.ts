import { Injectable, NgZone } from '@angular/core';
import * as L from 'leaflet';

export interface LatLng {
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root',
})
export class MapService {
  private map?: L.Map;
  private marker?: L.Marker;

  private readonly markerIcon = L.icon({
    iconUrl: '/marker.png',
    // optional: wenn du zusätzlich marker@2x.png ablegst
    // iconRetinaUrl: '/marker@2x.png',
    iconSize: [34, 34],
    iconAnchor: [17, 34], // Spitze unten mittig
    popupAnchor: [0, -34],
    shadowUrl: undefined,
  });

  constructor(private readonly ngZone: NgZone) {}

  initMap(host: HTMLDivElement): L.Map {
    if (this.map) return this.map;

    this.map = L.map(host, {
      zoomControl: true,
      attributionControl: true,
    }).setView([51.1657, 10.4515], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    return this.map;
  }

  onClick(handler: (pos: LatLng) => void): void {
    if (!this.map) return;

    this.map.off('click');
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      // Wichtig: Leaflet läuft außerhalb Angular -> in Zone zurückholen
      this.ngZone.run(() => handler(pos));
    });
  }

  setMarker(pos: LatLng): void {
    if (!this.map) return;

    if (!this.marker) {
      this.marker = L.marker([pos.lat, pos.lng], { icon: this.markerIcon });
      this.marker.addTo(this.map);
    } else {
      this.marker.setLatLng([pos.lat, pos.lng]);
      this.marker.setIcon(this.markerIcon);
    }
  }

  panTo(pos: LatLng): void {
    if (!this.map) return;
    this.map.panTo([pos.lat, pos.lng]);
  }

  invalidateSize(): void {
    this.map?.invalidateSize();
  }
}
