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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Subscription } from 'rxjs';

import { WeatherStationRepositoryService } from '../weather-stations/weather-station-repository.service';
import { WeatherStationDetails } from '../weather-stations/weather-station.models';

Chart.register(...registerables);

type TableRow = {
  year: number;
  annual_tmin: number | null;
  annual_tmax: number | null;
  spring_tmin: number | null;
  spring_tmax: number | null;
  summer_tmin: number | null;
  summer_tmax: number | null;
  autumn_tmin: number | null;
  autumn_tmax: number | null;
  winter_tmin: number | null;
  winter_tmax: number | null;
};

@Component({
  selector: 'app-graphwindow',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './graphwindow.html',
  styleUrl: './graphwindow.css',
})
export class Graphwindow implements OnChanges, OnDestroy {
  @Input({ required: false }) stationId: string | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('chartCanvas')
  private chartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = false;
  error: string | null = null;

  details: WeatherStationDetails | null = null;
  tableRows: TableRow[] = [];

  private sub?: Subscription;
  private chart?: Chart;

  constructor(private readonly repo: WeatherStationRepositoryService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stationId']) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.destroyChart();
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

    this.sub = this.repo.getStationDetails(id).subscribe({
      next: (details) => {
        this.details = details;
        this.tableRows = buildTableRows(details);
        this.loading = false;

        // Chart erst erstellen, wenn Canvas existiert (Overlay kann timing-bedingt spät rendern)
        queueMicrotask(() => this.renderChart(details));
      },
      error: () => {
        this.loading = false;
        this.details = null;
        this.tableRows = [];
        this.error = `Keine Detaildaten gefunden für Station ${id}. (Mock fehlt?)`;
      },
    });
  }

  private renderChart(details: WeatherStationDetails): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: details.labels,
        datasets: details.datasets.map((d, idx) => ({
          label: d.label,
          data: d.data,
          borderColor: d.borderColor ?? defaultColor(idx),
          backgroundColor: d.backgroundColor ?? 'rgba(0,0,0,0.05)',
          tension: typeof d.tension === 'number' ? d.tension : 0.25,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Station ${this.stationId ?? ''}` },
        },
        scales: {
          y: { title: { display: true, text: 'Wert' } },
          x: { title: { display: true, text: 'Datum/Jahr' } },
        },
      },
    };

    this.chart = new Chart(canvas, cfg);
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
  // Backend liefert Chart.js Daten; die bisherige Tabelle (annual/seasonal) passt dazu nicht 1:1.
  // Wir zeigen daher eine einfache Tabelle "Label -> Werte je Dataset".
  const labels = details.labels ?? [];

  return labels.map((label, i) => {
    const get = (datasetLabel: string): number | null => {
      const ds = details.datasets.find((d) => d.label === datasetLabel);
      const v = ds?.data?.[i];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };

    return {
      year: Number(label),
      annual_tmin: get('TMIN') ?? get('Annual Tmin'),
      annual_tmax: get('TMAX') ?? get('Annual Tmax'),
      spring_tmin: null,
      spring_tmax: null,
      summer_tmin: null,
      summer_tmax: null,
      autumn_tmin: null,
      autumn_tmax: null,
      winter_tmin: null,
      winter_tmax: null,
    };
  });
}

function defaultColor(idx: number): string {
  const palette = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#00796b'];
  return palette[idx % palette.length]!;
}
