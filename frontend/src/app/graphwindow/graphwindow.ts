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
import { MatCheckboxModule } from '@angular/material/checkbox';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import { Subscription } from 'rxjs';

import { WeatherStationRepositoryService } from '../weather-stations/weather-station-repository.service';
import { WeatherStationDetails } from '../weather-stations/weather-station.models';

type TableRow = {
  label: string;
  values: Array<string | number | null>;
};

type MetricKey = 'TMIN' | 'TMAX' | 'OTHER';

type DatasetToggle = {
  /** Index im Chart.js datasets-Array */
  datasetIndex: number;
  /** Label wie in Chart.js */
  label: string;
  /** Label für UI (bereinigt, ohne TMIN/TMAX Prefix) */
  displayLabel: string;
  /** Links/Rechts Gruppierung */
  metric: MetricKey;
  /** Aktueller Sichtbarkeitszustand */
  visible: boolean;
  /** Farbe (falls verfügbar) für kleine Farbbox */
  color?: string;
};

@Component({
  selector: 'app-graphwindow',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatCheckboxModule],
  templateUrl: './graphwindow.html',
  styleUrl: './graphwindow.css',
})
/**
 * Component responsible for displaying detailed weather station data.
 * Renders a chart (using Chart.js) and a data table.
 * Handles data loading, visibility toggling of datasets, and error reporting.
 */
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

  /** UI-Toggles für Datasets (z.B. TMIN/TMAX + Seasons) */
  datasetToggles: DatasetToggle[] = [];

  /**
   * Returns toggles specifically for TMIN metrics.
   */
  get tminToggles(): DatasetToggle[] {
    return this.datasetToggles.filter((t) => t.metric === 'TMIN');
  }

  /**
   * Returns toggles specifically for TMAX metrics.
   */
  get tmaxToggles(): DatasetToggle[] {
    return this.datasetToggles.filter((t) => t.metric === 'TMAX');
  }

  private sub?: Subscription;
  private chart?: Chart;

  private viewReady = false;
  private pendingRender = false;

  constructor(
    private readonly repo: WeatherStationRepositoryService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  /**
   * Reloads data whenever inputs change.
   * @param changes Change object.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stationId'] || changes['startYear'] || changes['endYear']) {
      this.load();
    }
  }

  /**
   * Cleanup subscriptions and chart instance on destruction.
   */
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

  /**
   * Loads station details from the repository.
   * Updates loading state and handles errors.
   */
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
    this.datasetToggles = [];

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
          this.datasetToggles = buildDatasetToggles(details);
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

  /**
   * Schedules the chart rendering to happen after view initialization and potential layout updates.
   * Uses requestAnimationFrame to ensure DOM is ready.
   */
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

  /**
   * Instantiates the Chart.js chart with the provided data.
   * Configures scales, legends, and dataset styles.
   * @param details The weather station details to visualize.
   */
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
        datasets: details.datasets.map((d, idx) => {
          const toggle = this.datasetToggles.find(t => t.datasetIndex === idx);
          return {
            label: d.label,
            data: d.data,
            // Erzwinge die Farbe vom Toggle, um Konsistenz mit der Checkbox zu garantieren
            borderColor: toggle?.color ?? d.borderColor ?? getColor(d.label, idx),
            backgroundColor: 'transparent',
            tension: typeof d.tension === 'number' ? d.tension : 0.25,
            fill: false,
            showLine: true,
            spanGaps: true,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointHitRadius: 8,
            borderWidth: 2,
            hidden: !isDefaultVisible(d.label),
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[chart] render failed', e);
      this.error = 'Chart konnte nicht gerendert werden.';
      this.cdr.detectChanges();
    }
  }

  /**
   * Toggles the visibility of a specific dataset in the chart.
   * @param t The toggle object.
   * @param checked The new checked state.
   */
  onToggleDataset(t: DatasetToggle, checked: boolean): void {
    t.visible = checked;

    const chart = this.chart;
    if (!chart) return;

    // Chart.js: dataset visibility setzen und updaten
    chart.setDatasetVisibility(t.datasetIndex, checked);
    chart.update();
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

/**
 * Transforms the station details into rows for the data table.
 * @param details Weather station details.
 * @returns Array of rows.
 */
function buildTableRows(details: WeatherStationDetails): TableRow[] {
  const labels = details.labels ?? [];
  const datasets = details.datasets ?? [];

  return labels.map((label, i) => ({
    label,
    values: datasets.map((ds) => formatValue(ds.data?.[i])),
  }));
}

/**
 * Formats a value for display in the table.
 * Rounds numbers to 1 decimal place.
 * @param v The value to format.
 */
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


function toFillColor(hex: string): string {
  // sehr simple: feste leichte Transparenz (funktioniert auch wenn schon rgba übergeben wird)
  if (hex.startsWith('rgba')) return hex;
  return 'rgba(0, 0, 0, 0.05)';
}

/**
 * Determines if a dataset should be visible by default.
 * Currently only 'Jahresdurchschnitt' is shown initially.
 * @param label Dataset label.
 */
function isDefaultVisible(label: string): boolean {
  // Nur 'xxx Jahresdurchschnitt' soll initial sichtbar sein.
  return !!label && label.includes('Jahresdurchschnitt');
}

/**
 * Removes the metric prefix (TMIN/TMAX) from the label for display purposes.
 * @param label Full label.
 * @param metric Detected metric.
 */
function stripMetricPrefix(label: string, metric: MetricKey): string {
  const raw = (label ?? '').trim();
  if (!raw) return raw;

  if (metric === 'TMIN') return raw.replace(/^TMIN\s*/i, '').trim();
  if (metric === 'TMAX') return raw.replace(/^TMAX\s*/i, '').trim();
  return raw;
}

/**
 * Detects whether a label corresponds to TMIN or TMAX.
 * @param label The dataset label.
 * @returns 'TMIN', 'TMAX', or 'OTHER'.
 */
function detectMetricFromLabel(label: string): MetricKey {
  const upper = (label ?? '').toUpperCase();
  if (upper.includes('TMIN')) return 'TMIN';
  if (upper.includes('TMAX')) return 'TMAX';
  return 'OTHER';
}

/**
 * Builds the list of toggle objects based on the chart datasets.
 * @param details Station details containing datasets.
 * @returns Array of DatasetToggle objects.
 */
function buildDatasetToggles(details: WeatherStationDetails): DatasetToggle[] {
  const datasets = details.datasets ?? [];

  // Reihenfolge beibehalten (steht schon in Details)
  return datasets.map((ds, idx) => {
    const metric = detectMetricFromLabel(ds.label);
    const displayLabel = stripMetricPrefix(ds.label, metric);

    return {
      datasetIndex: idx,
      label: ds.label,
      displayLabel,
      metric,
      visible: isDefaultVisible(ds.label),
      // Checkbox-Farb-Swatch: gleicher Algorithmus wie beim Chart
      color: getColor(ds.label, idx),
    } satisfies DatasetToggle;
  });
}

/**
 * Liefert die Farbe für ein Dataset basierend auf Label + Index.
 *
 * Anforderungen:
 * - Tmax Jahresdurchschnitt → Reines Rot (RGB: 255,0,0)
 * - Tmin Jahresdurchschnitt → Reines Blau (RGB: 0,0,255)
 * - Saisonale Durchschnitte → Pastelltöne; Tmin dunkler als Tmax
 */
function getColor(label: string | undefined, idx: number): string {
  // Fallback, falls Label nicht erkannt wird
  const palette = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#00796b'];
  const fallback = palette[idx % palette.length]!;

  if (!label) return fallback;
  const l = label.toUpperCase();

  // Jahresdurchschnitt
  if (l.includes('JAHRESDURCHSCHNITT')) {
    if (l.includes('TMAX')) return '#FF0000'; // Reines Rot
    if (l.includes('TMIN')) return '#0000FF'; // Reines Blau
  }

  // Saisonale Durchschnitte: Pastell (TMAX) vs. dunkler (TMIN)
  // Winter
  if (l.includes('WINTER')) {
    if (l.includes('TMAX')) return '#B0E0E6'; // Pastell-Blau (PowderBlue)
    if (l.includes('TMIN')) return '#4682B4';  // Dunkleres Blau (SteelBlue)
  }

  // Frühling
  if (l.includes('FRÜHLING') || l.includes('FRUEHLING') || l.includes('FRUeHLING')) {
    if (l.includes('TMAX')) return '#98FB98'; // Pastell-Grün (PaleGreen)
    if (l.includes('TMIN')) return '#228B22';   // Dunkleres Grün (ForestGreen)
  }

  // Sommer
  if (l.includes('SOMMER')) {
    if (l.includes('TMAX')) return '#efef71'; // Pastell-Gelb (LemonChiffon)
    if (l.includes('TMIN')) return '#FFD700';  // Dunkleres Gelb (Gold)
  }

  // Herbst
  if (l.includes('HERBST')) {
    if (l.includes('TMAX')) return '#ff82ab'; // Pastell-Braun/Wheat
    if (l.includes('TMIN')) return '#ff1493';   // Dunkleres Braun (SaddleBrown)
  }

  return fallback;
}
