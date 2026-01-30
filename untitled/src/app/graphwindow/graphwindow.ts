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

    const labels = details.years.map(String);

    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Annual Tmin',
            data: details.data.annual.tmin,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.15)',
            tension: 0.25,
          },
          {
            label: 'Annual Tmax',
            data: details.data.annual.tmax,
            borderColor: '#d32f2f',
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `Station ${details.id} (Annual)` },
        },
        scales: {
          y: {
            title: { display: true, text: '°C' },
          },
          x: {
            title: { display: true, text: 'Year' },
          },
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
  const y = details.years ?? [];

  return y.map((year, i) => ({
    year,
    annual_tmin: valAt(details.data.annual.tmin, i),
    annual_tmax: valAt(details.data.annual.tmax, i),

    spring_tmin: valAt(details.data.seasonal.spring.tmin, i),
    spring_tmax: valAt(details.data.seasonal.spring.tmax, i),

    summer_tmin: valAt(details.data.seasonal.summer.tmin, i),
    summer_tmax: valAt(details.data.seasonal.summer.tmax, i),

    autumn_tmin: valAt(details.data.seasonal.autumn.tmin, i),
    autumn_tmax: valAt(details.data.seasonal.autumn.tmax, i),

    winter_tmin: valAt(details.data.seasonal.winter.tmin, i),
    winter_tmax: valAt(details.data.seasonal.winter.tmax, i),
  }));
}
