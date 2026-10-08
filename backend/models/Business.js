import mongoose from 'mongoose';

// Oferta estructurada (varias por negocio): título, descuento y vigencia.
// Fechas en formato YYYY-MM-DD ('' = sin límite).
const promoSchema = new mongoose.Schema(
  {
    titulo: { type: String, default: '' },
    descuento: { type: String, default: '' },
    desde: { type: String, default: '' },
    hasta: { type: String, default: '' },
  },
  { _id: false }
);

// Horario estructurado por tramo/duración (ej. "Lunes a Viernes").
const openingHoursSchema = new mongoose.Schema(
  {
    dia: { type: String, default: '' },
    abre: { type: String, default: '' }, // HH:MM
    cierra: { type: String, default: '' }, // HH:MM
    cerrado: { type: Boolean, default: false },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    _id: { type: String },
    ownerUsername: { type: String, default: '', index: true },
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

    // --- Contacto y redes ---
    email: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    instagram: { type: String, default: '', trim: true },
    facebook: { type: String, default: '', trim: true },

    // --- Servicios y etiquetas ---
    servicios: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    // --- Entregas y pagos ---
    delivery: { type: Boolean, default: false },
    deliveryZones: { type: [String], default: [] },
    deliveryFee: { type: Number, default: 0, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    paymentMethods: { type: [String], default: [] },

    // --- Popularidad ---
    viewsCount: { type: Number, default: 0, min: 0 },
    reviewCount: { type: Number, default: 0, min: 0 },

    // --- Ofertas y horarios estructurados ---
    promos: { type: [promoSchema], default: [] },
    openingHours: { type: [openingHoursSchema], default: [] },

    hours: { type: Map, of: String, default: {} },
    photoUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Business', businessSchema);