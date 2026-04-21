import BudgetRequest from '../models/BudgetRequest.js';
import Department from '../models/Department.js';

/* ─────────────────────────────────────────
   GET /api/requests
   Admin: all  |  Dept: own requests only
   Query: ?status=pending&category=Software
   ───────────────────────────────────────── */
export const getRequests = async (req, res) => {
    try {
        const filter = {};

        // Scoping by role
        if (req.user.role === 'dept') {
            filter.department = req.user.department._id;
        }

        // Optional query filters
        if (req.query.status)   filter.status   = req.query.status;
        if (req.query.category) filter.category = req.query.category;
        if (req.query.department && req.user.role === 'admin') {
            filter.department = req.query.department;
        }

        const requests = await BudgetRequest.find(filter)
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .populate('reviewedBy', 'name')
            .sort({ date: -1 });

        res.json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/requests/pending  (admin only)
   ───────────────────────────────────────── */
export const getPendingRequests = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({ status: 'pending' })
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .sort({ date: -1 });

        res.json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/requests/insights
   Query: ?deptId=xxx (optional, admin only)
   ───────────────────────────────────────── */
export const getInsights = async (req, res) => {
    try {
        const matchStage = {};

        if (req.user.role === 'dept') {
            matchStage.department = req.user.department._id;
        } else if (req.query.deptId) {
            const mongoose = (await import('mongoose')).default;
            matchStage.department = new mongoose.Types.ObjectId(req.query.deptId);
        }

        // Top category by approved spend
        const topCatAgg = await BudgetRequest.aggregate([
            { $match: { ...matchStage, status: 'approved' } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } },
            { $limit: 1 }
        ]);
        const topCategory = topCatAgg[0]?._id || null;

        // Low budget warning (dept only)
        let lowBudgetWarning = false;
        let deptData = null;
        if (req.user.role === 'dept' && req.user.department) {
            deptData = await Department.findById(req.user.department._id);
            if (deptData) {
                const remaining = deptData.budget - deptData.spent;
                lowBudgetWarning = remaining / deptData.budget < 0.2;
            }
        }

        // Latest request
        const latest = await BudgetRequest.findOne(matchStage)
            .sort({ date: -1 })
            .select('category date status amount');

        res.json({
            success: true,
            data: {
                topCategory,
                lowBudgetWarning,
                latestRequest: latest
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/requests/:id
   ───────────────────────────────────────── */
export const getRequestById = async (req, res) => {
    try {
        const request = await BudgetRequest.findById(req.params.id)
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .populate('reviewedBy', 'name');

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Dept user can only see own dept's requests
        if (req.user.role === 'dept' &&
            request.department._id.toString() !== req.user.department?._id?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   POST /api/requests  (dept)
   ───────────────────────────────────────── */
export const createRequest = async (req, res) => {
    try {
        const { amount, category, description } = req.body;

        if (!amount || !category || !description) {
            return res.status(400).json({ success: false, message: 'Amount, category, and description are required' });
        }

        if (!req.user.department) {
            return res.status(400).json({ success: false, message: 'Your account has no department assigned' });
        }

        const request = await BudgetRequest.create({
            department:  req.user.department._id,
            submittedBy: req.user._id,
            amount,
            category,
            description
        });

        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');

        res.status(201).json({ success: true, data: request });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: messages.join('. ') });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PUT /api/requests/:id/status  (admin only)
   body: { status: 'approved' | 'rejected' }
   ───────────────────────────────────────── */
export const updateRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
        }

        const request = await BudgetRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Request has already been ${request.status}` });
        }

        // If approving → increment dept.spent
        if (status === 'approved') {
            const dept = await Department.findById(request.department);
            if (!dept) {
                return res.status(404).json({ success: false, message: 'Associated department not found' });
            }
            if (dept.spent + request.amount > dept.budget) {
                return res.status(400).json({
                    success: false,
                    message: `Approval would exceed department budget. Available: ₹${(dept.budget - dept.spent).toLocaleString('en-IN')}`
                });
            }
            dept.spent += request.amount;
            await dept.save();
        }

        request.status     = status;
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');
        await request.populate('reviewedBy', 'name');

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PUT /api/requests/:id
   Owner can edit if still pending
   ───────────────────────────────────────── */
export const updateRequest = async (req, res) => {
    try {
        const request = await BudgetRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Only owner can edit
        if (request.submittedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the submitter can edit this request' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be edited' });
        }

        const { amount, category, description } = req.body;
        if (amount)      request.amount      = amount;
        if (category)    request.category    = category;
        if (description) request.description = description;

        await request.save();
        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   DELETE /api/requests/:id
   Admin: always  |  Owner: only if pending
   ───────────────────────────────────────── */
export const deleteRequest = async (req, res) => {
    try {
        const request = await BudgetRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const isOwner = request.submittedBy.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this request' });
        }
        if (!isAdmin && request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'You can only delete pending requests' });
        }

        // If deleting an approved request (admin only) → roll back spent
        if (isAdmin && request.status === 'approved') {
            await Department.findByIdAndUpdate(request.department, {
                $inc: { spent: -request.amount }
            });
        }

        await request.deleteOne();
        res.json({ success: true, message: 'Budget request deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
