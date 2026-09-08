import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    categoryId: { type: String, required: true, index: true },
    zone: { type: String, default: '', index: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    latitude: { type: Number, required: true, default: 0 },
    longitude: { type: Number, required: true, default: 0 },
    priceRange: { type: String, default: '$' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    promoText: { type: String, default: '' },
    promoStart: { type: String, default: '' },
    promoEnd: { type: String, default: '' },
    hours: { type: Map, of: String, default: {} },
    photoUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Business', businessSchema);