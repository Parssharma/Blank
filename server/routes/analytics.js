import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getForecast, getInsights, exportReport, getComparative } from '../controllers/analyticsController.js';

const router = express.Router();

router.use(protect);

router.get('/forecast', authorize('admin', 'finance_officer'), getForecast);
router.get('/insights', authorize('admin', 'finance_officer'), getInsights);
router.get('/comparative', authorize('admin', 'finance_officer'), getComparative);
router.get('/export', authorize('admin', 'finance_officer', 'dept'), exportReport);

export default router;
