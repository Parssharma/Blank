# BudgetWise

**BudgetWise** is a full-stack Institutional Budget Management System designed to streamline request workflows, role-based approvals, and departmental spending tracking. It features an integrated analytics dashboard and automated alert system for fiscal control.

## 🚀 Key Features

*   **Role-Based Access Control (RBAC):** Secure distinct portals for Admins, Finance Officers, and Department Heads.
*   **Multi-Level Approval Workflow:** Department Head → Finance Officer (Reject/Revise/Forward) → Admin.
*   **Real-time Analytics Dashboard:** Dynamic forecasting, smart insights, and department vs department comparative charts using Chart.js.
*   **Automated Budget Alerts:** System-generated notifications for admins and departments when spending crosses 80% and 95% thresholds.
*   **Responsive UI:** Premium glassmorphism design that works seamlessly across desktop and mobile devices.

## 📂 Project Structure

The codebase is organized module-wise for clarity and ease of maintenance:

```text
webdev-project/
├── public/                 # Static assets (favicons, SVG icons)
│   ├── favicon.svg
│   └── icons.svg
│
├── src/                    # ── FRONTEND SOURCE ──
│   ├── styles/             # CSS stylesheets
│   │   └── main.css        
│   │
│   ├── modules/            # Feature-specific JavaScript
│   │   └── financeDashboard.js
│   │
│   ├── data/               # API clients for backend communication
│   │   └── api.js
│   │
│   └── app.js              # Main application logic and rendering
│
├── server/                 # ── BACKEND SOURCE ──
│   ├── config/             # Database connection (db.js)
│   ├── controllers/        # Core business logic (auth, finance, etc.)
│   ├── middleware/         # JWT authentication & authorization
│   ├── models/             # Mongoose schemas (User, Request, etc.)
│   ├── routes/             # API endpoint definitions
│   ├── seed.js             # Initial database seeding script
│   └── server.js           # Express application entry point
│
├── api/                    # Vercel serverless entry wrapper
│   └── index.js
│
├── index.html              # Main dashboard HTML entry point
├── login.html              # Authentication HTML entry point
├── finance.html            # Finance Officer HTML entry point
├── package.json            # Frontend dependencies & scripts
├── vite.config.js          # Vite build configuration
└── vercel.json             # Vercel deployment configuration
```

## 🔄 System Workflow

1.  **Authentication**: Users authenticate via `/login.html`. A JWT is generated securely via the backend and stored in `localStorage`.
2.  **Dashboard Access**: Depending on the decoded role in the JWT, `src/app.js` renders the appropriate interface (Admin, Finance Officer, or Dept Head).
3.  **Data Operations**: The frontend fetches and pushes data via `src/data/api.js`.
4.  **Backend Processing**: Requests hit `server/server.js`, are protected by `middleware/auth.js`, routed via `server/routes`, processed in `server/controllers`, and interact with MongoDB via `server/models`.
5.  **Alerts & Tracking**: Successful actions (like approvals) trigger automated threshold calculations, and notifications are sent if budgets are nearing exhaustion.

## 💻 Tech Stack

*   **Frontend**: HTML5, Vanilla JavaScript, CSS (Variables, Glassmorphism, Responsive Grid), Chart.js
*   **Backend**: Node.js, Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Authentication**: JSON Web Tokens (JWT), bcrypt
*   **Build Tool**: Vite

## ⚙️ Local Development Setup

1.  **Install dependencies:**
    ```bash
    npm install
    cd server && npm install
    ```

2.  **Environment Variables:**
    Create a `.env` file in the `server/` directory:
    ```env
    PORT=5000
    MONGODB_URI=your_mongodb_connection_string
    JWT_SECRET=your_super_secret_jwt_key
    NODE_ENV=development
    ```

3.  **Seed the database (Optional but recommended):**
    ```bash
    cd server
    npm run seed
    ```

4.  **Start the Backend & Frontend servers:**
    ```bash
    # Terminal 1: Backend
    cd server
    npm run dev
    
    # Terminal 2: Frontend
    npm run dev
    ```

5.  Open `http://localhost:5173` in your browser.
