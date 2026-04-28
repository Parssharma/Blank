import User from '../models/User.js';

/* ── Helper: sign token + send response ── */
const sendToken = (user, statusCode, res) => {
    const token = user.getSignedToken();
    res.status(statusCode).json({
        success: true,
        token,
        data: {
            _id:        user._id,
            name:       user.name,
            email:      user.email,
            role:       user.role,
            avatar:     user.avatar,
            department: user.department
        }
    });
};

/* ─────────────────────────────────────────
   POST /api/auth/register
   ───────────────────────────────────────── */
export const register = async (req, res) => {
    try {
        const { name, email, password, role, department, avatar } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(409).json({ success: false, message: 'An account with that email already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'dept',
            department: department || null,
            avatar: avatar || 'Lucky'
        });

        // Populate dept name for the response
        await user.populate('department', 'name budget spent head');

        sendToken(user, 201, res);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: messages.join('. ') });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   POST /api/auth/login
   ───────────────────────────────────────── */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password')
            .populate('department', 'name budget spent head');

        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        sendToken(user, 200, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/auth/me
   ───────────────────────────────────────── */
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('department', 'name budget spent head');
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PUT /api/auth/me
   ───────────────────────────────────────── */
export const updateProfile = async (req, res) => {
    try {
        const { name, avatar, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');

        if (name)   user.name   = name;
        if (avatar) user.avatar = avatar;

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Current password is required to set a new one' });
            }
            const match = await user.matchPassword(currentPassword);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect' });
            }
            user.password = newPassword;
        }

        await user.save();
        await user.populate('department', 'name budget spent head');

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
