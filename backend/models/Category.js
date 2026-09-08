import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Category', categorySchema);