import BudgetRequest from '../models/BudgetRequest.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import { createNotification, parseMentions } from './notificationController.js';

/* Server-side INR formatter for notification messages */
const formatINRServer = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/* ─────────────────────────────────────────
   GET /api/requests
   Admin: all  |  Dept: own requests only
   Query: ?status=pending&category=Software&page=1&limit=20
   ───────────────────────────────────────── */
export const getRequests = async (req, res) => {
    try {
        const filter = { institution: req.user.institution._id };

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

        // Pagination
        const page  = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip  = (page - 1) * limit;
        const total = await BudgetRequest.countDocuments(filter);

        const requests = await BudgetRequest.find(filter)
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .populate('reviewedBy', 'name')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            count: requests.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: requests
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/requests/pending  (admin only)
   ───────────────────────────────────────── */
export const getPendingRequests = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({ 
            status: { $in: ['pending', 'FINANCE_APPROVED', 'PENDING'] }, 
            institution: req.user.institution._id 
        })
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
        const matchStage = { institution: req.user.institution._id };

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
        const request = await BudgetRequest.findOne({ _id: req.params.id, institution: req.user.institution._id })
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .populate('reviewedBy', 'name')
            .populate('comments.user', 'name role avatar');

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
        const { amount, category, description, priority } = req.body;

        if (!amount || !category || !description) {
            return res.status(400).json({ success: false, message: 'Amount, category, and description are required' });
        }

        if (!req.user.department) {
            return res.status(400).json({ success: false, message: 'Your account has no department assigned' });
        }

        // Initialise request with workflow status UNDER_REVIEW
        const request = await BudgetRequest.create({
            department:  req.user.department._id,
            institution: req.user.institution._id,
            submittedBy: req.user._id,
            amount,
            category,
            description,
            priority: priority || 'normal',
            status: 'UNDER_REVIEW'
        });

        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');

        // Notify all admins of the new request
        const admins = await User.find({ institution: req.user.institution._id, role: 'admin' }).select('_id');
        await Promise.all(admins.map(admin => createNotification({
            userId: admin._id,
            institutionId: req.user.institution._id,
            type: 'workflow',
            title: 'New Budget Request',
            message: `${req.user.name} submitted a ${category} request for ₹${Number(amount).toLocaleString('en-IN')}`,
            requestId: request._id
        })));

        // Notify finance officers in the same institution
        const financeOfficers = await User.find({ institution: req.user.institution._id, role: 'finance_officer' }).select('_id');
        await Promise.all(financeOfficers.map(officer => createNotification({
            userId: officer._id,
            institutionId: req.user.institution._id,
            type: 'workflow',
            title: 'Request awaiting review',
            message: `${req.user.name} submitted a ${category} request for ₹${Number(amount).toLocaleString('en-IN')}. Please review.`,
            requestId: request._id
        })));

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

        const request = await BudgetRequest.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (!['pending', 'PENDING', 'FINANCE_APPROVED'].includes(request.status)) {
            return res.status(400).json({ success: false, message: `Request has already been ${request.status}` });
        }

        // --- MULTI-LEVEL WORKFLOW LOGIC ---
        let nextWorkflowState = request.workflowState;
        let finalStatus = request.status;
        let shouldCommitFunds = false;

        if (status === 'rejected') {
            finalStatus = 'rejected';
            nextWorkflowState = 'rejected';
        } else if (status === 'approved') {
            // Admin can bypass all workflow stages and give final approval directly
            if (req.user.role === 'admin') {
                nextWorkflowState = 'approved';
                finalStatus = 'approved';
                shouldCommitFunds = true;
            } else if (request.workflowState === 'pending_dept_head') {
                if (req.user.role !== 'dept') {
                    return res.status(403).json({ success: false, message: 'Only Dept Head can approve at this stage' });
                }
                nextWorkflowState = 'pending_finance';
                finalStatus = 'pending';
            } else if (request.workflowState === 'pending_finance') {
                if (req.user.role !== 'finance_officer') {
                    return res.status(403).json({ success: false, message: 'Only Finance Officer can final approve' });
                }
                nextWorkflowState = 'approved';
                finalStatus = 'approved';
                shouldCommitFunds = true;
            }
        }

        // If this is the final approval, commit funds to department budget
        if (shouldCommitFunds) {
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

            // Check category limits
            const catLimit = dept.categoryLimits?.find(c => c.category === request.category);
            if (catLimit && (catLimit.spent + request.amount > catLimit.limit)) {
                return res.status(400).json({
                    success: false,
                    message: `Approval would exceed category limit for ${request.category}. Available: ₹${(catLimit.limit - catLimit.spent).toLocaleString('en-IN')}`
                });
            }

            dept.spent += request.amount;
            if (catLimit) catLimit.spent += request.amount;
            
            await dept.save();

            /* ── Automated Budget Alerts ── */
            const newUtilization = dept.budget > 0 ? Math.round((dept.spent / dept.budget) * 100) : 0;
            const institution = await Institution.findById(req.user.institution._id);
            const thresholds = institution?.settings?.alertThresholds || { budgetWarning: 80, budgetCritical: 95 };

            if (newUtilization >= thresholds.budgetCritical) {
                const alertTargets = await User.find({
                    institution: req.user.institution._id,
                    $or: [{ role: 'admin' }, { department: dept._id }]
                }).select('_id');
                await Promise.all(alertTargets.map(u => createNotification({
                    userId: u._id,
                    institutionId: req.user.institution._id,
                    type: 'alert',
                    title: `🚨 Critical: ${dept.name} at ${newUtilization}%`,
                    message: `Budget utilization has exceeded ${thresholds.budgetCritical}%. Only ${formatINRServer(dept.budget - dept.spent)} remaining. Immediate action required.`,
                    requestId: request._id
                })));
            } else if (newUtilization >= thresholds.budgetWarning) {
                const alertTargets = await User.find({
                    institution: req.user.institution._id,
                    $or: [{ role: 'admin' }, { department: dept._id }]
                }).select('_id');
                await Promise.all(alertTargets.map(u => createNotification({
                    userId: u._id,
                    institutionId: req.user.institution._id,
                    type: 'alert',
                    title: `⚠️ Warning: ${dept.name} at ${newUtilization}%`,
                    message: `Budget utilization has exceeded ${thresholds.budgetWarning}%. ${formatINRServer(dept.budget - dept.spent)} remaining. Review spending.`,
                    requestId: request._id
                })));
            }
        }

        request.status = finalStatus;
        request.workflowState = nextWorkflowState;
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');
        await request.populate('reviewedBy', 'name');

        // Notify submitter and next approvers
        if (finalStatus === 'approved' || finalStatus === 'rejected') {
            await createNotification({
                userId: request.submittedBy._id,
                institutionId: req.user.institution._id,
                type: 'workflow',
                title: `Request ${finalStatus === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
                message: `Your ${request.category} request for ₹${request.amount.toLocaleString('en-IN')} has been ${finalStatus}.`,
                requestId: request._id
            });
        } else if (nextWorkflowState === 'pending_finance') {
            const financeOfficers = await User.find({ institution: req.user.institution._id, role: { $in: ['admin', 'finance_officer'] } }).select('_id');
            await Promise.all(financeOfficers.map(fo => createNotification({
                userId: fo._id,
                institutionId: req.user.institution._id,
                type: 'workflow',
                title: 'Pending Finance Approval',
                message: `A request for ₹${request.amount.toLocaleString('en-IN')} passed Dept Head review and awaits your final approval.`,
                requestId: request._id
            })));
        }

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
        const request = await BudgetRequest.findOne({ _id: req.params.id, institution: req.user.institution._id });
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

        // Track version history before making changes
        if (amount && amount !== request.amount) {
            request.versionHistory.push({
                modifiedAt: new Date(),
                previousAmount: request.amount,
                user: req.user._id
            });
        }

        if (amount)      request.amount      = amount;
        if (category)    request.category    = category;
        if (description) request.description = description;

        await request.save();
        await request.populate('department', 'name');
        await request.populate('submittedBy', 'name email');
        await request.populate('versionHistory.user', 'name');

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
        const request = await BudgetRequest.findOne({ _id: req.params.id, institution: req.user.institution._id });
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

/* ─────────────────────────────────────────
   POST /api/requests/:id/comments
   ───────────────────────────────────────── */
export const addComment = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const request = await BudgetRequest.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Authorize: admin or dept user
        if (req.user.role === 'dept' && request.department.toString() !== req.user.department?._id?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to comment on this request' });
        }

        request.comments.push({
            user: req.user._id,
            text
        });

        await request.save();
        await request.populate('comments.user', 'name role avatar');

        // Parse @mentions and notify each mentioned user
        const mentionedUsers = await parseMentions(text, req.user.institution._id);
        const submitterId = request.submittedBy.toString();
        const allNotifyIds = new Set(mentionedUsers.map(u => u._id.toString()));
        // Also notify request owner if commenter is admin and they're not the owner
        if (req.user.role === 'admin' && submitterId !== req.user._id.toString()) {
            allNotifyIds.add(submitterId);
        }

        await Promise.all([...allNotifyIds].map(uid => {
            const isMention = mentionedUsers.some(u => u._id.toString() === uid);
            return createNotification({
                userId: uid,
                institutionId: req.user.institution._id,
                type: isMention ? 'mention' : 'comment',
                title: isMention ? `You were mentioned by ${req.user.name}` : `New comment on your request`,
                message: text.length > 80 ? text.slice(0, 80) + '...' : text,
                requestId: request._id
            });
        }));
        
        res.status(201).json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
