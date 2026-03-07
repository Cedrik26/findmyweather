# 🌤️ FindMyWeather

Wetterdaten-Webanwendung basierend auf dem **GHCN (Global Historical Climatology Network)** Datensatz der NOAA. Zeigt historische Temperaturverläufe (TMAX/TMIN) für Wetterstationen weltweit an.

## Architektur

```
┌────────────┐     ┌────────────┐     ┌──────────────┐
│  Frontend  │────▶│  Backend   │────▶│  PostgreSQL   │
│  (Nginx)   │     │ (Express)  │     │  (16-alpine)  │
│  Port 80   │     │  Port 3000 │     │  Port 5432    │
└────────────┘     └────────────┘     └──────────────┘
```

| Komponente | Technologie |
|-----------|-------------|
| **Frontend** | Angular 21, Leaflet, Chart.js |
| **Backend** | Node.js, Express 5, TypeScript |
| **Datenbank** | PostgreSQL 16 |
| **Containerisierung** | Docker Compose (3 Container) |

## Voraussetzungen

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Windows / Mac) oder **[Docker Engine](https://docs.docker.com/engine/install/)** (Linux)

> [!IMPORTANT]
> Docker Desktop muss **gestartet** sein, bevor du die Befehle ausführst.

## 🚀 Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/Cedrik26/findmyweather.git
cd findmyweather

# 2. Alle 3 Container bauen und starten (erster Start dauert ~2–3 Min.)
docker compose up --build
```

Danach ist die Anwendung erreichbar unter:

| URL | Beschreibung |
|-----|-------------|
| http://localhost | Frontend (Kartenansicht) |
| http://localhost/api/health | API Health Check |
| http://localhost:3000/health | Backend direkt |

## Container stoppen

```bash
# Container stoppen
docker compose down

# Container stoppen + Datenbank-Daten löschen
docker compose down -v
```

## Entwicklung (ohne Docker)

Wenn du ohne Docker lokal entwickeln willst:

### Voraussetzungen
- Node.js 22+
- PostgreSQL 16+ (lokal installiert und gestartet)

### Datenbank einrichten
```sql
CREATE USER ghcn WITH PASSWORD 'ghcn_secret';
CREATE DATABASE ghcn_weather OWNER ghcn;
```

### Backend starten
```bash
cd Backend
npm install
npm run dev
```

### Frontend starten
```bash
cd frontend
npm install
npm start
```

Das Frontend ist dann unter http://localhost:4200 erreichbar und leitet API-Anfragen über den Proxy an `localhost:3000` weiter.

## Projektstruktur

```
findmyweather/
├── docker-compose.yml          # 3 Container: Frontend, Backend, PostgreSQL
├── Backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts            # Express Server Einstiegspunkt
│   │   ├── config.ts           # Konfiguration (DB, GHCN URLs, etc.)
│   │   ├── models/
│   │   │   ├── database.ts     # PostgreSQL Datenbankschicht
│   │   │   └── types.ts        # TypeScript Interfaces
│   │   ├── routes/
│   │   │   └── stations.ts     # API Endpunkte (/stations, /stations/:id/data)
│   │   └── services/
│   │       ├── ghcnFetcher.ts  # NOAA GHCN Daten-Fetcher
│   │       └── weatherProcessor.ts  # Datenverarbeitung (Jahres-/Saisondurchschnitte)
│   └── tests/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # Nginx: SPA + API Reverse-Proxy
│   └── src/                    # Angular Quellcode
└── README.md
```

## API Endpunkte

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/stations?lat=...&lon=...&radiusKm=...` | Wetterstationen in der Nähe suchen |
| GET | `/api/stations/:id` | Stationsdetails abrufen |
| GET | `/api/stations/:id/data?startYear=...&endYear=...` | Wetterdaten für eine Station |
| GET | `/health` | Health Check |

## Datenquelle

Wetterdaten stammen vom [NOAA GHCN-Daily](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily) Datensatz, gehostet auf AWS S3.
