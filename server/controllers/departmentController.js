import Department from '../models/Department.js';
import BudgetRequest from '../models/BudgetRequest.js';
import User from '../models/User.js';

/* ─────────────────────────────────────────
   GET /api/departments
   Admin: all depts  |  Dept: own only
   ───────────────────────────────────────── */
export const getAllDepts = async (req, res) => {
    try {
        let depts;
        const institutionId = req.user.institution._id;

        if (req.user.role === 'admin' || req.user.role === 'finance_officer') {
            depts = await Department.find({ institution: institutionId }).sort('name');
        } else {
            if (!req.user.department) {
                return res.status(400).json({ success: false, message: 'No department assigned to this user' });
            }
            depts = await Department.find({ _id: req.user.department._id, institution: institutionId });
        }
        res.json({ success: true, count: depts.length, data: depts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   POST /api/departments  (admin only)
   ───────────────────────────────────────── */
export const createDept = async (req, res) => {
    try {
        const { name, head, budget, fiscalYear, categoryLimits } = req.body;
        if (!name || !head || !budget) {
            return res.status(400).json({ success: false, message: 'Name, head, and budget are required' });
        }
        const dept = await Department.create({ 
            name, 
            head, 
            budget, 
            fiscalYear,
            categoryLimits: categoryLimits || [],
            institution: req.user.institution._id 
        });
        res.status(201).json({ success: true, data: dept });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A department with that name already exists' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/departments/:id
   ───────────────────────────────────────── */
export const getDeptById = async (req, res) => {
    try {
        const dept = await Department.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!dept) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        // Dept user can only view their own
        if (req.user.role === 'dept' && dept._id.toString() !== req.user.department?._id?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this department' });
        }

        res.json({ success: true, data: dept });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   PUT /api/departments/:id  (admin only)
   ───────────────────────────────────────── */
export const updateDept = async (req, res) => {
    try {
        const dept = await Department.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!dept) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        const { name, head, budget } = req.body;

        // Validate new budget is not below what's been spent
        if (budget !== undefined && budget < dept.spent) {
            return res.status(400).json({
                success: false,
                message: `New budget (₹${budget.toLocaleString('en-IN')}) cannot be lower than amount already spent (₹${dept.spent.toLocaleString('en-IN')})`
            });
        }

        if (name)   dept.name   = name;
        if (head)   dept.head   = head;
        if (budget !== undefined) dept.budget = budget;

        await dept.save();
        res.json({ success: true, data: dept });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   DELETE /api/departments/:id  (admin only)
   ───────────────────────────────────────── */
export const deleteDept = async (req, res) => {
    try {
        const dept = await Department.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!dept) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        // Cascade: delete all budget requests for this dept
        await BudgetRequest.deleteMany({ department: dept._id });
        // Unlink users
        await User.updateMany({ department: dept._id }, { $set: { department: null } });

        await dept.deleteOne();
        res.json({ success: true, message: `Department '${dept.name}' and associated data deleted` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/departments/:id/stats
   ───────────────────────────────────────── */
export const getDeptStats = async (req, res) => {
    try {
        const dept = await Department.findOne({ _id: req.params.id, institution: req.user.institution._id });
        if (!dept) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        // Dept user can only view own stats
        if (req.user.role === 'dept' && dept._id.toString() !== req.user.department?._id?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Sum pending requests
        const pendingAgg = await BudgetRequest.aggregate([
            { $match: { department: dept._id, status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const pending = pendingAgg[0]?.total || 0;

        res.json({
            success: true,
            data: {
                _id:           dept._id,
                name:          dept.name,
                head:          dept.head,
                budget:        dept.budget,
                spent:         dept.spent,
                pending,
                remaining:     Math.max(0, dept.budget - dept.spent),
                utilizationPct: dept.utilizationPct,
                fiscalYear:    dept.fiscalYear,
                categoryLimits: dept.categoryLimits
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
