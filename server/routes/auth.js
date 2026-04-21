import express from 'express';
import { register, login, getMe, updateProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/register', register);
router.post('/login',    login);
router.get ('/me',       protect, getMe);
router.put ('/me',       protect, updateProfile);

/* ── Admin: list all dept-head users ── */
router.get('/users', protect, authorize('admin'), async (_req, res) => {
    try {
        const users = await User.find({ role: 'dept' })
            .select('name email department avatar')
            .populate('department', 'name')
            .sort('name');
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── Admin: assign a department to a user ── */
router.put('/users/:id/department', protect, authorize('admin'), async (req, res) => {
    try {
        const { departmentId } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { department: departmentId || null },
            { new: true }
        ).populate('department', 'name');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
