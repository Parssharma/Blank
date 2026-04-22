import { authApi, deptApi, requestApi, isAuthenticated, getUser, setUser, getFiscalYear } from './src/data/api.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

/* ============================================================
   UTILITIES
   ============================================================ */

function formatINR(n) {
    if (typeof n !== 'number' || isNaN(n)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function progressClass(pct) {
    if (pct >= 80) return 'high';
    if (pct >= 60) return 'mid';
    return 'low';
}

function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div style="flex:1;">
            <p style="font-weight:600;font-size:0.85rem;margin-bottom:2px;">${type.charAt(0).toUpperCase() + type.slice(1)}</p>
            <p style="font-size:0.8rem;color:var(--text-sub);">${message}</p>
        </div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3500);
}

function destroyChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
}

/* ============================================================
   APP CLASS
   ============================================================ */
class App {
    constructor() {
        this.content     = document.getElementById('main-content');
        this.fiscalLabel = document.getElementById('fiscal-year-label');
        this.titleEl     = document.getElementById('current-title');
        this.nav         = document.getElementById('sidebar-nav');
        this.sidebar     = document.getElementById('sidebar');
        this.mainWrapper = document.getElementById('main-wrapper');
        this.appHeader   = document.getElementById('app-header');

        this.user        = null;
        this.currentNav  = 'dash';
        this.sidebarOpen = window.innerWidth > 768;
        
        if (!this.sidebarOpen) {
            this.sidebar?.classList.add('collapsed');
            this.mainWrapper?.classList.add('sidebar-collapsed');
            this.appHeader?.classList.add('sidebar-collapsed');
        }

        // Table state
        this.tableFilter  = 'all';
        this.tableSearch  = '';
        this.tableSortKey = 'date';
        this.tableSortAsc = false;
        this.deptSearch   = '';

        this.init();
    }

    async init() {
        /* ── Auth guard ── */
        if (!isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        /* ── Load user (cache first, then API) ── */
        this.user = getUser();
        if (!this.user) {
            try {
                const res = await authApi.getMe();
                this.user = res.data;
                setUser(this.user);
            } catch {
                window.location.href = '/login.html';
                return;
            }
        }

        /* ── Static UI ── */
        if (this.fiscalLabel) this.fiscalLabel.textContent = getFiscalYear();

        /* ── Sidebar toggle ── */
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());

        /* ── Profile dropdown ── */
        document.getElementById('profile-trigger')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfileDropdown();
        });
        document.addEventListener('click', () => this.closeProfileDropdown());

        /* ── Window Resize Listener ── */
        window.addEventListener('resize', () => {
            const isDesktop = window.innerWidth > 768;
            if (this.sidebarOpen !== isDesktop) {
                this.sidebarOpen = isDesktop;
                this.sidebar?.classList.toggle('collapsed', !this.sidebarOpen);
                this.mainWrapper?.classList.toggle('sidebar-collapsed', !this.sidebarOpen);
                this.appHeader?.classList.toggle('sidebar-collapsed', !this.sidebarOpen);
                const icon = document.querySelector('#sidebar-toggle i');
                if (icon) {
                    icon.setAttribute('data-lucide', this.sidebarOpen ? 'panel-left-close' : 'panel-left-open');
                    if (window.lucide) lucide.createIcons();
                }
            }
        });

        /* ── Dropdown actions ── */
        document.getElementById('dd-settings')?.addEventListener('click', () => {
            this.currentNav = 'settings';
            this.render();
            this.closeProfileDropdown();
        });
        document.getElementById('dd-logout')?.addEventListener('click', () => {
            authApi.logout();
        });

        await this.render();
    }

    /* ----------------------------------------------------------
       SIDEBAR COLLAPSE
    ---------------------------------------------------------- */
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        this.sidebar.classList.toggle('collapsed', !this.sidebarOpen);
        this.mainWrapper.classList.toggle('sidebar-collapsed', !this.sidebarOpen);
        this.appHeader.classList.toggle('sidebar-collapsed', !this.sidebarOpen);
        const icon = document.querySelector('#sidebar-toggle i');
        if (icon) {
            icon.setAttribute('data-lucide', this.sidebarOpen ? 'panel-left-close' : 'panel-left-open');
            lucide.createIcons();
        }
    }

    toggleProfileDropdown() {
        const dd      = document.getElementById('profile-dropdown');
        const chevron = document.getElementById('profile-chevron');
        const isOpen  = dd?.classList.toggle('open');
        if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
    }

    closeProfileDropdown() {
        document.getElementById('profile-dropdown')?.classList.remove('open');
        const chevron = document.getElementById('profile-chevron');
        if (chevron) chevron.style.transform = '';
    }

    /* ----------------------------------------------------------
       MAIN RENDER (async)
    ---------------------------------------------------------- */
    async render() {
        if (!this.user) return;

        /* Update header profile */
        const el = (id) => document.getElementById(id);
        if (el('user-name')) el('user-name').textContent = this.user.name;
        if (el('user-role')) el('user-role').textContent =
            this.user.role === 'admin' ? 'Finance Registry' : `Dept Head — ${this.user.department?.name || ''}`;
        if (el('dd-user-name')) el('dd-user-name').textContent = this.user.name;
        if (el('dd-user-role')) el('dd-user-role').textContent =
            this.user.role === 'admin' ? 'Administrator' : this.user.department?.name || '';

        /* Update avatar */
        const avatarImg = document.querySelector('.avatar-ring img');
        if (avatarImg) avatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.user.avatar || this.user.name}`;

        this.renderSidebarNav();

        /* Route */
        try {
            if (this.user.role === 'admin') {
                switch (this.currentNav) {
                    case 'dash':     await this.renderAdminDashboard(); break;
                    case 'queue':    await this.renderAdminQueue();     break;
                    case 'depts':    await this.renderAdminDepts();     break;
                    case 'reports':  await this.renderAdminReports();   break;
                    case 'settings': this.renderSettings();            break;
                    default:         await this.renderAdminDashboard();
                }
            } else {
                switch (this.currentNav) {
                    case 'dash':     await this.renderDeptDashboard(); break;
                    case 'requests': await this.renderDeptRequests();  break;
                    case 'reports':  await this.renderDeptReports();   break;
                    case 'settings': this.renderSettings();           break;
                    default:         await this.renderDeptDashboard();
                }
            }
        } catch (err) {
            console.error('Render error:', err);
            this.content.innerHTML = `<div class="glass-panel" style="padding:40px;text-align:center;">
                <p style="color:var(--color-danger);font-size:1rem;">⚠️ ${err.message}</p>
                <p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem;">Make sure the backend server is running on port 5000.</p>
            </div>`;
        }
        lucide.createIcons();
    }

    /* ----------------------------------------------------------
       SIDEBAR NAV
    ---------------------------------------------------------- */
    getNavItems() {
        return this.user.role === 'admin'
            ? [
                { id: 'dash',     label: 'Overview',       icon: 'layout-grid'     },
                { id: 'queue',    label: 'Approval Queue', icon: 'clipboard-check'  },
                { id: 'depts',    label: 'Departments',    icon: 'building-2'       },
                { id: 'reports',  label: 'Reports',        icon: 'bar-chart-3'      },
                { id: 'settings', label: 'Settings',       icon: 'settings'         }
              ]
            : [
                { id: 'dash',     label: 'Overview',       icon: 'layout-grid' },
                { id: 'requests', label: 'My Requests',    icon: 'file-text'   },
                { id: 'reports',  label: 'Reports',        icon: 'bar-chart-3' },
                { id: 'settings', label: 'Settings',       icon: 'settings'    }
              ];
    }

    renderSidebarNav() {
        const items = this.getNavItems();
        this.nav.innerHTML = items.map(item => `
            <a href="#" class="nav-item ${item.id === this.currentNav ? 'active' : ''}" data-nav-id="${item.id}">
                <i data-lucide="${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        `).join('') + `
            <div class="sidebar-budget-health">
                <p style="font-size:0.68rem;color:var(--text-muted);margin-bottom:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">Connected</p>
                <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;">
                    <span style="width:7px;height:7px;border-radius:50%;background:var(--color-success);display:inline-block;"></span>
                    <span style="color:var(--text-muted);">API online · MongoDB</span>
                </div>
            </div>`;

        this.nav.querySelectorAll('.nav-item').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                this.currentNav = e.currentTarget.dataset.navId;
                this.tableFilter = 'all';
                this.tableSearch = '';
                this.render();
            };
        });
    }

    /* ----------------------------------------------------------
       SKELETON
    ---------------------------------------------------------- */
    renderSkeleton() {
        this.content.innerHTML = `
            <div class="dashboard-grid">
                ${[1,2,3,4].map(() => `<div class="glass-panel skeleton-card skeleton"></div>`).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;">
                ${[1,2,3,4].map((_, i) => `<div class="skeleton skeleton-row ${['long','medium','short','long'][i]}"></div>`).join('')}
            </div>`;
    }

    /* ----------------------------------------------------------
       DEPT DASHBOARD
    ---------------------------------------------------------- */
    async renderDeptDashboard() {
        this.titleEl.textContent = 'Department Overview';
        this.renderSkeleton();

        const deptId  = this.user.department?._id;
        if (!deptId) {
            this.content.innerHTML = `<div class="glass-panel" style="padding:40px;text-align:center;"><p style="color:var(--text-muted);">No department assigned to your account. Contact an administrator.</p></div>`;
            return;
        }

        /* Parallel fetch */
        const [statsRes, reqsRes, insightsRes] = await Promise.all([
            deptApi.getStats(deptId),
            requestApi.getAll({ department: deptId }),
            requestApi.getInsights(deptId)
        ]);

        const stats    = statsRes.data;
        const requests = reqsRes.data;
        const insights = insightsRes.data;
        const usedPct  = stats.utilizationPct ?? 0;
        const remPct   = 100 - usedPct;

        this.content.innerHTML = `
            <div class="dashboard-grid">
                <div class="glass-panel stat-card primary">
                    <div class="stat-icon" style="background:rgba(124,58,237,0.15);">
                        <i data-lucide="wallet" style="width:18px;height:18px;color:var(--color-primary-light);"></i>
                    </div>
                    <span class="stat-label">Total Allocated</span>
                    <span class="stat-value">${formatINR(stats.budget)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill" style="width:100%;background:linear-gradient(to right,var(--color-primary),var(--color-primary-light));"></div></div>
                    <span class="stat-sub">Current fiscal year budget</span>
                </div>
                <div class="glass-panel stat-card secondary">
                    <div class="stat-icon" style="background:var(--color-success-bg);">
                        <i data-lucide="trending-up" style="width:18px;height:18px;color:var(--color-success);"></i>
                    </div>
                    <span class="stat-label">Total Spent</span>
                    <span class="stat-value text-success">${formatINR(stats.spent)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill ${progressClass(usedPct)}" style="width:${usedPct}%;"></div></div>
                    <span class="stat-sub">${usedPct}% of budget used</span>
                </div>
                <div class="glass-panel stat-card secondary">
                    <div class="stat-icon" style="background:var(--color-warning-bg);">
                        <i data-lucide="clock" style="width:18px;height:18px;color:var(--color-warning);"></i>
                    </div>
                    <span class="stat-label">Pending Requests</span>
                    <span class="stat-value text-warning">${formatINR(stats.pending)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill mid" style="width:${Math.min(Math.round((stats.pending/stats.budget)*100),100)}%;"></div></div>
                    <span class="stat-sub">Awaiting admin approval</span>
                </div>
                <div class="glass-panel stat-card secondary">
                    <div class="stat-icon" style="background:rgba(59,130,246,0.1);">
                        <i data-lucide="piggy-bank" style="width:18px;height:18px;color:var(--color-info);"></i>
                    </div>
                    <span class="stat-label">Remaining</span>
                    <span class="stat-value text-primary">${formatINR(stats.remaining)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill low" style="width:${remPct}%;"></div></div>
                    <span class="stat-sub">${remPct}% of budget remaining</span>
                </div>
            </div>

            ${this.renderInsightsBar(insights)}

            <div class="content-grid">
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.5s ease 0.25s both;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h3 style="font-weight:700;font-size:1rem;">Expenditure History</h3>
                        <button class="btn btn-primary btn-sm" id="open-request-modal">
                            <i data-lucide="plus" style="width:14px;height:14px;"></i>New Request
                        </button>
                    </div>
                    ${this.renderTableControls('dept-table')}
                    <div id="dept-table-wrapper">${this.renderRequestsTable(requests, 'dept-table')}</div>
                </div>
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.5s ease 0.3s both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Budget Utilization</h3>
                    <div class="chart-wrapper" style="position:relative;">
                        <canvas id="utilization-chart"></canvas>
                        <div class="chart-center-label">
                            <span class="center-value">${usedPct}%</span>
                            <div class="center-sub">spent</div>
                        </div>
                    </div>
                </div>
            </div>`;

        this.attachTableControls(requests, 'dept-table', 'dept-table-wrapper');
        this.renderUtilizationChart(stats, 'utilization-chart');
        document.getElementById('open-request-modal').onclick = () => this.showRequestModal();
    }

    /* ----------------------------------------------------------
       ADMIN DASHBOARD
    ---------------------------------------------------------- */
    async renderAdminDashboard() {
        this.titleEl.textContent = 'Institutional Overview';
        this.renderSkeleton();

        const [deptsRes, pendingRes, insightsRes] = await Promise.all([
            deptApi.getAll(),
            requestApi.getPending(),
            requestApi.getInsights()
        ]);

        const depts    = deptsRes.data;
        const pending  = pendingRes.data;
        const insights = insightsRes.data;
        const totalBudget = depts.reduce((s, d) => s + d.budget, 0);
        const totalSpent  = depts.reduce((s, d) => s + d.spent,  0);
        const burnPct     = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

        this.content.innerHTML = `
            <div class="dashboard-grid">
                <div class="glass-panel stat-card primary">
                    <div class="stat-icon" style="background:rgba(124,58,237,0.15);">
                        <i data-lucide="university" style="width:18px;height:18px;color:var(--color-primary-light);"></i>
                    </div>
                    <span class="stat-label">Total Budget</span>
                    <span class="stat-value">${formatINR(totalBudget)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill" style="width:100%;background:linear-gradient(to right,var(--color-primary),var(--color-primary-light));"></div></div>
                    <span class="stat-sub">Across ${depts.length} departments</span>
                </div>
                <div class="glass-panel stat-card secondary">
                    <div class="stat-icon" style="background:var(--color-danger-bg);">
                        <i data-lucide="credit-card" style="width:18px;height:18px;color:var(--color-danger);"></i>
                    </div>
                    <span class="stat-label">Total Expenditure</span>
                    <span class="stat-value text-danger">${formatINR(totalSpent)}</span>
                    <div class="stat-progress"><div class="stat-progress-fill ${progressClass(burnPct)}" style="width:${burnPct}%;"></div></div>
                    <span class="stat-sub">${burnPct}% institutional burn rate</span>
                </div>
                <div class="glass-panel stat-card secondary">
                    <div class="stat-icon" style="background:var(--color-warning-bg);">
                        <i data-lucide="inbox" style="width:18px;height:18px;color:var(--color-warning);"></i>
                    </div>
                    <span class="stat-label">Pending Approvals</span>
                    <span class="stat-value text-warning">${pending.length}</span>
                    <div class="stat-progress"><div class="stat-progress-fill mid" style="width:${Math.min(pending.length*10,100)}%;"></div></div>
                    <span class="stat-sub">Requests awaiting review</span>
                </div>
            </div>

            ${this.renderInsightsBar(insights)}

            <div class="content-grid">
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.5s ease 0.25s both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Pending Approvals</h3>
                    ${pending.length === 0
                        ? `<div class="empty-state"><div class="empty-icon">🎉</div><p style="font-size:1rem;font-weight:600;margin-bottom:6px;">All caught up!</p><p>No pending requests found.</p></div>`
                        : `<div style="display:flex;flex-direction:column;gap:14px;">
                            ${pending.map(r => `
                                <div class="glass-panel queue-card">
                                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                                        <div>
                                            <p style="font-weight:700;font-size:1.15rem;">${formatINR(r.amount)}</p>
                                            <p style="font-size:0.8rem;color:var(--color-info);margin-top:3px;">${r.department?.name || 'Unknown'} &bull; ${r.category}</p>
                                        </div>
                                        <div style="display:flex;gap:8px;">
                                            <button class="btn btn-success btn-sm approve-btn" data-id="${r._id}">
                                                <i data-lucide="check" style="width:13px;height:13px;"></i>Approve
                                            </button>
                                            <button class="btn btn-danger btn-sm reject-btn" data-id="${r._id}">
                                                <i data-lucide="x" style="width:13px;height:13px;"></i>Reject
                                            </button>
                                        </div>
                                    </div>
                                    <p style="font-size:0.83rem;color:var(--text-muted);line-height:1.5;">${r.description}</p>
                                    <p style="font-size:0.72rem;color:var(--text-dim);margin-top:8px;">Submitted by ${r.submittedBy?.name || '—'} on ${new Date(r.date).toLocaleDateString('en-IN')}</p>
                                </div>`).join('')}
                           </div>`
                    }
                </div>
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.5s ease 0.3s both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Allocations by Department</h3>
                    <canvas id="allocation-chart"></canvas>
                </div>
            </div>`;

        this.renderAllocationChart(depts, 'allocation-chart');
        this.attachAdminActions();
    }

    /* ----------------------------------------------------------
       ADMIN QUEUE
    ---------------------------------------------------------- */
    async renderAdminQueue() {
        this.titleEl.textContent = 'Approval Queue';
        this.renderSkeleton();

        const res      = await requestApi.getPending();
        const requests = res.data;

        this.content.innerHTML = `
            <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease both;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <h3 style="font-weight:700;font-size:1rem;">Pending Submissions</h3>
                    <span style="font-size:0.8rem;color:var(--text-muted);">${requests.length} item${requests.length !== 1 ? 's' : ''} waiting</span>
                </div>
                ${requests.length === 0
                    ? `<div class="empty-state"><div class="empty-icon">✨</div><p style="font-size:1rem;font-weight:600;margin-bottom:6px;">Queue is clear!</p><p>No pending requests at this time.</p></div>`
                    : `<div style="display:flex;flex-direction:column;gap:16px;">
                        ${requests.map(r => `
                            <div class="glass-panel queue-card">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                                    <div>
                                        <p style="font-weight:700;font-size:1.2rem;margin-bottom:4px;">${formatINR(r.amount)}</p>
                                        <p style="font-size:0.82rem;color:var(--color-info);">${r.department?.name} &bull; <span class="badge badge-pending">${r.category}</span></p>
                                    </div>
                                    <div style="display:flex;gap:10px;">
                                        <button class="btn btn-success approve-btn" data-id="${r._id}">
                                            <i data-lucide="check-circle" style="width:14px;height:14px;"></i>Approve
                                        </button>
                                        <button class="btn btn-danger reject-btn" data-id="${r._id}">
                                            <i data-lucide="x-circle" style="width:14px;height:14px;"></i>Reject
                                        </button>
                                    </div>
                                </div>
                                <p style="margin-top:14px;color:var(--text-muted);font-size:0.85rem;line-height:1.6;">${r.description}</p>
                                <p style="font-size:0.72rem;color:var(--text-dim);margin-top:10px;">
                                    Submitted by <strong>${r.submittedBy?.name || '—'}</strong> on ${new Date(r.date).toLocaleDateString('en-IN')}
                                </p>
                            </div>`).join('')}
                       </div>`
                }
            </div>`;

        this.attachAdminActions();
    }

    attachAdminActions() {
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.currentTarget.dataset.id;
                try {
                    await requestApi.updateStatus(id, 'approved');
                    showToast('Request approved successfully', 'success');
                    await this.render();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        });
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.currentTarget.dataset.id;
                try {
                    await requestApi.updateStatus(id, 'rejected');
                    showToast('Request rejected', 'error');
                    await this.render();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        });
    }

    /* ----------------------------------------------------------
       ADMIN DEPTS
    ---------------------------------------------------------- */
    async renderAdminDepts() {
        this.titleEl.textContent = 'Department Management';
        this.renderSkeleton();

        const res   = await deptApi.getAll();
        const depts = res.data;

        this.content.innerHTML = `
            <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease both;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <h3 style="font-weight:700;font-size:1rem;">Institutional Departments</h3>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <div class="search-box" style="margin: 0;">
                            <i data-lucide="search" style="width:15px;height:15px;color:var(--text-muted);flex-shrink:0;"></i>
                            <input type="text" id="dept-search-input" placeholder="Search head or dept..." value="${this.deptSearch || ''}" />
                        </div>
                        <button class="btn btn-primary btn-sm" id="create-dept-btn">
                            <i data-lucide="plus" style="width:14px;height:14px;"></i>New Department
                        </button>
                    </div>
                </div>
                <div id="depts-grid-wrapper">
                    ${this.renderDeptsGrid(depts)}
                </div>
            </div>`;

        this.attachDeptActions(depts);
    }

    renderDeptsGrid(depts) {
        let filtered = depts;
        if (this.deptSearch) {
            const q = this.deptSearch.toLowerCase();
            filtered = depts.filter(d => d.name.toLowerCase().includes(q) || d.head.toLowerCase().includes(q));
        }

        if (filtered.length === 0) {
            return `
                <div class="empty-state" style="padding: 40px 0;">
                    <div class="empty-icon">🔍</div>
                    <p style="font-size:0.95rem;font-weight:600;margin-bottom:6px;">No departments found</p>
                    <p>Try adjusting your search criteria.</p>
                </div>`;
        }

        return `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
                ${filtered.map((d, i) => {
                    const pct = d.utilizationPct ?? Math.round((d.spent / d.budget) * 100);
                    const rem = d.remaining ?? (d.budget - d.spent);
                    const fc  = progressClass(pct);
                    return `
                        <div class="glass-panel dept-card" style="padding:26px;animation-delay:${i*0.07}s;">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                                <h4 style="font-weight:700;font-size:0.95rem;">${d.name}</h4>
                                <span class="badge" style="background:rgba(124,58,237,0.1);color:var(--color-primary-light);border:1px solid var(--color-primary-border);">Active</span>
                            </div>
                            <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">
                                <i data-lucide="user" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>${d.head}
                            </p>
                            <p style="font-size:1.5rem;font-weight:800;margin:10px 0 2px;">${formatINR(d.budget)}</p>
                            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px;">Annual Budget Limit</p>
                            <div class="progress-bar-track">
                                <div class="progress-bar-fill ${fc}" style="width:${pct}%;"></div>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-top:6px;margin-bottom:18px;">
                                <span class="${fc==='high'?'text-danger':fc==='mid'?'text-warning':'text-success'}">${pct}% used</span>
                                <span style="color:var(--text-muted);">${formatINR(rem)} remaining</span>
                            </div>
                            <div style="display:flex;gap:8px;">
                                <button class="btn btn-ghost edit-dept-btn" data-id="${d._id}" style="flex:1;font-size:0.82rem;">
                                    <i data-lucide="sliders-horizontal" style="width:13px;height:13px;"></i>Adjust Budget
                                </button>
                                <button class="btn btn-danger btn-sm delete-dept-btn" data-id="${d._id}" data-name="${d.name}" style="padding:8px 12px;">
                                    <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    }

    attachDeptActions(depts) {
        document.querySelector('#create-dept-btn')?.addEventListener('click', () => this.showCreateDeptModal());
        
        const searchInput = document.getElementById('dept-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.deptSearch = e.target.value;
                document.getElementById('depts-grid-wrapper').innerHTML = this.renderDeptsGrid(depts);
                this.attachDeptCardButtons();
                lucide.createIcons();
            };
        }
        
        this.attachDeptCardButtons();
    }

    attachDeptCardButtons() {
        document.querySelectorAll('.edit-dept-btn').forEach(btn => {
            btn.onclick = (e) => this.showAdjustBudgetModal(e.currentTarget.dataset.id);
        });
        document.querySelectorAll('.delete-dept-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const id   = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                if (!confirm(`Delete "${name}" and all its requests? This cannot be undone.`)) return;
                try {
                    await deptApi.delete(id);
                    showToast(`Department "${name}" deleted`, 'warning');
                    await this.render();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        });
    }

    /* ----------------------------------------------------------
       DEPT REQUESTS PAGE
    ---------------------------------------------------------- */
    async renderDeptRequests() {
        this.titleEl.textContent = 'Budget Request History';
        this.renderSkeleton();

        const deptId = this.user.department?._id;
        const res    = await requestApi.getAll(deptId ? { department: deptId } : {});
        const requests = res.data;

        this.content.innerHTML = `
            <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease both;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="font-weight:700;font-size:1rem;">All Submissions</h3>
                    <button class="btn btn-primary" id="open-request-modal">
                        <i data-lucide="plus" style="width:14px;height:14px;"></i>New Submission
                    </button>
                </div>
                ${this.renderTableControls('req-table')}
                <div id="req-table-wrapper">${this.renderRequestsTable(requests, 'req-table')}</div>
            </div>`;

        this.attachTableControls(requests, 'req-table', 'req-table-wrapper');
        document.getElementById('open-request-modal').onclick = () => this.showRequestModal();
    }

    /* ----------------------------------------------------------
       REPORTS
    ---------------------------------------------------------- */
    async renderAdminReports() {
        this.titleEl.textContent = 'Financial Analytics';
        this.renderSkeleton();

        const res   = await deptApi.getAll();
        const depts = res.data;

        this.content.innerHTML = `
            <div class="content-grid">
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Budget Distribution</h3>
                    <canvas id="large-allocation-chart"></canvas>
                </div>
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease 0.1s both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Department Breakdown</h3>
                    <div style="display:flex;flex-direction:column;gap:16px;">
                        ${depts.map(d => {
                            const pct = d.utilizationPct ?? Math.round((d.spent/d.budget)*100);
                            const fc  = progressClass(pct);
                            return `<div class="glass-panel" style="padding:16px;">
                                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                                    <p style="font-weight:600;font-size:0.88rem;">${d.name}</p>
                                    <span class="${fc==='high'?'text-danger':fc==='mid'?'text-warning':'text-success'}" style="font-size:0.8rem;font-weight:700;">${pct}%</span>
                                </div>
                                <div class="progress-bar-track">
                                    <div class="progress-bar-fill ${fc}" style="width:${pct}%;"></div>
                                </div>
                                <p style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">${formatINR(d.spent)} of ${formatINR(d.budget)}</p>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;

        this.renderAllocationChart(depts, 'large-allocation-chart');
    }

    async renderDeptReports() {
        this.titleEl.textContent = 'Spending Analytics';
        this.renderSkeleton();

        const deptId = this.user.department?._id;
        const res    = await deptApi.getStats(deptId);
        const stats  = res.data;
        const usedPct = stats.utilizationPct ?? 0;

        this.content.innerHTML = `
            <div class="content-grid">
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:20px;">Strategic Allocation</h3>
                    <div class="chart-wrapper" style="position:relative;">
                        <canvas id="dept-utilization-chart"></canvas>
                        <div class="chart-center-label">
                            <span class="center-value">${usedPct}%</span>
                            <div class="center-sub">spent</div>
                        </div>
                    </div>
                </div>
                <div class="glass-panel" style="padding:28px;animation:fadeSlideUp 0.4s ease 0.1s both;">
                    <h3 style="font-weight:700;font-size:1rem;margin-bottom:18px;">FY Cycle Summary</h3>
                    <div class="glass-panel" style="padding:18px;margin-bottom:16px;">
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">Projected Remaining</p>
                        <p style="font-size:1.4rem;font-weight:800;">${formatINR(stats.remaining)}</p>
                    </div>
                    <div class="glass-panel" style="padding:18px;margin-bottom:16px;">
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">Total Allocated</p>
                        <p style="font-size:1.4rem;font-weight:800;">${formatINR(stats.budget)}</p>
                    </div>
                    <p style="font-size:0.83rem;color:var(--text-muted);line-height:1.7;">
                        Your department has consumed <strong style="color:var(--text-main);">${usedPct}%</strong> of the allocated budget this fiscal year.
                        Ensure high-priority requests are submitted before Q4.
                    </p>
                </div>
            </div>`;

        this.renderUtilizationChart(stats, 'dept-utilization-chart');
    }

    /* ----------------------------------------------------------
       SETTINGS
    ---------------------------------------------------------- */
    renderSettings() {
        this.titleEl.textContent = 'System Preferences';
        this.content.innerHTML = `
            <div class="glass-panel" style="padding:36px;max-width:540px;animation:fadeSlideUp 0.4s ease both;">
                <h3 style="font-weight:700;margin-bottom:28px;font-size:1rem;">User & System Configuration</h3>
                <div style="display:flex;flex-direction:column;gap:20px;">
                    <div class="form-group">
                        <label class="form-label">Logged in as</label>
                        <div style="padding:12px 16px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-md);font-size:0.9rem;">
                            <strong>${this.user.name}</strong> &nbsp;·&nbsp;
                            <span style="color:var(--text-muted);">${this.user.email}</span> &nbsp;·&nbsp;
                            <span class="badge ${this.user.role === 'admin' ? '' : 'badge-approved'}" style="${this.user.role === 'admin' ? 'background:rgba(124,58,237,0.1);color:var(--color-primary-light);border:1px solid var(--color-primary-border);' : ''}">${this.user.role}</span>
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 0;border-top:1px solid var(--card-border);">
                        <div>
                            <p style="font-weight:600;">Email Notifications</p>
                            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">Daily summary of budget status</p>
                        </div>
                        <input type="checkbox" checked style="width:40px;height:20px;accent-color:var(--color-primary);cursor:pointer;">
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 0;border-top:1px solid var(--card-border);">
                        <div>
                            <p style="font-weight:600;">Budget Alerts</p>
                            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">Notify when budget exceeds 80%</p>
                        </div>
                        <input type="checkbox" checked style="width:40px;height:20px;accent-color:var(--color-primary);cursor:pointer;">
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:28px;">
                    <button class="btn btn-primary" style="flex:1;" id="save-settings-btn">
                        <i data-lucide="save" style="width:14px;height:14px;"></i>Save Changes
                    </button>
                    <button class="btn btn-danger" style="flex:1;" id="logout-settings-btn">
                        <i data-lucide="log-out" style="width:14px;height:14px;"></i>Logout
                    </button>
                </div>
            </div>`;

        document.getElementById('save-settings-btn').onclick = () => showToast('Settings saved', 'success');
        document.getElementById('logout-settings-btn').onclick = () => authApi.logout();
    }

    /* ----------------------------------------------------------
       TABLE HELPERS
    ---------------------------------------------------------- */
    renderTableControls(tableId) {
        return `
            <div class="table-controls">
                <div class="search-box">
                    <i data-lucide="search" style="width:15px;height:15px;color:var(--text-muted);flex-shrink:0;"></i>
                    <input type="text" id="${tableId}-search" placeholder="Search category, description…" value="${this.tableSearch}" />
                </div>
                <div class="filter-tabs">
                    ${['all','approved','pending','rejected'].map(f => `
                        <button class="filter-tab ${this.tableFilter === f ? (f==='all'?'active':`active-${f}`) : ''}" data-filter="${f}" id="${tableId}-filter-${f}">
                            ${f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
                        </button>`).join('')}
                </div>
            </div>`;
    }

    renderRequestsTable(requests, tableId) {
        let filtered = requests.filter(r => {
            if (this.tableFilter !== 'all' && r.status !== this.tableFilter) return false;
            if (this.tableSearch) {
                const q = this.tableSearch.toLowerCase();
                return r.category.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
            }
            return true;
        });

        filtered.sort((a, b) => {
            let vA, vB;
            if (this.tableSortKey === 'amount') { vA = a.amount; vB = b.amount; }
            else { vA = new Date(a.date); vB = new Date(b.date); }
            return this.tableSortAsc ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
        });

        if (filtered.length === 0) return `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p style="font-size:0.95rem;font-weight:600;margin-bottom:6px;">No results found</p>
                <p>Try adjusting your search or filter.</p>
            </div>`;

        const sortIcon = (key) => this.tableSortKey !== key
            ? `<span class="sort-icon">↕</span>`
            : `<span class="sort-icon" style="opacity:1;color:var(--color-primary-light);">${this.tableSortAsc?'↑':'↓'}</span>`;

        return `
            <table class="data-table" id="${tableId}">
                <thead><tr>
                    <th data-sort="date" class="${this.tableSortKey==='date'?'sorted':''}">Date ${sortIcon('date')}</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th data-sort="amount" class="${this.tableSortKey==='amount'?'sorted':''}">Amount ${sortIcon('amount')}</th>
                    <th class="text-right">Status</th>
                </tr></thead>
                <tbody>
                    ${filtered.map(r => `
                        <tr>
                            <td style="color:var(--text-muted);white-space:nowrap;">${new Date(r.date).toLocaleDateString('en-IN')}</td>
                            <td style="font-weight:600;">${r.category}</td>
                            <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-sub);">${r.description}</td>
                            <td style="font-weight:700;white-space:nowrap;">${formatINR(r.amount)}</td>
                            <td class="text-right"><span class="badge badge-${r.status}">${r.status}</span></td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    attachTableControls(allRequests, tableId, wrapperId) {
        const searchEl = document.getElementById(`${tableId}-search`);
        if (searchEl) {
            searchEl.oninput = (e) => {
                this.tableSearch = e.target.value;
                document.getElementById(wrapperId).innerHTML = this.renderRequestsTable(allRequests, tableId);
                this.reattachSortHandlers(allRequests, tableId, wrapperId);
                lucide.createIcons();
            };
        }
        ['all','approved','pending','rejected'].forEach(f => {
            const btn = document.getElementById(`${tableId}-filter-${f}`);
            if (btn) btn.onclick = () => {
                this.tableFilter = f;
                ['all','approved','pending','rejected'].forEach(ff => {
                    const b = document.getElementById(`${tableId}-filter-${ff}`);
                    if (b) b.className = 'filter-tab' + (this.tableFilter === ff ? (ff==='all'?' active':` active-${ff}`) : '');
                });
                document.getElementById(wrapperId).innerHTML = this.renderRequestsTable(allRequests, tableId);
                this.reattachSortHandlers(allRequests, tableId, wrapperId);
                lucide.createIcons();
            };
        });
        this.reattachSortHandlers(allRequests, tableId, wrapperId);
    }

    reattachSortHandlers(allRequests, tableId, wrapperId) {
        document.getElementById(tableId)?.querySelectorAll('th[data-sort]').forEach(th => {
            th.onclick = () => {
                const key = th.dataset.sort;
                if (this.tableSortKey === key) this.tableSortAsc = !this.tableSortAsc;
                else { this.tableSortKey = key; this.tableSortAsc = false; }
                document.getElementById(wrapperId).innerHTML = this.renderRequestsTable(allRequests, tableId);
                this.reattachSortHandlers(allRequests, tableId, wrapperId);
                lucide.createIcons();
            };
        });
    }

    /* ----------------------------------------------------------
       INSIGHTS BAR
    ---------------------------------------------------------- */
    renderInsightsBar(insights) {
        if (!insights) return '';
        const chips = [];
        if (insights.topCategory) chips.push(`<div class="insight-chip success"><span class="chip-icon">🏆</span><span>Most spent: <strong>${insights.topCategory}</strong></span></div>`);
        if (insights.lowBudgetWarning) chips.push(`<div class="insight-chip warning"><span class="chip-icon">⚠️</span><span><strong>Low budget warning</strong> — less than 20% remaining</span></div>`);
        if (insights.latestRequest) chips.push(`<div class="insight-chip"><span class="chip-icon">📋</span><span>Latest: <strong>${insights.latestRequest.category}</strong> on ${new Date(insights.latestRequest.date).toLocaleDateString('en-IN')}</span></div>`);
        return chips.length ? `<div class="insights-bar">${chips.join('')}</div>` : '';
    }

    /* ----------------------------------------------------------
       CHARTS
    ---------------------------------------------------------- */
    renderUtilizationChart(stats, canvasId) {
        destroyChart(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Spent', 'Pending', 'Remaining'],
                datasets: [{ data: [stats.spent, stats.pending, Math.max(0, stats.budget-stats.spent-stats.pending)], backgroundColor: ['#10b981','#f59e0b','#7c3aed'], borderWidth: 0, hoverOffset: 8 }]
            },
            options: {
                cutout: '78%',
                animation: { duration: 1000, easing: 'easeInOutQuart' },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { family: 'Outfit', size: 12 }, usePointStyle: true } },
                    tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatINR(c.raw)}` }, backgroundColor: 'rgba(10,12,24,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8', padding: 12, titleFont: { family: 'Outfit' }, bodyFont: { family: 'Outfit' } }
                }
            }
        });
    }

    renderAllocationChart(depts, canvasId) {
        destroyChart(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: depts.map(d => d.name),
                datasets: [{ data: depts.map(d => d.budget), backgroundColor: ['rgba(124,58,237,0.5)','rgba(16,185,129,0.5)','rgba(59,130,246,0.5)','rgba(244,63,94,0.5)'], borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, hoverOffset: 6 }]
            },
            options: {
                animation: { duration: 1000, easing: 'easeInOutQuart' },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 14, font: { family: 'Outfit', size: 12 }, usePointStyle: true } },
                    tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatINR(c.raw)}` }, backgroundColor: 'rgba(10,12,24,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8', padding: 12, titleFont: { family: 'Outfit' }, bodyFont: { family: 'Outfit' } }
                },
                scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.04)' } } }
            }
        });
    }

    /* ----------------------------------------------------------
       MODALS
    ---------------------------------------------------------- */
    showRequestModal() {
        const modal = document.getElementById('modal-container');
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="glass-panel modal-content" style="width:440px;padding:32px;border-color:var(--color-primary-border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <h2 style="font-weight:700;font-size:1.1rem;">New Budget Request</h2>
                    <button class="btn btn-ghost btn-sm" id="close-modal" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;">
                        <i data-lucide="x" style="width:16px;height:16px;"></i>
                    </button>
                </div>
                <form id="request-form">
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="req-cat" class="form-input" style="background:rgba(255,255,255,0.05);border:1px solid var(--card-border);color:white;padding:11px 14px;border-radius:var(--radius-md);width:100%;font-family:Outfit,sans-serif;font-size:0.9rem;">
                            <option value="Lab Equipment">Lab Equipment</option>
                            <option value="Research Support">Research Support</option>
                            <option value="Infrastructure">Infrastructure</option>
                            <option value="Travel & Events">Travel & Events</option>
                            <option value="Office Supplies">Office Supplies</option>
                            <option value="Software">Software</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" id="req-amount" required class="form-input" placeholder="e.g. 50000" min="1" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="req-desc" required class="form-input" style="height:90px;resize:none;" placeholder="Brief description of the request…"></textarea>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:8px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;" id="submit-req-btn">
                            <i data-lucide="send" style="width:14px;height:14px;"></i>Submit Request
                        </button>
                        <button type="button" class="btn btn-ghost" id="close-modal-2" style="flex:1;">Cancel</button>
                    </div>
                </form>
            </div>`;
        lucide.createIcons();

        const closeModal = () => { modal.style.display = 'none'; };
        document.getElementById('close-modal').onclick   = closeModal;
        document.getElementById('close-modal-2').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        document.getElementById('request-form').onsubmit = async (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('req-amount').value);
            if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'warning'); return; }
            const btn = document.getElementById('submit-req-btn');
            btn.disabled = true; btn.textContent = 'Submitting…';
            try {
                await requestApi.create({
                    amount,
                    category:    document.getElementById('req-cat').value,
                    description: document.getElementById('req-desc').value
                });
                closeModal();
                showToast('Budget request submitted successfully!', 'success');
                await this.render();
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="send" style="width:14px;height:14px;"></i>Submit Request';
                lucide.createIcons();
            }
        };
    }

    async showAdjustBudgetModal(deptId) {
        /* Fetch users to populate assignment dropdown */
        let users = [];
        try {
            const res = await authApi.getUsers();
            users = res.data || [];
        } catch (e) {
            console.error('Failed to load users for assignment', e);
        }

        const modal = document.getElementById('modal-container');
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="glass-panel modal-content" style="width:440px;padding:32px;border-color:var(--color-success-border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <h2 style="font-weight:700;font-size:1.1rem;">Edit Department</h2>
                    <button class="btn btn-ghost btn-sm" id="close-adjust-modal" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;">
                        <i data-lucide="x" style="width:16px;height:16px;"></i>
                    </button>
                </div>
                <form id="adjust-budget-form">
                    <div class="form-group">
                        <label class="form-label">Department Head Name (Text)</label>
                        <input type="text" id="new-head-val" class="form-input" placeholder="e.g. Prof. Ravi Kumar" />
                    </div>
                    <div class="form-group">
                        <select id="link-user-val" class="form-input" style="background:rgba(255,255,255,0.05);border:1px solid var(--card-border);color:white;padding:11px 14px;border-radius:var(--radius-md);width:100%;font-family:Outfit,sans-serif;font-size:0.9rem;">
                            <option value="">-- Keep Current Selection --</option>
                            <option value="UNASSIGN" style="color:var(--color-danger);">-- Remove Department Head --</option>
                            ${users.map(u => {
                                const isCurrentDept = u.department && u.department._id === deptId;
                                const isOtherDept = u.department && u.department._id !== deptId;
                                return `
                                    <option value="${u._id}" ${isCurrentDept ? 'selected' : (isOtherDept ? 'disabled' : '')}>
                                        ${u.name} (${u.email}) ${u.department ? `[${isCurrentDept ? 'Currently' : 'Already in'}: ${u.department.name}]` : '[Unassigned]'}
                                    </option>
                                `;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Budget Limit (₹)</label>
                        <input type="number" id="new-budget-val" class="form-input" placeholder="Enter new budget amount" />
                    </div>
                    <div style="display:flex;gap:10px;margin-top:8px;">
                        <button type="submit" class="btn btn-success" style="flex:1;" id="update-budget-btn">
                            <i data-lucide="check" style="width:14px;height:14px;"></i>Save Changes
                        </button>
                        <button type="button" class="btn btn-ghost" id="cancel-adjust" style="flex:1;">Cancel</button>
                    </div>
                </form>
            </div>`;
        lucide.createIcons();

        const linkUserSelect = document.getElementById('link-user-val');
        const newHeadInput = document.getElementById('new-head-val');
        
        linkUserSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'UNASSIGN') {
                newHeadInput.value = 'Unassigned';
            } else if (val) {
                const selectedText = e.target.options[e.target.selectedIndex].text;
                if (selectedText.includes('(')) {
                    newHeadInput.value = selectedText.split('(')[0].trim();
                }
            }
        });

        const closeModal = () => { modal.style.display = 'none'; };
        document.getElementById('close-adjust-modal').onclick = closeModal;
        document.getElementById('cancel-adjust').onclick      = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        document.getElementById('adjust-budget-form').onsubmit = async (e) => {
            e.preventDefault();
            const budgetStr = document.getElementById('new-budget-val').value;
            const headStr   = document.getElementById('new-head-val').value.trim();
            const userId    = document.getElementById('link-user-val').value;
            const val       = budgetStr ? parseInt(budgetStr) : null;

            const currentAssignedUser = users.find(u => u.department && u.department._id === deptId);
            const userChanged = userId && (userId === "UNASSIGN" || (!currentAssignedUser || userId !== currentAssignedUser._id));

            if (!headStr && !val && !userChanged) { showToast('Please change at least one field to update', 'warning'); return; }
            if (val !== null && val <= 0) { showToast('Please enter a valid budget amount', 'warning'); return; }

            const btn = document.getElementById('update-budget-btn');
            btn.disabled = true; btn.textContent = 'Saving…';
            try {
                const parts = [];
                // Update dept budget/head text
                if (val || headStr) {
                    const payload = {};
                    if (val)     payload.budget = val;
                    if (headStr) payload.head   = headStr;
                    await deptApi.update(deptId, payload);
                    if (val)     parts.push(`budget updated to ${formatINR(val)}`);
                    if (headStr) parts.push(`head updated to "${headStr}"`);
                }

                // Update user account linking
                if (userChanged) {
                    if (userId === "UNASSIGN" && currentAssignedUser) {
                        await authApi.assignDepartment(currentAssignedUser._id, null);
                        parts.push(`user unassigned`);
                    } else if (userId !== "UNASSIGN") {
                        if (currentAssignedUser) {
                            await authApi.assignDepartment(currentAssignedUser._id, null);
                        }
                        await authApi.assignDepartment(userId, deptId);
                        parts.push(`user acc linked`);
                    }
                }

                closeModal();
                showToast(`Department ${parts.join(' & ')}`, 'success');
                await this.render();
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i>Save Changes';
                lucide.createIcons();
            }
        };
    }

    async showCreateDeptModal() {
        let users = [];
        try {
            const res = await authApi.getUsers();
            users = res.data || [];
        } catch (e) {
            console.error('Failed to load users for assignment', e);
        }

        const modal = document.getElementById('modal-container');
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="glass-panel modal-content" style="width:440px;padding:32px;border-color:var(--color-primary-border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                    <h2 style="font-weight:700;font-size:1.1rem;">Create Department</h2>
                    <button class="btn btn-ghost btn-sm" id="close-create-modal" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;">
                        <i data-lucide="x" style="width:16px;height:16px;"></i>
                    </button>
                </div>
                <form id="create-dept-form">
                    <div class="form-group">
                        <label class="form-label">Department Name</label>
                        <input type="text" id="dept-name" required class="form-input" placeholder="e.g. Computer Science" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Department Head Name (Text)</label>
                        <input type="text" id="dept-head" required class="form-input" placeholder="e.g. Prof. Ravi Kumar" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Link User Account</label>
                        <select id="link-user-val-create" class="form-input" style="background:rgba(255,255,255,0.05);border:1px solid var(--card-border);color:white;padding:11px 14px;border-radius:var(--radius-md);width:100%;font-family:Outfit,sans-serif;font-size:0.9rem;">
                            <option value="">-- Select a User --</option>
                            ${users.map(u => `
                                <option value="${u._id}" ${u.department ? 'disabled' : ''}>
                                    ${u.name} (${u.email}) ${u.department ? `[Already in: ${u.department.name}]` : '[Unassigned]'}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Annual Budget (₹)</label>
                        <input type="number" id="dept-budget" required class="form-input" placeholder="e.g. 500000" min="1" />
                    </div>
                    <div style="display:flex;gap:10px;margin-top:8px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;" id="create-dept-submit">
                            <i data-lucide="plus" style="width:14px;height:14px;"></i>Create Department
                        </button>
                        <button type="button" class="btn btn-ghost" id="cancel-create" style="flex:1;">Cancel</button>
                    </div>
                </form>
            </div>`;
        lucide.createIcons();

        // Auto-fill head text when user selected
        const linkSelect = document.getElementById('link-user-val-create');
        const headInput = document.getElementById('dept-head');
        linkSelect.addEventListener('change', (e) => {
            const selectedText = e.target.options[e.target.selectedIndex].text;
            if (e.target.value && selectedText.includes('(')) {
                headInput.value = selectedText.split('(')[0].trim();
            }
        });

        const closeModal = () => { modal.style.display = 'none'; };
        document.getElementById('close-create-modal').onclick = closeModal;
        document.getElementById('cancel-create').onclick      = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        document.getElementById('create-dept-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('create-dept-submit');
            btn.disabled = true; btn.textContent = 'Creating…';
            try {
                const newDept = await deptApi.create({
                    name:   document.getElementById('dept-name').value.trim(),
                    head:   document.getElementById('dept-head').value.trim(),
                    budget: parseInt(document.getElementById('dept-budget').value)
                });
                
                const userId = document.getElementById('link-user-val-create').value;
                if (userId) {
                    await authApi.assignDepartment(userId, newDept.data._id);
                }

                closeModal();
                showToast('Department created successfully!', 'success');
                await this.render();
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="plus" style="width:14px;height:14px;"></i>Create Department';
                lucide.createIcons();
            }
        };
    }
}

new App();
