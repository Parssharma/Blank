# BudgetWise — Institutional Budget Management System

BudgetWise is a comprehensive full-stack institutional budget management system designed to track allocations, streamline approval workflows, and monitor departmental spending in real-time. It provides a secure, role-based platform for administrators and department heads to manage financial resources efficiently.

## 🌟 Features & Functionalities

### 🔐 Authentication & Authorization
- **Secure Login:** JWT-based authentication ensures secure access to the application.
- **Role-Based Access Control (RBAC):** Distinct roles and views for Administrators and Department Heads.

### 👑 Administrator Capabilities
- **Institutional Dashboard:** A high-level overview of the total institutional budget, total expenditures, and pending approvals.
- **Approval Queue:** A dedicated interface to review, approve, or reject budget requests submitted by department heads.
- **Department Management:** 
  - Create new departments.
  - Assign and manage department heads.
  - Adjust annual budget limits for each department.
  - Delete departments when necessary.
- **Financial Analytics & Reports:** Interactive charts displaying budget distribution across departments and detailed breakdowns of institutional burn rates.

### 🏢 Department Head Capabilities
- **Department Dashboard:** Real-time tracking of total allocated budget, total spent, pending requests, and remaining funds.
- **Budget Requests:** Submit new budget requests with descriptions, amounts, and categories.
- **Expenditure History:** A detailed history of all submitted requests and their current statuses (Pending, Approved, Rejected).
- **Spending Analytics:** Visual insights into the department's strategic allocation and fiscal year summary.

### 💻 UI/UX Features
- **Responsive Design:** Fully optimized for both desktop and mobile devices. Includes a dynamic mobile overlay and collapsable sidebar for seamless navigation on smaller screens.
- **Premium Aesthetics:** Modern, sleek interface with glassmorphism effects, dynamic micro-animations, and a curated color palette.
- **Real-time Visualizations:** Interactive charts and graphs powered by Chart.js for immediate financial insights.
- **Toast Notifications:** Instant feedback for user actions (success, error, warnings).

## 🛠️ Technology Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- [Vite](https://vitejs.dev/) - Frontend Tooling
- [Chart.js](https://www.chartjs.org/) - Data Visualization
- [Lucide Icons](https://lucide.dev/) - Iconography

**Backend:**
- Node.js & Express.js - RESTful API architecture
- MongoDB & Mongoose - Database and Object Data Modeling (ODM)
- JSON Web Tokens (JWT) - Secure stateless authentication
- bcryptjs - Password hashing

## 🚀 Getting Started

### Prerequisites
- Node.js installed on your machine
- MongoDB instance (local or MongoDB Atlas)

### Installation & Setup

1. **Clone the repository** (if applicable) or navigate to the project directory.

2. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `server` directory and add the following variables:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Install Frontend Dependencies:**
   ```bash
   cd ..
   npm install
   ```

5. **Start the Application:**
   
   *Start the backend server (from the `server` directory):*
   ```bash
   npm start
   # or node server.js
   ```

   *Start the frontend development server (from the root directory):*
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## 🌐 Deployment
The application is structured to be easily deployable on modern hosting platforms. The frontend can be deployed on platforms like Vercel, and the Node.js backend can be hosted on services such as Render, Heroku, or Vercel Serverless Functions.
