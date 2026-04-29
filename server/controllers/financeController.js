import BudgetRequest from '../models/BudgetRequest.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { createNotification } from './notificationController.js';

/**
 * GET /api/finance/requests
 * Returns all requests pending finance review (status UNDER_REVIEW) for the user's institution.
 */
export const getFinanceRequests = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({
            institution: req.user.institution._id,
            status: 'UNDER_REVIEW'
        })
            .populate('department', 'name')
            .populate('submittedBy', 'name email')
            .sort({ date: -1 });
        res.json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/finance/forward/:id
 * Finance Officer forwards a request to Admin for final approval.
 * Status changes to FINANCE_APPROVED.
 */
export const forwardRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await BudgetRequest.findOne({
            _id: id,
            institution: req.user.institution._id,
            status: 'UNDER_REVIEW'
        });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found or not pending finance review' });
        }
        request.status = 'FINANCE_APPROVED';
        request.workflowState = 'pending_finance';
        await request.save();
        // Notify admins
        const admins = await User.find({ institution: req.user.institution._id, role: 'admin' }).select('_id');
        await Promise.all(admins.map(admin => createNotification({
            userId: admin._id,
            institutionId: req.user.institution._id,
            type: 'workflow',
            title: 'Request forwarded by Finance Officer',
            message: `${req.user.name} forwarded a ${request.category} request for approval.`,
            requestId: request._id
        })));
        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/finance/adjust-budget/:deptId
 * Adjust department budget and optional time‑based limits.
 * Body may contain { budget, budgetLimits }
 */
export const adjustBudget = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { budget, budgetLimits, categoryLimits } = req.body;
        const dept = await Department.findOne({ _id: deptId, institution: req.user.institution._id });
        if (!dept) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        if (typeof budget === 'number') dept.budget = budget;
        if (Array.isArray(budgetLimits)) dept.budgetLimits = budgetLimits;
        if (Array.isArray(categoryLimits) && categoryLimits.length > 0) {
            // merge or replace category limits
            const existingMap = new Map(dept.categoryLimits.map(c => [c.category, c]));
            categoryLimits.forEach(newCat => {
                if (existingMap.has(newCat.category)) {
                    existingMap.get(newCat.category).limit = newCat.limit;
                } else {
                    dept.categoryLimits.push(newCat);
                }
            });
        }
        await dept.save();
        res.json({ success: true, data: dept });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/finance/expense-trends
 * Returns aggregated expense data for the last 6 months (or configurable)
 */
export const getExpenseTrends = async (req, res) => {
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setMonth(oneYearAgo.getMonth() - 11);
        oneYearAgo.setDate(1);
        const agg = await BudgetRequest.aggregate([
            { $match: { institution: req.user.institution._id, status: { $in: ['FINANCE_APPROVED', 'FINAL_APPROVED'] } } },
            { $match: { date: { $gte: oneYearAgo } } },
            {
                $group: {
                    _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        const data = agg.map(item => ({
            period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            total: item.total
        }));
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/finance/reject/:id
 * Finance Officer rejects a request outright.
 */
export const rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const request = await BudgetRequest.findOne({
            _id: id,
            institution: req.user.institution._id,
            status: 'UNDER_REVIEW'
        });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found or not pending finance review' });
        }
        request.status = 'REJECTED';
        request.reviews.push({
            reviewer: req.user._id,
            role: 'finance',
            action: 'rejected',
            comment: comment || 'Rejected by Finance Officer'
        });
        await request.save();

        // Notify submitter
        await createNotification({
            userId: request.submittedBy,
            institutionId: req.user.institution._id,
            type: 'workflow',
            title: 'Request Rejected ❌',
            message: `${req.user.name} rejected your ${request.category} request. ${comment ? `Reason: ${comment}` : ''}`,
            requestId: request._id
        });

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/finance/revise/:id
 * Finance Officer requests revision from the submitter.
 */
export const requestRevision = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        if (!comment) {
            return res.status(400).json({ success: false, message: 'A comment explaining the required changes is mandatory' });
        }
        const request = await BudgetRequest.findOne({
            _id: id,
            institution: req.user.institution._id,
            status: 'UNDER_REVIEW'
        });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found or not pending finance review' });
        }
        request.status = 'NEEDS_REVISION';
        request.reviews.push({
            reviewer: req.user._id,
            role: 'finance',
            action: 'revision_requested',
            comment
        });
        await request.save();

        // Notify submitter
        await createNotification({
            userId: request.submittedBy,
            institutionId: req.user.institution._id,
            type: 'workflow',
            title: 'Revision Requested 📝',
            message: `${req.user.name} is requesting changes to your ${request.category} request: ${comment}`,
            requestId: request._id
        });

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
