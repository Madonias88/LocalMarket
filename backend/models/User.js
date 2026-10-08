import mongoose from 'mongoose';

/**
 * Cuentas del sistema.
 * - role 'admin': control total (panel de administracion).
 * - role 'owner': gestiona UNICAMENTE su negocio (campo businessId).
 */
const userSchema = new mongoose.Schema(
  {
    _id: { type: String },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: { type: String, default: '', trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'owner'], default: 'owner' },
    businessId: { type: String, default: '' },
    businessIds: { type: [String], default: [] },
    name: { type: String, default: '' },
    active: { type: Boolean, default: true },
    resetPasswordCode: { type: String, default: '' },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);