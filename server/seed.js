/**
 * BudgetWise — Database Seeder
 * Run: node seed.js
 * Seeds 4 departments, 5 users (1 admin + 4 dept heads), and 6 budget requests.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { connectDB } from './config/db.js';
import User          from './models/User.js';
import Department    from './models/Department.js';
import BudgetRequest from './models/BudgetRequest.js';
import Institution   from './models/Institution.js';

const seed = async () => {
    await connectDB();

    try {
        console.log('\n🌱 Starting database seed...\n');

        /* ── Clear existing data ── */
        await BudgetRequest.deleteMany({});
        await User.deleteMany({});
        await Department.deleteMany({});
        await Institution.deleteMany({});
        console.log('🗑  Cleared existing collections');

        /* ── Institution ── */
        const defaultInst = await Institution.create({
            name: 'Global Tech University',
            domain: 'gtu.edu',
            subscriptionPlan: 'enterprise'
        });
        console.log(`✅ Created institution: ${defaultInst.name}`);

        /* ── Departments ── */
        const defaultLimits = [
            { category: 'Lab Equipment', limit: 100000 },
            { category: 'Research Support', limit: 150000 },
            { category: 'Infrastructure', limit: 200000 },
            { category: 'Travel & Events', limit: 50000 },
            { category: 'Office Supplies', limit: 20000 },
            { category: 'Software', limit: 100000 }
        ];

        const departments = await Department.insertMany([
            { name: 'Science & Research', head: 'Dr. Sarah Smith', budget: 500000, spent: 125000, institution: defaultInst._id, categoryLimits: defaultLimits },
            { name: 'Engineering', head: 'Prof. James Wilson', budget: 750000, spent: 340000, institution: defaultInst._id, categoryLimits: defaultLimits },
            { name: 'Humanities', head: 'Dr. Elena Rossi', budget: 200000, spent: 45000, institution: defaultInst._id, categoryLimits: defaultLimits },
            { name: 'Arts & Design', head: 'M. Julian Chen', budget: 150000, spent: 20000, institution: defaultInst._id, categoryLimits: defaultLimits }
        ]);
        const [sci, eng, hum, art] = departments;
        console.log(`✅ Created ${departments.length} departments`);

        /* ── Users ── */
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('Admin@123', salt);
        const deptHash  = await bcrypt.hash('Dept@123',  salt);
        const finHash   = await bcrypt.hash('Finance@123', salt);

        const users = await User.insertMany([
            {
                name:       'Administrator',
                email:      'admin@budgetwise.in',
                password:   adminHash,
                role:       'admin',
                institution: defaultInst._id,
                department: null,
                avatar:     'Admin'
            },
            {
                name:       'Dr. Sarah Smith',
                email:      'sci@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                institution: defaultInst._id,
                department: sci._id,
                avatar:     'Sarah'
            },
            {
                name:       'Prof. James Wilson',
                email:      'eng@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                institution: defaultInst._id,
                department: eng._id,
                avatar:     'James'
            },
            {
                name:       'Dr. Elena Rossi',
                email:      'hum@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                institution: defaultInst._id,
                department: hum._id,
                avatar:     'Elena'
            },
            {
                name:       'M. Julian Chen',
                email:      'art@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                institution: defaultInst._id,
                department: art._id,
                avatar:     'Julian'
            },
            {
                name:       'Priya Mehta',
                email:      'finance@budgetwise.in',
                password:   finHash,
                role:       'finance_officer',
                institution: defaultInst._id,
                department: null,
                avatar:     'Priya'
            }
        ]);
        const [admin, sciUser, engUser, humUser, artUser, finUser] = users;
        console.log(`✅ Created ${users.length} users`);

        /* ── Budget Requests ── */
        const requests = await BudgetRequest.insertMany([
            {
                department:  sci._id,
                institution: defaultInst._id,
                submittedBy: sciUser._id,
                amount:      50000,
                category:    'Lab Equipment',
                description: 'Quantum Spectrometer repair and calibration',
                status:      'FINAL_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-08-20'),
                date:        new Date('2025-08-15')
            },
            {
                department:  eng._id,
                institution: defaultInst._id,
                submittedBy: engUser._id,
                amount:      120000,
                category:    'Software',
                description: 'CAD & Simulation licenses for FY26 semester',
                status:      'PENDING',
                workflowState: 'pending_dept_head',
                date:        new Date('2025-09-01')
            },
            {
                department:  hum._id,
                institution: defaultInst._id,
                submittedBy: humUser._id,
                amount:      5000,
                category:    'Travel & Events',
                description: 'Academic conference in Paris — 2 faculty members',
                status:      'REJECTED',
                workflowState: 'rejected',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-07-25'),
                date:        new Date('2025-07-20')
            },
            {
                department:  sci._id,
                institution: defaultInst._id,
                submittedBy: sciUser._id,
                amount:      75000,
                category:    'Research Support',
                description: 'AI & ML Research Grant co-funding round',
                status:      'PENDING',
                workflowState: 'pending_dept_head',
                date:        new Date('2025-09-10')
            },
            {
                department:  eng._id,
                institution: defaultInst._id,
                submittedBy: engUser._id,
                amount:      30000,
                category:    'Infrastructure',
                description: 'Server rack expansion — Phase 2 of data center upgrade',
                status:      'FINAL_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-09-02'),
                date:        new Date('2025-08-28')
            },
            {
                department:  art._id,
                institution: defaultInst._id,
                submittedBy: artUser._id,
                amount:      15000,
                category:    'Office Supplies',
                description: 'Studio equipment — canvas, pigments, digital stylus',
                status:      'FINAL_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-08-10'),
                date:        new Date('2025-08-05')
            },
            /* ── UNDER_REVIEW requests for Finance Officer testing ── */
            {
                department:  sci._id,
                institution: defaultInst._id,
                submittedBy: sciUser._id,
                amount:      95000,
                category:    'Lab Equipment',
                description: 'Electron Microscope maintenance contract renewal',
                status:      'UNDER_REVIEW',
                workflowState: 'pending_finance',
                date:        new Date('2026-04-01')
            },
            {
                department:  eng._id,
                institution: defaultInst._id,
                submittedBy: engUser._id,
                amount:      200000,
                category:    'Infrastructure',
                description: 'Cloud server migration — AWS to Azure',
                status:      'UNDER_REVIEW',
                workflowState: 'pending_finance',
                date:        new Date('2026-04-10')
            },
            {
                department:  hum._id,
                institution: defaultInst._id,
                submittedBy: humUser._id,
                amount:      35000,
                category:    'Travel & Events',
                description: 'International Literature Conference — Berlin',
                status:      'UNDER_REVIEW',
                workflowState: 'pending_finance',
                date:        new Date('2026-04-15')
            },
            /* ── FINANCE_APPROVED requests for expense trends chart ── */
            {
                department:  eng._id,
                institution: defaultInst._id,
                submittedBy: engUser._id,
                amount:      80000,
                category:    'Software',
                description: 'JetBrains & MATLAB annual licenses',
                status:      'FINANCE_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2026-01-20'),
                date:        new Date('2026-01-15')
            },
            {
                department:  sci._id,
                institution: defaultInst._id,
                submittedBy: sciUser._id,
                amount:      150000,
                category:    'Research Support',
                description: 'Genomics research grant co-funding',
                status:      'FINANCE_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2026-02-18'),
                date:        new Date('2026-02-10')
            },
            {
                department:  art._id,
                institution: defaultInst._id,
                submittedBy: artUser._id,
                amount:      45000,
                category:    'Office Supplies',
                description: 'Digital art tablets and 3D printers',
                status:      'FINANCE_APPROVED',
                workflowState: 'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2026-03-12'),
                date:        new Date('2026-03-05')
            }
        ]);
        console.log(`✅ Created ${requests.length} budget requests`);

        /* ── Summary ── */
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉  Seed completed successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Login Credentials:');
        console.log('  Admin      → admin@budgetwise.in    | Admin@123');
        console.log('  Finance    → finance@budgetwise.in  | Finance@123');
        console.log('  Science    → sci@budgetwise.in      | Dept@123');
        console.log('  Engg       → eng@budgetwise.in      | Dept@123');
        console.log('  Humanities → hum@budgetwise.in      | Dept@123');
        console.log('  Arts       → art@budgetwise.in      | Dept@123\n');
        console.log('🌐 Frontend: http://localhost:5173');
        console.log('📡 API:      http://localhost:5000/api/health');
        console.log('💼 Finance:  http://localhost:5173/finance.html');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        mongoose.connection.close();
    }
};

seed();
