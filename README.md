# BudgetWise — Institutional Budget Management System

BudgetWise is a comprehensive full-stack institutional budget management system designed to track allocations, streamline approval workflows, and monitor departmental spending in real-time. It provides a secure, role-based platform for administrators and department heads to manage financial resources efficiently.

---

## ✨ What's New (Latest Update — April 2026)

### 🎨 Premium Animation Suite
A complete, modular animation system was added across the entire application — zero external animation libraries, built with pure CSS keyframes and modern JS APIs.

| Feature | Description |
|---|---|
| 🌀 **Page Loader** | Full-screen cinematic intro with spinning gradient SVG arc, glowing logo mark, and shimmer progress bar. Fades out smoothly once the app is ready. |
| 🎲 **3D Card Tilt** | GPU-accelerated perspective tilt (±7°) on all stat cards, department cards, and chart panels. Glare sheen overlay rotates to follow light direction. Auto-wires to SPA-injected content via `MutationObserver`. |
| 👁 **Scroll Reveal** | `IntersectionObserver`-powered fade/slide animations when elements enter the viewport. Supports `up`, `left`, `right`, and `scale` variants with staggered cascade delays. |
| 🖱 **Magnetic Cursor** | Custom dot + lagging ring cursor with lerp-based smooth trailing. Expands on button/link hover. Auto-disabled on touch devices. |
| ↔ **Page Transitions** | Smooth fade+slide between every SPA page navigation — content fades down before swap and fades up after. |
| ✨ **Micro Particles** | 8 radial colored dots burst from every click point, self-cleaning via `animationend`. |
| 🌐 **Ambient Orbs** | 3 large blurred gradient circles (violet / emerald / blue) float in the background at different speeds. |
| 💧 **Button Ripples** | Material-style ripple effect on every button press. |
| 🔔 **Enhanced Toasts** | Bounce-in spring animation using `cubic-bezier(0.34, 1.56, 0.64, 1)`. |
| 📋 **Sidebar Entrance** | Nav items slide in from the left with staggered delays on every render. |
| 📌 **Header Slide-Down** | Header slides in from top on page load. |

> All animations are applied to both the **main dashboard** and the **login page**.

### 🐛 Bug Fixes
- Fixed crash `"Cannot read properties of null (reading '_id')"` on **My Requests** and **Reports** pages when a Department Head has no department assigned — now shows a friendly "No Department Assigned" message.
- Added `?.data ?? []` null-safety guards on all API response destructuring to prevent future data-shape crashes.

### 🔒 Security
- Added `.gitignore` — `node_modules/` and `.env` files are now excluded from Git to protect credentials.

---

## 🚀 Features & Functionalities

### 🔐 Authentication & Authorization
- **Secure Login:** JWT-based authentication ensures secure access to the application.
- **Role-Based Access Control (RBAC):** Distinct roles and views for Administrators and Department Heads.

### 🏛 Administrator Capabilities
- **Institutional Dashboard:** High-level overview of total institutional budget, total expenditures, and pending approvals with animated stat cards.
- **Approval Queue:** Dedicated interface to review, approve, or reject budget requests.
- **Department Management:**
  - Create new departments
  - Assign and manage department heads with user account linking
  - Adjust annual budget limits
  - Delete departments
- **Financial Analytics & Reports:** Interactive polar area and doughnut charts powered by Chart.js.

### 🏢 Department Head Capabilities
- **Department Dashboard:** Real-time tracking of allocated budget, total spent, pending requests, and remaining funds.
- **Budget Requests:** Submit new requests with description, amount, and category.
- **Expenditure History:** Full table of all submissions with sort, search, and status filter.
- **Spending Analytics:** Visual allocation breakdown and fiscal year cycle summary.

### 🎨 UI/UX Features
- **Glassmorphism Design:** Dark-mode interface with frosted glass panels, glow effects, and curated violet/emerald color palette.
- **Responsive Layout:** Collapsible sidebar, mobile-friendly adaptive grid.
- **Real-time Charts:** Chart.js doughnut and polar area charts with smooth 1s animations.
- **Skeleton Loaders:** Shimmer placeholders while data loads.
- **Toast Notifications:** Slide-in alerts for every user action.
- **Premium Animation Suite:** See above — page loader, 3D tilt, scroll reveal, magnetic cursor, transitions, particles.

---

## 🛠 Technology Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- [Vite](https://vitejs.dev/) — Frontend tooling & HMR
- [Chart.js](https://www.chartjs.org/) — Data visualization
- [Lucide Icons](https://lucide.dev/) — Iconography
- Custom animation module (`src/animations.js`) — Zero-dependency animation suite

**Backend:**
- Node.js & Express.js — RESTful API
- MongoDB & Mongoose — Database & ODM
- JSON Web Tokens (JWT) — Stateless authentication
- bcryptjs — Password hashing
- Morgan — HTTP request logging

---

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Installation & Setup

**1. Clone the repository:**
```bash
git clone https://github.com/Parssharma/Blank.git
cd Blank
```

**2. Install frontend dependencies:**
```bash
npm install
```

**3. Install backend dependencies:**
```bash
cd server
npm install
```

**4. Configure environment variables:**

Create a `.env` file inside the `server/` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
NODE_ENV=development
```

> ⚠️ Never commit your `.env` file — it's protected by `.gitignore`.

**5. Start the backend server** (from `server/` directory):
```bash
node server.js
```
Backend will run at → `http://localhost:5000`

**6. Start the frontend dev server** (from root directory):
```bash
npm run dev
```
Frontend will run at → `http://localhost:5173`

---

## 📁 Project Structure

```
Blank/
├── index.html              # Main app shell (dashboard)
├── login.html              # Login & register page
├── main.js                 # Core SPA logic & routing
├── style.css               # Global styles + animation CSS
├── .gitignore
├── package.json
│
├── src/
│   ├── animations.js       # 🎨 Animation suite (loader, tilt, cursor, etc.)
│   └── data/
│       ├── api.js          # API request helpers
│       └── store.js        # Local state / auth helpers
│
└── server/
    ├── server.js           # Express entry point
    ├── config/db.js        # MongoDB connection
    ├── models/             # Mongoose schemas (User, Department, Request)
    ├── controllers/        # Route handler logic
    ├── middleware/         # Auth middleware (JWT protect & authorize)
    └── routes/             # API route definitions
```

---

## 🔌 API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login & receive JWT |
| GET | `/api/auth/me` | Protected | Get current user |
| GET | `/api/departments` | Protected | List all departments |
| POST | `/api/departments` | Admin | Create department |
| PUT | `/api/departments/:id` | Admin | Update department |
| DELETE | `/api/departments/:id` | Admin | Delete department |
| GET | `/api/departments/:id/stats` | Protected | Get dept budget stats |
| GET | `/api/requests` | Protected | List requests |
| POST | `/api/requests` | Dept Head | Submit new request |
| PUT | `/api/requests/:id/status` | Admin | Approve / Reject |
| GET | `/api/requests/insights` | Protected | Get spending insights |

---

## 🚢 Deployment

The project is structured for easy deployment:

- **Frontend:** Deploy to [Vercel](https://vercel.com/) — `vercel.json` is already configured.
- **Backend:** Deploy to [Render](https://render.com/), [Railway](https://railway.app/), or Vercel Serverless Functions.
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier works).

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.0 | Apr 2026 | Premium animation suite, null dept bug fixes, .gitignore |
| v1.0 | Apr 2026 | Initial release — full CRUD, JWT auth, Chart.js, RBAC |
