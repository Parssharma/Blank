/**
 * BudgetWise — Finance Officer Dashboard
 * Handles pending request review (forward / reject / revise),
 * expense trends chart, and department budget adjustments.
 */
import { financeApi, deptApi, getToken, getUser, isAuthenticated } from '../data/api.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export async function initFinanceDashboard() {
    /* ── Auth guard ── */
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }
    const user = getUser();
    if (user && user.role !== 'finance_officer') {
        window.location.href = '/';
        return;
    }

    await loadPendingRequests();
    await loadExpenseTrends();
    await setupBudgetForm();

    // Check for target department from search
    const targetDept = localStorage.getItem('bw_target_dept');
    if (targetDept) {
        const select = document.getElementById('dept-select');
        if (select) {
            select.value = targetDept;
            select.dispatchEvent(new Event('change'));
            localStorage.removeItem('bw_target_dept');
            // Scroll to form
            document.getElementById('budget-adjust')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

/* ── Auto-init if not imported as module ── */
if (window.location.pathname.includes('finance.html')) {
    initFinanceDashboard();
}

/* ── Toast helper ── */
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

/* ── Comment Prompt ── */
function promptComment(title, placeholder = 'Enter your comment...') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        overlay.innerHTML = `
            <div style="background:var(--surface, #1e1e2e);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;width:90%;max-width:440px;">
                <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;">${title}</h3>
                <textarea id="comment-input" rows="3" placeholder="${placeholder}" style="width:100%;border-radius:10px;padding:12px;background:rgba(255,255,255,0.05);color:var(--text, #fff);border:1px solid rgba(255,255,255,0.1);font-size:0.85rem;resize:vertical;"></textarea>
                <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
                    <button id="cancel-comment" style="padding:8px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--text-muted, #aaa);cursor:pointer;">Cancel</button>
                    <button id="submit-comment" style="padding:8px 18px;border-radius:8px;background:var(--color-primary, #7C3AED);color:#fff;border:none;cursor:pointer;font-weight:600;">Submit</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('cancel-comment').onclick = () => { overlay.remove(); resolve(null); };
        document.getElementById('submit-comment').onclick = () => { const val = document.getElementById('comment-input').value.trim(); overlay.remove(); resolve(val); };
    });
}

/* ── Pending Requests ── */
async function loadPendingRequests() {
    const listEl = document.getElementById('request-list');
    listEl.innerHTML = '<p style="opacity:.6">Loading…</p>';
    try {
        const res = await financeApi.getRequests();
        if (!res.success || res.data.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:32px;">
                <div style="font-size:2rem;margin-bottom:8px;">🎉</div>
                <p style="font-weight:600;font-size:0.95rem;margin-bottom:4px;">All caught up!</p>
                <p style="opacity:.6;font-size:0.85rem;">No pending requests to review.</p>
            </div>`;
            return;
        }
        listEl.innerHTML = '';
        res.data.forEach(req => {
            const card = document.createElement('div');
            card.className = 'request-card glass-panel';
            card.style.cssText = 'padding:18px;margin-bottom:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                    <div style="flex:1;min-width:200px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span style="font-weight:700;font-size:1.1rem;">₹${req.amount.toLocaleString('en-IN')}</span>
                            <span style="background:rgba(124,58,237,0.15);color:#A78BFA;padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:600;">${req.category}</span>
                        </div>
                        <p style="font-size:0.82rem;color:var(--text-muted, #aaa);margin-bottom:4px;">
                            ${req.department?.name || 'Unknown Dept'} · ${req.submittedBy?.name || 'Unknown'}
                        </p>
                        <p style="font-size:0.8rem;opacity:.5;line-height:1.4;">${req.description || ''}</p>
                    </div>
                    <div style="display:flex;gap:8px;flex-shrink:0;">
                        <button class="btn-primary forward-btn" data-id="${req._id}" style="white-space:nowrap;padding:7px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;background:var(--color-success, #10B981);border:none;color:#fff;">
                            ✓ Forward
                        </button>
                        <button class="reject-btn" data-id="${req._id}" style="white-space:nowrap;padding:7px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;background:var(--color-danger, #EF4444);border:none;color:#fff;">
                            ✕ Reject
                        </button>
                        <button class="revise-btn" data-id="${req._id}" style="white-space:nowrap;padding:7px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;background:var(--color-warning, #F59E0B);border:none;color:#111;">
                            ✎ Revise
                        </button>
                    </div>
                </div>
            `;
            listEl.appendChild(card);
        });

        /* Attach forward handlers */
        document.querySelectorAll('.forward-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                btn.disabled = true;
                btn.textContent = 'Forwarding…';
                try {
                    await financeApi.forwardRequest(id);
                    showToast('Request forwarded to admin!');
                    loadPendingRequests();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '✓ Forward';
                }
            });
        });

        /* Attach reject handlers */
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const comment = await promptComment('Reject Request', 'Reason for rejection (optional)...');
                if (comment === null) return; // cancelled
                btn.disabled = true;
                btn.textContent = 'Rejecting…';
                try {
                    await financeApi.rejectRequest(id, comment);
                    showToast('Request rejected');
                    loadPendingRequests();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '✕ Reject';
                }
            });
        });

        /* Attach revise handlers */
        document.querySelectorAll('.revise-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const comment = await promptComment('Request Revision', 'Describe the changes needed (required)...');
                if (!comment) { showToast('Comment is required for revision requests', 'error'); return; }
                btn.disabled = true;
                btn.textContent = 'Sending…';
                try {
                    await financeApi.requestRevision(id, comment);
                    showToast('Revision requested');
                    loadPendingRequests();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '✎ Revise';
                }
            });
        });
    } catch (err) {
        listEl.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    }
}

/* ── Expense Trends Chart ── */
async function loadExpenseTrends() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;

    try {
        const res = await financeApi.getExpenseTrends();
        if (!res.success || !res.data || res.data.length === 0) {
            canvas.style.display = 'none';
            const existingMsg = canvas.parentElement.querySelector('.empty-trend-msg');
            if (existingMsg) existingMsg.remove();
            
            const msg = document.createElement('div');
            msg.className = 'empty-trend-msg';
            msg.style.cssText = 'padding:60px 20px; text-align:center; background:var(--card-bg); border-radius:12px; border:1px dashed var(--card-border); color:var(--text-muted); margin-bottom:20px;';
            msg.innerHTML = `
                <i data-lucide="bar-chart-3" style="width:32px;height:32px;margin-bottom:12px;opacity:0.5;"></i>
                <p>No historical trend data available for the last 12 months.</p>
            `;
            canvas.after(msg);
            if (window.lucide) lucide.createIcons();
            return;
        }
        canvas.style.display = 'block';
        const existingMsg = canvas.parentElement.querySelector('.empty-trend-msg');
        if (existingMsg) existingMsg.remove();
        
        const labels = res.data.map(d => d.period);
        const totals = res.data.map(d => d.total);

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
        const labelColor = isDark ? '#aaa' : '#555';

        new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Approved Expenses (₹)',
                    data: totals,
                    borderColor: '#7C3AED',
                    backgroundColor: 'rgba(124,58,237,0.12)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#7C3AED'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: labelColor } } },
                scales: {
                    x: { ticks: { color: labelColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: labelColor }, grid: { color: gridColor } }
                }
            }
        });
    } catch (err) {
        console.warn('Expense trends unavailable:', err.message);
    }
}

/* ── Budget Adjustment Form ── */
function createCategoryRow(name = '', limit = '') {
    const row = document.createElement('div');
    row.className = 'category-row';
    row.style.cssText = 'display:flex;gap:12px;align-items:center;animation:fadeSlideIn 0.3s ease;';
    row.innerHTML = `
        <div style="flex:1;position:relative;">
            <input type="text" name="cat_name" value="${name}" placeholder="Category (e.g. Software)" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:0.9rem;transition:all 0.2s ease;" />
        </div>
        <div style="width:140px;position:relative;">
            <input type="number" name="cat_limit" value="${limit}" placeholder="Limit (₹)" min="0" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:0.9rem;transition:all 0.2s ease;" />
        </div>
        <button type="button" class="remove-cat btn-ghost" style="padding:8px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;color:var(--color-danger);">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
        </button>
    `;
    row.querySelector('.remove-cat').onclick = () => {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(() => row.remove(), 200);
    };
    if (window.lucide) lucide.createIcons();
    return row;
}

async function setupBudgetForm() {
    const form = document.getElementById('budget-form');
    const catContainer = document.getElementById('category-limits-container');
    const addBtn = document.getElementById('add-category-btn');
    const select = document.getElementById('dept-select');

    if (addBtn) addBtn.onclick = () => catContainer.appendChild(createCategoryRow());

    try {
        const res = await deptApi.getAll();
        const depts = res.data || res;
        
        if (select) {
            select.innerHTML = '<option value="">Select department</option>';
            depts.forEach(dept => {
                select.innerHTML += `<option value="${dept._id}">${dept.name}</option>`;
            });

            // Pre-fill on change
            select.onchange = async () => {
                const id = select.value;
                if (!id) {
                    form.querySelector('[name="budget"]').value = '';
                    catContainer.innerHTML = '';
                    return;
                }
                try {
                    const dRes = await deptApi.getById(id);
                    const dept = dRes.data || dRes;
                    form.querySelector('[name="budget"]').value = dept.budget || 0;
                    catContainer.innerHTML = '';
                    if (dept.categoryLimits && dept.categoryLimits.length > 0) {
                        dept.categoryLimits.forEach(cl => {
                            catContainer.appendChild(createCategoryRow(cl.category, cl.limit));
                        });
                    }
                } catch (err) {
                    console.error('Failed to fetch dept details', err);
                    showToast('Could not load department limits', 'error');
                }
            };
        }
    } catch (err) {
        console.error('Failed to load departments', err);
        if (select) select.innerHTML = '<option value="">Error loading departments</option>';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const deptId = fd.get('deptId');
        const budget = Number(fd.get('budget'));
        if (!deptId || isNaN(budget)) return showToast('Select a department and enter budget', 'error');

        const categoryLimits = [];
        const rows = catContainer.querySelectorAll('.category-row');
        rows.forEach(row => {
            const name = row.querySelector('[name="cat_name"]').value.trim();
            const limit = Number(row.querySelector('[name="cat_limit"]').value);
            if (name && !isNaN(limit)) {
                categoryLimits.push({ category: name, limit });
            }
        });

        try {
            await financeApi.adjustBudget(deptId, { budget, categoryLimits });
            showToast(`Budget updated to ₹${budget.toLocaleString('en-IN')} with limits`);
            form.reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

