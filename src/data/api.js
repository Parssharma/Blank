/**
 * BudgetWise — API Service
 * Replaces the localStorage store with real fetch calls to the Express backend.
 * All methods are async and return { success, data } shaped responses.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/api' : '/api';

/* ── Token / User helpers ── */
export const getToken  = ()  => localStorage.getItem('bw_token');
export const setToken  = (t) => localStorage.setItem('bw_token', t);
export const clearToken= ()  => localStorage.removeItem('bw_token');

export const getUser   = ()  => { try { return JSON.parse(localStorage.getItem('bw_user')); } catch { return null; } };
export const setUser   = (u) => localStorage.setItem('bw_user', JSON.stringify(u));
export const clearUser = ()  => localStorage.removeItem('bw_user');

export const isAuthenticated = () => !!getToken();

/** Central fetch wrapper — adds auth header, handles 401 auto-redirect */
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    /* Auto-logout on 401 */
    if (res.status === 401) {
        clearToken();
        clearUser();
        window.location.href = '/login.html';
        return null;
    }

    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json;
}

/* ═══════════════════════════════════════
   AUTH
═══════════════════════════════════════ */
export const authApi = {
    login: (email, password) =>
        apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }),

    register: (name, email, password, role, department) =>
        apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role, department })
        }),

    getMe: () => apiFetch('/auth/me'),

    updateProfile: (data) =>
        apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

    logout: () => {
        clearToken();
        clearUser();
        window.location.href = '/login.html';
    },

    /* Admin only */
    getUsers: () => apiFetch('/auth/users'),

    assignDepartment: (userId, departmentId) =>
        apiFetch(`/auth/users/${userId}/department`, {
            method: 'PUT',
            body: JSON.stringify({ departmentId })
        })
};

/* ═══════════════════════════════════════
   DEPARTMENTS
═══════════════════════════════════════ */
export const deptApi = {
    getAll: () =>
        apiFetch('/departments'),

    getById: (id) =>
        apiFetch(`/departments/${id}`),

    getStats: (id) =>
        apiFetch(`/departments/${id}/stats`),

    create: (data) =>
        apiFetch('/departments', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
        apiFetch(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id) =>
        apiFetch(`/departments/${id}`, { method: 'DELETE' })
};

/* ═══════════════════════════════════════
   BUDGET REQUESTS
═══════════════════════════════════════ */
export const requestApi = {
    getAll: (params = {}) =>
        apiFetch(`/requests?${new URLSearchParams(params)}`),

    getPending: () =>
        apiFetch('/requests/pending'),

    getInsights: (deptId = null) =>
        apiFetch(`/requests/insights${deptId ? `?deptId=${deptId}` : ''}`),

    getById: (id) =>
        apiFetch(`/requests/${id}`),

    create: (data) =>
        apiFetch('/requests', { method: 'POST', body: JSON.stringify(data) }),

    updateStatus: (id, status) =>
        apiFetch(`/requests/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        }),

    update: (id, data) =>
        apiFetch(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id) =>
        apiFetch(`/requests/${id}`, { method: 'DELETE' })
};

/* ── Fiscal year helper (client-side, no DB needed) ── */
export const getFiscalYear = () => {
    const now  = new Date();
    const year = now.getFullYear();
    return now.getMonth() >= 6 ? `FY ${year}–${year + 1}` : `FY ${year - 1}–${year}`;
};
