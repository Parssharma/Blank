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

const seed = async () => {
    await connectDB();

    try {
        console.log('\n🌱 Starting database seed...\n');

        /* ── Clear existing data ── */
        await BudgetRequest.deleteMany({});
        await User.deleteMany({});
        await Department.deleteMany({});
        console.log('🗑  Cleared existing collections');

        /* ── Departments ── */
        const departments = await Department.insertMany([
            { name: 'Science & Research', head: 'Dr. Sarah Smith',    budget: 500000, spent: 125000 },
            { name: 'Engineering',        head: 'Prof. James Wilson',  budget: 750000, spent: 340000 },
            { name: 'Humanities',         head: 'Dr. Elena Rossi',     budget: 200000, spent: 45000  },
            { name: 'Arts & Design',      head: 'M. Julian Chen',      budget: 150000, spent: 20000  }
        ]);
        const [sci, eng, hum, art] = departments;
        console.log(`✅ Created ${departments.length} departments`);

        /* ── Users ── */
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('Admin@123', salt);
        const deptHash  = await bcrypt.hash('Dept@123',  salt);

        const users = await User.insertMany([
            {
                name:       'Administrator',
                email:      'admin@budgetwise.in',
                password:   adminHash,
                role:       'admin',
                department: null,
                avatar:     'Admin'
            },
            {
                name:       'Dr. Sarah Smith',
                email:      'sci@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                department: sci._id,
                avatar:     'Sarah'
            },
            {
                name:       'Prof. James Wilson',
                email:      'eng@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                department: eng._id,
                avatar:     'James'
            },
            {
                name:       'Dr. Elena Rossi',
                email:      'hum@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                department: hum._id,
                avatar:     'Elena'
            },
            {
                name:       'M. Julian Chen',
                email:      'art@budgetwise.in',
                password:   deptHash,
                role:       'dept',
                department: art._id,
                avatar:     'Julian'
            }
        ]);
        const [admin, sciUser, engUser, humUser, artUser] = users;
        console.log(`✅ Created ${users.length} users`);

        /* ── Budget Requests ── */
        const requests = await BudgetRequest.insertMany([
            {
                department:  sci._id,
                submittedBy: sciUser._id,
                amount:      50000,
                category:    'Lab Equipment',
                description: 'Quantum Spectrometer repair and calibration',
                status:      'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-08-20'),
                date:        new Date('2025-08-15')
            },
            {
                department:  eng._id,
                submittedBy: engUser._id,
                amount:      120000,
                category:    'Software',
                description: 'CAD & Simulation licenses for FY26 semester',
                status:      'pending',
                date:        new Date('2025-09-01')
            },
            {
                department:  hum._id,
                submittedBy: humUser._id,
                amount:      5000,
                category:    'Travel & Events',
                description: 'Academic conference in Paris — 2 faculty members',
                status:      'rejected',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-07-25'),
                date:        new Date('2025-07-20')
            },
            {
                department:  sci._id,
                submittedBy: sciUser._id,
                amount:      75000,
                category:    'Research Support',
                description: 'AI & ML Research Grant co-funding round',
                status:      'pending',
                date:        new Date('2025-09-10')
            },
            {
                department:  eng._id,
                submittedBy: engUser._id,
                amount:      30000,
                category:    'Infrastructure',
                description: 'Server rack expansion — Phase 2 of data center upgrade',
                status:      'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-09-02'),
                date:        new Date('2025-08-28')
            },
            {
                department:  art._id,
                submittedBy: artUser._id,
                amount:      15000,
                category:    'Office Supplies',
                description: 'Studio equipment — canvas, pigments, digital stylus',
                status:      'approved',
                reviewedBy:  admin._id,
                reviewedAt:  new Date('2025-08-10'),
                date:        new Date('2025-08-05')
            }
        ]);
        console.log(`✅ Created ${requests.length} budget requests`);

        /* ── Summary ── */
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉  Seed completed successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Login Credentials:');
        console.log('  Admin    → admin@budgetwise.in  | Admin@123');
        console.log('  Science  → sci@budgetwise.in    | Dept@123');
        console.log('  Engg     → eng@budgetwise.in    | Dept@123');
        console.log('  Humanities → hum@budgetwise.in  | Dept@123');
        console.log('  Arts     → art@budgetwise.in    | Dept@123\n');
        console.log('🌐 Frontend: http://localhost:5173');
        console.log('📡 API:      http://localhost:5000/api/health');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        mongoose.connection.close();
    }
};

seed();
