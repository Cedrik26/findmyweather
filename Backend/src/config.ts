export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    dbPath: process.env.DB_PATH || './data/ghcn.db',

    ghcn: {
        stationsUrl: 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt',
        inventoryUrl: 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt',
        dataBaseUrl: 'https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/'
    },

    cache: {
        stationsTTL: 86400,    // 24 Stunden
        weatherTTL: 3600,      // 1 Stunde
        searchTTL: 300         // 5 Minuten für Suchergebnisse
    },

    defaults: {
        maxRadius: 500,        // km
        maxStations: 100,
        defaultRadius: 50,     // km
        defaultMaxStations: 100
    },

    validation: {
        minLat: -90,
        maxLat: 90,
        minLon: -180,
        maxLon: 180,
        minYear: 1750,
        maxYear: new Date().getFullYear()
    }
};
