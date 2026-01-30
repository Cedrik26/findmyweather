/**
 * GHCN Weather Backend
 * Main application entry point
 */

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './models/database';
import { ensureStationsLoaded } from './services/ghcnFetcher';
import { getCacheStats, clearAllCaches } from './utils/cache';
import routes from './routes';

const app = express();

// ==========================================
// Middleware
// ==========================================

// CORS - allow all origins in development
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',')
        : '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON parsing
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ==========================================
// Health & Status Endpoints
// ==========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        version: '1.0.0',
        cache: getCacheStats(),
        timestamp: new Date().toISOString()
    });
});

app.post('/admin/clear-cache', (req, res) => {
    clearAllCaches();
    res.json({ message: 'All caches cleared' });
});

// ==========================================
// API Routes
// ==========================================

app.use('/api', routes);

// Also mount at root for convenience
app.use('/', routes);

// ==========================================
// Error Handling
// ==========================================

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// ==========================================
// Startup
// ==========================================

async function startup(): Promise<void> {
    console.log('🚀 Starting GHCN Weather Backend...');

    // Initialize database
    initializeDatabase();

    // Pre-load station metadata in background
    console.log('📡 Loading station metadata...');
    ensureStationsLoaded()
        .then(() => console.log('✅ Station metadata loaded'))
        .catch(err => console.error('⚠️ Failed to load stations:', err));

    // Start server
    app.listen(config.port, () => {
        console.log(`✅ Server running on http://localhost:${config.port}`);
        console.log(`📊 API endpoints:`);
        console.log(`   GET /stations?lat=...&lon=...&radiusKm=...`);
        console.log(`   GET /stations/:id/data?startYear=...&endYear=...`);
        console.log(`   GET /health`);
        console.log(`   GET /status`);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    closeDatabase();
    process.exit(0);
});

// Start the application
startup().catch(err => {
    console.error('❌ Startup failed:', err);
    process.exit(1);
});
