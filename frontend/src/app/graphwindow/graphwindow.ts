import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import { Subscription } from 'rxjs';

import { WeatherStationRepositoryService } from '../weather-stations/weather-station-repository.service';
import { WeatherStationDetails } from '../weather-stations/weather-station.models';

type TableRow = {
  label: string;
  values: Array<string | number | null>;
};

@Component({
  selector: 'app-graphwindow',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './graphwindow.html',
  styleUrl: './graphwindow.css',
})
export class Graphwindow implements OnChanges, OnDestroy, AfterViewInit {
  @Input({ required: false }) stationId: string | null = null;
  @Input({ required: false }) startYear: number | null = null;
  @Input({ required: false }) endYear: number | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('chartCanvas')
  private chartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = false;
  error: string | null = null;

  details: WeatherStationDetails | null = null;
  tableRows: TableRow[] = [];

  private sub?: Subscription;
  private chart?: Chart;

  private viewReady = false;
  private pendingRender = false;

  constructor(
    private readonly repo: WeatherStationRepositoryService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stationId'] || changes['startYear'] || changes['endYear']) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.destroyChart();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    // falls Daten schon da sind, aber Canvas vorher noch nicht existierte
    if (this.details && !this.error) {
      this.scheduleChartRender();
    }
  }

  private load(): void {
    this.sub?.unsubscribe();
    this.destroyChart();

    const id = this.stationId;
    if (!id) {
      this.details = null;
      this.tableRows = [];
      this.loading = false;
      this.error = 'Keine Station ausgewählt.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.details = null;
    this.tableRows = [];

    // TODO: optional start/end year + metrics aus UI übergeben
    const startYear = this.startYear ?? undefined;
    const endYear = this.endYear ?? undefined;

    this.sub = this.repo
      .getStationDetails(id, {
        startYear,
        endYear,
        metrics: ['TMIN', 'TMAX'],
      })
      .subscribe({
        next: (details) => {
          this.details = details;
          this.tableRows = buildTableRows(details);
          this.loading = false;

          // UI sofort aktualisieren (Overlay/zoneless edgecase)
          this.cdr.detectChanges();

          if ((details.labels?.length ?? 0) === 0 || (details.datasets?.length ?? 0) === 0) {
            this.error = details.message ?? 'Keine Daten für diese Station/Zeitraum verfügbar.';
            this.cdr.detectChanges();
            return;
          }

          this.scheduleChartRender();
        },
        error: (err) => {
          this.loading = false;
          this.details = null;
          this.tableRows = [];
          // eslint-disable-next-line no-console
          console.error('station details load failed', err);
          this.error = `Keine Detaildaten gefunden für Station ${id}.`;
          this.cdr.detectChanges();
        },
      });
  }

  private scheduleChartRender(): void {
    // wenn view noch nicht da -> nach AfterViewInit rendern
    if (!this.viewReady) {
      this.pendingRender = true;
      return;
    }

    if (!this.details) return;

    // Mehrfaches Rendern in kurzer Zeit zusammenfassen
    if (this.pendingRender) return;
    this.pendingRender = true;

    // Warten bis Angular DOM + Layout fertig sind
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.ngZone.run(() => {
            this.pendingRender = false;
            this.destroyChart();
            if (!this.details) return;
            this.renderChart(this.details);
          });
        });
      });
    });
  }

  private renderChart(details: WeatherStationDetails): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    const parent = canvas.parentElement as HTMLElement | null;
    const w = parent?.clientWidth ?? canvas.clientWidth;
    const h = parent?.clientHeight ?? canvas.clientHeight;

    // Wenn das Canvas noch 0x0 ist, nochmal später probieren
    if (w === 0 || h === 0) {
      this.scheduleChartRender();
      return;
    }

    // Chart.js kümmert sich (responsive) selbst um Canvas-Größen.
    // Explizites Setzen von canvas.width/height kann in Kombination mit CSS !important
    // zu unsichtbaren Linien führen (DevicePixelRatio/Retina-Scaling).

    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: details.labels,
        datasets: details.datasets.map((d, idx) => ({
          label: d.label,
          data: d.data,
          borderColor: d.borderColor ?? defaultColor(idx),
          backgroundColor: 'transparent',
          tension: typeof d.tension === 'number' ? d.tension : 0.25,
          fill: false,
          showLine: true,
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointHitRadius: 8,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // Chart.js default parsing ist aktiv; Typing erlaubt hier kein `true`.
        // parsing: true,
        normalized: true,
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: details.station?.name
              ? `${details.station.name} (${details.station.id})`
              : `Station ${this.stationId ?? ''}`,
          },
        },
        elements: {
          line: { borderWidth: 2 },
          point: { radius: 2 },
        },
        scales: {
          y: { title: { display: true, text: '°C' } },
          x: { title: { display: true, text: 'Jahr' } },
        },
      },
    };

    try {
      this.chart = new Chart(canvas, cfg);
      this.cdr.detectChanges();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[chart] render failed', e);
      this.error = 'Chart konnte nicht gerendert werden.';
      this.cdr.detectChanges();
    }
  }

  private destroyChart(): void {
    try {
      this.chart?.destroy();
    } finally {
      this.chart = undefined;
    }
  }

  onClose(): void {
    this.close.emit();
  }
}

function valAt(arr: number[], idx: number): number | null {
  const v = arr?.[idx];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function buildTableRows(details: WeatherStationDetails): TableRow[] {
  const labels = details.labels ?? [];
  const datasets = details.datasets ?? [];

  return labels.map((label, i) => ({
    label,
    values: datasets.map((ds) => formatValue(ds.data?.[i])),
  }));
}

function formatValue(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    // für Tabellen kompakt runden
    const rounded = Math.round(v * 10) / 10;
    return rounded;
  }
  return String(v);
}

function defaultColor(idx: number): string {
  const palette = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#00796b'];
  return palette[idx % palette.length]!;
}

function toFillColor(hex: string): string {
  // sehr simple: feste leichte Transparenz (funktioniert auch wenn schon rgba übergeben wird)
  if (hex.startsWith('rgba')) return hex;
  return 'rgba(0, 0, 0, 0.05)';
}
