import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getNotifications,
    markAsRead,
    markAllRead
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(protect);

router.get('/',          getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);

export default router;
