import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getFinanceRequests, forwardRequest, rejectRequest, requestRevision, adjustBudget, getExpenseTrends } from '../controllers/financeController.js';

const router = express.Router();

// All routes require authenticated finance officer
router.use(protect);
router.use(authorize('finance_officer'));

router.get('/requests', getFinanceRequests);
router.post('/forward/:id', forwardRequest);
router.post('/reject/:id', rejectRequest);
router.post('/revise/:id', requestRevision);
router.post('/adjust-budget/:deptId', adjustBudget);
router.get('/expense-trends', getExpenseTrends);

export default router;
