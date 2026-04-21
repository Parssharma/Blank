import express from 'express';
import {
    getAllDepts,
    createDept,
    getDeptById,
    updateDept,
    deleteDept,
    getDeptStats
} from '../controllers/departmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public route — no auth needed (used by registration form)
router.get('/public', async (_req, res) => {
    try {
        const Department = (await import('../models/Department.js')).default;
        const depts = await Department.find().select('name').sort('name');
        res.json({ success: true, data: depts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// All dept routes below require authentication
router.use(protect);

router.route('/')
    .get(getAllDepts)                       // Admin=all, Dept=own
    .post(authorize('admin'), createDept); // Admin only

router.route('/:id')
    .get(getDeptById)
    .put(authorize('admin'), updateDept)
    .delete(authorize('admin'), deleteDept);

router.get('/:id/stats', getDeptStats);

export default router;
