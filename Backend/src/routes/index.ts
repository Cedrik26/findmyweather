/**
 * Routes Index
 * Aggregates all route modules
 */

import { Router } from 'express';
import stationsRouter from './stations';

const router = Router();

// Mount station routes
router.use('/', stationsRouter);

export default router;
