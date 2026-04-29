import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

import authRoutes   from './routes/auth.js';
import deptRoutes   from './routes/departments.js';
import reqRoutes    from './routes/requests.js';
import notifRoutes  from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import financeRoutes  from './routes/finance.js';

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Connect to MongoDB ── */
connectDB();

/* ── Middleware ── */
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    credentials: true
}));
app.use(express.json());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

/* ── Routes ── */
app.use('/api/auth',          authRoutes);
app.use('/api/departments',   deptRoutes);
app.use('/api/requests',      reqRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/finance',       financeRoutes);

/* ── Health check ── */
app.get('/api/health', (_req, res) =>
    res.json({ success: true, status: 'BudgetWise API is running 🚀', timestamp: new Date() })
);

/* ── 404 handler ── */
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
    console.error('💥 Server Error:', err.message);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Vercel serverless export
export default app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 BudgetWise Server running in ${process.env.NODE_ENV} mode`);
        console.log(`📡 Local: http://localhost:${PORT}`);
        console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
    });
}
