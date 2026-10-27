import mongoose from 'mongoose';

/** Resena de un usuario sobre un negocio. `approved: false` = en moderacion. */
const reviewSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
    approved: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Review', reviewSchema);