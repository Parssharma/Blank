import mongoose from 'mongoose';

const institutionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Institution name is required'],
            trim: true
        },
        domain: {
            type: String,
            required: [true, 'Domain name is required'],
            unique: true,
            trim: true,
            lowercase: true
        },
        subscriptionPlan: {
            type: String,
            enum: ['basic', 'premium', 'enterprise'],
            default: 'basic'
        },
        settings: {
            fiscalYearStart: {
                type: String,
                default: '04-01' // April 1st
            },
            currency: {
                type: String,
                default: 'INR'
            },
            branding: {
                logo: { type: String, default: '' },
                primaryColor: { type: String, default: '#7C3AED' }
            },
            alertThresholds: {
                budgetWarning: { type: Number, default: 80 },   // percent
                budgetCritical: { type: Number, default: 95 }
            }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

export default mongoose.model('Institution', institutionSchema);
