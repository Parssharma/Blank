import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Department name is required'],
            unique: true,
            trim: true
        },
        head: {
            type: String,
            required: [true, 'Department head is required'],
            trim: true
        },
        budget: {
            type: Number,
            required: [true, 'Budget is required'],
            min: [0, 'Budget cannot be negative']
        },
        spent: {
            type: Number,
            default: 0,
            min: [0, 'Spent cannot be negative']
        },
        fiscalYear: {
            type: String,
            default: () => {
                const now = new Date();
                const y = now.getFullYear();
                return now.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
            }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

/* ── Virtuals ── */
departmentSchema.virtual('remaining').get(function () {
    return Math.max(0, this.budget - this.spent);
});

departmentSchema.virtual('utilizationPct').get(function () {
    if (!this.budget || this.budget === 0) return 0;
    return Math.round((this.spent / this.budget) * 100);
});

export default mongoose.model('Department', departmentSchema);
