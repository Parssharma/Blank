import mongoose from 'mongoose';

const CATEGORIES = [
    'Lab Equipment',
    'Research Support',
    'Infrastructure',
    'Travel & Events',
    'Office Supplies',
    'Software'
];

const budgetRequestSchema = new mongoose.Schema(
    {
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: [true, 'Department is required']
        },
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Submitter is required']
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be at least ₹1']
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            enum: { values: CATEGORIES, message: '{VALUE} is not a valid category' }
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

/* ── Indexes for common queries ── */
budgetRequestSchema.index({ department: 1, status: 1 });
budgetRequestSchema.index({ submittedBy: 1 });
budgetRequestSchema.index({ date: -1 });

export const BUDGET_CATEGORIES = CATEGORIES;
export default mongoose.model('BudgetRequest', budgetRequestSchema);
