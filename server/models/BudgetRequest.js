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
        // Workflow status – use uppercase constants for clarity
        status: {
            type: String,
            enum: [
                'PENDING',          // Dept Head submitted
                'UNDER_REVIEW',    // Finance Officer reviewing
                'FINANCE_APPROVED',// Passed to Admin
                'REJECTED',        // Finance or Admin rejected
                'FINAL_APPROVED',  // Admin final approval
                'NEEDS_REVISION',  // Finance asks for changes
                'approved',        // Legacy / admin direct approval
                'rejected',        // Legacy / admin direct rejection
                'pending'          // Legacy compatibility
            ],
            default: 'PENDING'
        },
        // Request urgency
        priority: {
            type: String,
            enum: ['low', 'normal', 'urgent'],
            default: 'normal'
        },
        // Compatibility shim – keep older field for any legacy queries (optional)
        workflowState: {
            type: String,
            enum: ['pending_dept_head', 'pending_finance', 'approved', 'rejected'],
            default: 'pending_dept_head'
        },
        // Verification of attached docs by Finance Officer
        verification: {
            status: {
                type: String,
                enum: ['VERIFIED', 'INCOMPLETE', 'SUSPICIOUS'],
                default: 'INCOMPLETE'
            },
            reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        },
        // Structured review history (Finance & Admin actions)
        reviews: [
            {
                reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                role: { type: String, enum: ['finance', 'admin'] },
                action: { type: String, enum: ['approved', 'rejected', 'revision_requested'] },
                comment: { type: String, required: true },
                timestamp: { type: Date, default: Date.now }
            }
        ],
        institution: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: [true, 'Institution context is required']
        },
        attachments: [
            {
                filename: String,
                url: String
            }
        ],
        versionHistory: [
            {
                modifiedAt: { type: Date, default: Date.now },
                previousAmount: Number,
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
            }
        ],
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
        },
        comments: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },
                text: {
                    type: String,
                    required: true,
                    trim: true
                },
                date: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
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
