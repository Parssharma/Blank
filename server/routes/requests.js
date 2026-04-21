import express from 'express';
import {
    getRequests,
    getPendingRequests,
    getInsights,
    getRequestById,
    createRequest,
    updateRequestStatus,
    updateRequest,
    deleteRequest
} from '../controllers/requestController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All request routes require authentication
router.use(protect);

// Special routes BEFORE /:id to avoid conflict
router.get('/pending',  authorize('admin'), getPendingRequests);
router.get('/insights', getInsights);

router.route('/')
    .get(getRequests)
    .post(authorize('dept'), createRequest);

router.route('/:id')
    .get(getRequestById)
    .put(updateRequest)
    .delete(deleteRequest);

router.put('/:id/status', authorize('admin'), updateRequestStatus);

export default router;
