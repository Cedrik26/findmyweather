/**
 * Request Validation Middleware
 * Uses Zod for type-safe validation of query parameters
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// ==========================================
// Validation Schemas
// ==========================================

export const stationSearchSchema = z.object({
    lat: z.coerce
        .number()
        .min(config.validation.minLat, 'Latitude must be >= -90')
        .max(config.validation.maxLat, 'Latitude must be <= 90'),
    lon: z.coerce
        .number()
        .min(config.validation.minLon, 'Longitude must be >= -180')
        .max(config.validation.maxLon, 'Longitude must be <= 180'),
    radiusKm: z.coerce
        .number()
        .min(1, 'Radius must be at least 1 km')
        .max(config.defaults.maxRadius, `Radius must be <= ${config.defaults.maxRadius} km`)
        .optional()
        .default(config.defaults.defaultRadius),
    maxStations: z.coerce
        .number()
        .int()
        .min(1, 'Must return at least 1 station')
        .max(config.defaults.maxStations, `Max stations is ${config.defaults.maxStations}`)
        .optional()
        .default(config.defaults.defaultMaxStations),
    startYear: z.coerce
        .number()
        .int()
        .min(config.validation.minYear, `Start year must be >= ${config.validation.minYear}`)
        .max(config.validation.maxYear, `Start year must be <= ${config.validation.maxYear}`)
        .optional(),
    endYear: z.coerce
        .number()
        .int()
        .min(config.validation.minYear, `End year must be >= ${config.validation.minYear}`)
        .max(config.validation.maxYear, `End year must be <= ${config.validation.maxYear}`)
        .optional()
}).refine(
    data => !data.startYear || !data.endYear || data.startYear <= data.endYear,
    { message: 'Start year must be <= end year', path: ['startYear'] }
);

export const stationDataSchema = z.object({
    startYear: z.coerce
        .number()
        .int()
        .min(config.validation.minYear, `Start year must be >= ${config.validation.minYear}`)
        .max(config.validation.maxYear, `Start year must be <= ${config.validation.maxYear}`),
    endYear: z.coerce
        .number()
        .int()
        .min(config.validation.minYear, `End year must be >= ${config.validation.minYear}`)
        .max(config.validation.maxYear, `End year must be <= ${config.validation.maxYear}`),
    metrics: z.union([
        z.string().transform(s => s.split(',')),
        z.array(z.string())
    ])
        .optional()
        .default(['TMAX', 'TMIN'])
        .transform(arr => arr.filter(m => ['TMIN', 'TMAX'].includes(m.toUpperCase())).map(m => m.toUpperCase()))
}).refine(
    data => data.startYear <= data.endYear,
    { message: 'Start year must be <= end year', path: ['startYear'] }
);

// ==========================================
// Validation Middleware
// ==========================================

export type ValidatedStationSearch = z.infer<typeof stationSearchSchema>;
export type ValidatedStationData = z.infer<typeof stationDataSchema>;

/**
 * Middleware factory for validating query parameters
 */
function validateQuery<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.parse(req.query);
            // Attach validated data to request
            (req as Request & { validated: T }).validated = result;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid query parameters',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
                return;
            }
            next(error);
        }
    };
}

export const validateStationSearch = validateQuery(stationSearchSchema);
export const validateStationData = validateQuery(stationDataSchema);
