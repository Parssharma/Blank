const INITIAL_DEPARTMENTS = [
    { id: 'sci', name: 'Science & Research', budget: 500000, spent: 125000, head: 'Dr. Sarah Smith' },
    { id: 'eng', name: 'Engineering',         budget: 750000, spent: 340000, head: 'Prof. James Wilson' },
    { id: 'hum', name: 'Humanities',          budget: 200000, spent: 45000,  head: 'Dr. Elena Rossi' },
    { id: 'art', name: 'Arts & Design',       budget: 150000, spent: 20000,  head: 'M. Julian Chen' }
];

const INITIAL_REQUESTS = [
    { id: 1, deptId: 'sci', amount: 50000,  category: 'Lab Equipment',    description: 'Quantum Spectrometer repair',         status: 'approved', date: '2025-08-15' },
    { id: 2, deptId: 'eng', amount: 120000, category: 'Software',          description: 'CAD Licenses for FY26',               status: 'pending',  date: '2025-09-01' },
    { id: 3, deptId: 'hum', amount: 5000,   category: 'Travel',            description: 'Conference in Paris',                 status: 'rejected', date: '2025-07-20' },
    { id: 4, deptId: 'sci', amount: 75000,  category: 'Research Support',  description: 'AI Research Grant funding round',     status: 'pending',  date: '2025-09-10' },
    { id: 5, deptId: 'eng', amount: 30000,  category: 'Infrastructure',    description: 'Server rack expansion - Phase 2',     status: 'approved', date: '2025-08-28' },
    { id: 6, deptId: 'art', amount: 15000,  category: 'Office Supplies',   description: 'Studio equipment and materials',      status: 'approved', date: '2025-08-05' },
];

export class BudgetStore {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('budget_system_data_v2')) || {
            departments: INITIAL_DEPARTMENTS,
            requests: INITIAL_REQUESTS,
            currentUser: { role: 'dept', deptId: 'sci' }
        };
        this.save();
    }

    save() {
        localStorage.setItem('budget_system_data_v2', JSON.stringify(this.data));
        window.dispatchEvent(new CustomEvent('store-update'));
    }

    getFiscalYear() {
        const now = new Date();
        const year = now.getFullYear();
        return now.getMonth() >= 6
            ? `FY ${year}–${year + 1}`
            : `FY ${year - 1}–${year}`;
    }

    getDepartments() { return this.data.departments; }

    getRequests() {
        return [...this.data.requests].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    getDeptStats(deptId) {
        const dept = this.data.departments.find(d => d.id === deptId);
        const deptRequests = this.data.requests.filter(r => r.deptId === deptId);
        const pending = deptRequests
            .filter(r => r.status === 'pending')
            .reduce((sum, r) => sum + r.amount, 0);
        return { ...dept, pending };
    }

    getInsights(deptId) {
        const requests = this.data.requests.filter(r =>
            deptId ? r.deptId === deptId : true
        );
        const dept = deptId ? this.data.departments.find(d => d.id === deptId) : null;

        // Top category by total amount
        const catTotals = {};
        requests.filter(r => r.status === 'approved').forEach(r => {
            catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
        });
        const topCategory = Object.keys(catTotals).length
            ? Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0][0]
            : null;

        // Low budget warning
        let lowBudgetWarning = false;
        if (dept) {
            const remaining = dept.budget - dept.spent;
            lowBudgetWarning = (remaining / dept.budget) < 0.2;
        }

        // Latest request
        const sorted = [...requests].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestRequest = sorted[0] || null;

        return { topCategory, lowBudgetWarning, latestRequest };
    }

    addRequest(request) {
        const newRequest = {
            id: Date.now(),
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            ...request
        };
        this.data.requests.push(newRequest);
        this.save();
    }

    updateRequestStatus(requestId, status) {
        const request = this.data.requests.find(r => r.id === requestId);
        if (request) {
            if (status === 'approved' && request.status !== 'approved') {
                const dept = this.data.departments.find(d => d.id === request.deptId);
                if (dept) dept.spent += request.amount;
            }
            request.status = status;
            this.save();
        }
    }

    updateDeptBudget(deptId, newBudget) {
        const dept = this.data.departments.find(d => d.id === deptId);
        if (dept) {
            dept.budget = newBudget;
            this.save();
        }
    }

    switchUser(role, deptId = 'sci') {
        this.data.currentUser = { role, deptId };
        this.save();
    }

    getCurrentUser() { return this.data.currentUser; }
}

export const store = new BudgetStore();
