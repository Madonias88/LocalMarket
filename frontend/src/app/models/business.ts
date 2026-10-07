export interface BusinessPromo {
  titulo: string;
  descuento?: string;
  desde?: string;
  hasta?: string;
}

export interface BusinessHoursRow {
  dia: string;
  abre: string;
  cierra: string;
  cerrado: boolean;
}

export interface Business {
  _id?: string;
  name: string;
  description: string;
  categoryId: string;
  zone?: string;
  address: string;
  phone: string;
  whatsapp: string;
  latitude: number;
  longitude: number;
  priceRange: string;
  rating: number;
  verified: boolean;
  featured: boolean;
  active?: boolean;
  promoText?: string;
  promoStart?: string;
  promoEnd?: string;
  hours?: Record<string, string>;
  photoUrls?: string[];
  createdAt?: string;

  // --- Contacto y redes ---
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;

  // --- Servicios y etiquetas ---
  servicios?: string[];
  tags?: string[];

  // --- Entregas y pagos ---
  delivery?: boolean;
  deliveryZones?: string[];
  deliveryFee?: number;
  minOrder?: number;
  paymentMethods?: string[];

  // --- Popularidad ---
  viewsCount?: number;
  reviewCount?: number;

  // --- Ofertas y horarios estructurados ---
  promos?: BusinessPromo[];
  openingHours?: BusinessHoursRow[];
}