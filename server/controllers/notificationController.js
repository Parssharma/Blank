import Notification from '../models/Notification.js';
import User from '../models/User.js';

/* ─────────────────────────────────────────
   Helper: create a notification for a user
   ───────────────────────────────────────── */
export const createNotification = async ({ userId, institutionId, type, title, message, requestId = null }) => {
    try {
        await Notification.create({
            user: userId,
            institution: institutionId,
            type,
            title,
            message,
            requestId
        });
    } catch (err) {
        console.error('[Notification] Failed to create:', err.message);
    }
};

/* ─────────────────────────────────────────
   Helper: parse @mentions from comment text
   Returns array of matched User docs
   ───────────────────────────────────────── */
export const parseMentions = async (text, institutionId) => {
    const mentionRegex = /@(\w+)/g;
    const handles = [...text.matchAll(mentionRegex)].map(m => m[1]);
    if (!handles.length) return [];

    // Look up users by name fragment within the same institution
    const users = await User.find({
        institution: institutionId,
        name: { $in: handles.map(h => new RegExp(h, 'i')) }
    }).select('_id name');

    return users;
};

/* ─────────────────────────────────────────
   GET /api/notifications
   ───────────────────────────────────────── */
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            user: req.user._id,
            institution: req.user.institution._id
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('requestId', 'category amount status');

        res.json({ success: true, count: notifications.length, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PATCH /api/notifications/:id/read
   ───────────────────────────────────────── */
export const markAsRead = async (req, res) => {
    try {
        const notif = await Notification.findOne({
            _id: req.params.id,
            user: req.user._id
        });
        if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

        notif.read = true;
        await notif.save();
        res.json({ success: true, data: notif });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PATCH /api/notifications/read-all
   ───────────────────────────────────────── */
export const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, institution: req.user.institution._id, read: false },
            { $set: { read: true } }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
