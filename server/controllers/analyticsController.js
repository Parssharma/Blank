import Department from '../models/Department.js';
import BudgetRequest from '../models/BudgetRequest.js';
import User from '../models/User.js';

/* Helper: statuses that count as "approved spending" */
const APPROVED_STATUSES = ['FINAL_APPROVED', 'FINANCE_APPROVED'];

/* ─────────────────────────────────────────
   GET /api/analytics/forecast
   Predicts next 6 months spending based on historical requests using simple Linear Regression.
───────────────────────────────────────── */
export const getForecast = async (req, res) => {
    try {
        // Fetch all approved requests for the institution
        const requests = await BudgetRequest.find({
            institution: req.user.institution._id,
            status: { $in: APPROVED_STATUSES }
        }).sort('date');

        if (requests.length < 2) {
            return res.json({ success: true, data: { message: "Not enough historical data to generate forecast.", forecast: [] } });
        }

        // Group requests by month
        const monthlyTotals = {};
        requests.forEach(req => {
            const date = new Date(req.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + req.amount;
        });

        // Convert to array of [x, y] where x is index, y is amount
        const keys = Object.keys(monthlyTotals).sort();
        const dataPoints = keys.map((key, index) => ({ x: index, y: monthlyTotals[key], label: key }));

        // Linear Regression calculation: y = mx + b
        const n = dataPoints.length;
        if (n < 2) {
             return res.json({ success: true, data: { message: "Need data from at least 2 distinct months to generate forecast.", forecast: [] } });
        }

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        dataPoints.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += (p.x * p.y);
            sumXX += (p.x * p.x);
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Forecast next 6 months
        const forecast = [];
        let lastDate = new Date(keys[keys.length - 1] + '-01');
        for (let i = 1; i <= 6; i++) {
            lastDate.setMonth(lastDate.getMonth() + 1);
            const label = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
            const projectedY = Math.max(0, slope * (n - 1 + i) + intercept); // Ensure no negative spending
            forecast.push({ month: label, projectedAmount: Math.round(projectedY) });
        }

        res.json({ success: true, data: { historical: dataPoints, forecast, trend: slope > 0 ? 'increasing' : 'decreasing' } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/analytics/insights
   Identifies anomalies (requests > 2 standard deviations from mean) and generates NLP-style insights.
───────────────────────────────────────── */
export const getInsights = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({
            institution: req.user.institution._id,
            status: { $in: APPROVED_STATUSES }
        }).populate('department', 'name');

        if (requests.length === 0) {
            return res.json({ success: true, data: { insights: ["No spending data available yet to generate insights."] } });
        }

        const amounts = requests.map(r => r.amount);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        const anomalies = requests.filter(r => Math.abs(r.amount - mean) > 2 * stdDev);
        const insights = [];

        if (anomalies.length > 0) {
            anomalies.forEach(a => {
                insights.push(`Anomaly Detected: A heavily unusual spending of ₹${a.amount.toLocaleString('en-IN')} was approved for ${a.department?.name || 'a department'} under '${a.category}'.`);
            });
        }

        // Category breakdown
        const categoryTotals = {};
        requests.forEach(r => {
            categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.amount;
        });
        const topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b, Object.keys(categoryTotals)[0] || 'None');
        
        insights.push(`Trend Analysis: '${topCategory}' represents your highest overall spending category.`);
        if (slopeAnalysis(amounts) > 0) {
            insights.push("Warning: Overall institutional spending is trending upwards.");
        } else {
             insights.push("Good news: Overall institutional spending is stabilizing or trending downwards.");
        }

        /* ── Smart Recommendations ── */
        const recommendations = [];
        const departments = await Department.find({ institution: req.user.institution._id });
        departments.forEach(dept => {
            const pct = dept.budget > 0 ? Math.round((dept.spent / dept.budget) * 100) : 0;
            if (pct > 90) recommendations.push({ type: 'critical', text: `${dept.name} has used ${pct}% of its budget. Consider freezing non-essential spending.` });
            else if (pct > 70) recommendations.push({ type: 'warning', text: `${dept.name} is at ${pct}% utilization. Review upcoming commitments.` });
            else if (pct < 20) recommendations.push({ type: 'info', text: `${dept.name} is under-utilizing budget (${pct}%). Consider reallocating funds.` });
        });

        if (topCategory) {
            recommendations.push({ type: 'info', text: `Consider negotiating bulk deals for '${topCategory}' — your highest spend category.` });
        }

        res.json({ success: true, data: { mean: Math.round(mean), stdDev: Math.round(stdDev), insights, recommendations } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

function slopeAnalysis(data) {
    if(data.length < 2) return 0;
    const firstHalf = data.slice(0, Math.floor(data.length/2)).reduce((a,b)=>a+b,0);
    const secondHalf = data.slice(Math.floor(data.length/2)).reduce((a,b)=>a+b,0);
    return secondHalf - firstHalf;
}

/* ─────────────────────────────────────────
   GET /api/analytics/export
   Generates a CSV report of budget allocations and requests.
───────────────────────────────────────── */
export const exportReport = async (req, res) => {
    try {
        const departments = await Department.find({ institution: req.user.institution._id });
        const requests = await BudgetRequest.find({ institution: req.user.institution._id }).populate('department', 'name');

        let csv = "Report Type,Department,Category,Amount,Status,Date\n";

        // Append Departments
        departments.forEach(d => {
            csv += `Department Budget,"${d.name}",Overall,${d.budget},Active,-\n`;
        });

        // Append Requests
        requests.forEach(r => {
            csv += `Budget Request,"${r.department?.name || 'Unknown'}",${r.category},${r.amount},${r.status},${new Date(r.date).toLocaleDateString('en-IN')}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`budgetwise_report_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ─────────────────────────────────────────
   GET /api/analytics/comparative
   Compares spending across departments.
───────────────────────────────────────── */
export const getComparative = async (req, res) => {
    try {
        const departments = await Department.find({ institution: req.user.institution._id })
            .select('name budget spent categoryLimits');

        // Monthly spending by department (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const monthlyByDept = await BudgetRequest.aggregate([
            {
                $match: {
                    institution: req.user.institution._id,
                    status: { $in: APPROVED_STATUSES },
                    date: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { dept: '$department', month: { $month: '$date' }, year: { $year: '$date' } },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Category breakdown across all departments
        const categoryBreakdown = await BudgetRequest.aggregate([
            {
                $match: {
                    institution: req.user.institution._id,
                    status: { $in: APPROVED_STATUSES }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        res.json({
            success: true,
            data: {
                departments: departments.map(d => ({
                    id: d._id,
                    name: d.name,
                    budget: d.budget,
                    spent: d.spent,
                    remaining: Math.max(0, d.budget - d.spent),
                    utilization: d.budget > 0 ? Math.round((d.spent / d.budget) * 100) : 0
                })),
                monthlyByDept,
                categoryBreakdown
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
