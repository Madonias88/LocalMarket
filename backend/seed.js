import { config } from 'dotenv';
config({ override: true });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Business from './models/Business.js';
import Category from './models/Category.js';
import Review from './models/Review.js';
import User from './models/User.js';

/**
 * Carga datos de ejemplo en MongoDB Local. Es idempotente: cada documento
 * usa un _id fijo (slug) y sobrescribe los existentes (upsert), por lo que
 * ejecutarlo varias veces NO duplica datos.
 *
 * Uso: npm run seed
 */

const categories = [
  { _id: 'restaurantes', name: 'Restaurantes', icon: 'comida' },
  { _id: 'salud', name: 'Salud', icon: 'salud' },
  { _id: 'talleres', name: 'Talleres', icon: 'talleres' },
  { _id: 'profesionales', name: 'Profesionales', icon: 'profesionales' },
  { _id: 'comercios', name: 'Comercios', icon: 'comercios' },
  { _id: 'belleza', name: 'Belleza', icon: 'belleza' },
  { _id: 'tecnologia', name: 'Tecnología', icon: 'tecnologia' },
  { _id: 'servicios', name: 'Servicios', icon: 'servicios' },
];

// Mismo catalogo de negocios que la version Android: San Raymundo,
// San Juan Sacatepequez, Ciudad Quetzal y Ciudad de Guatemala.
const businesses = [
  // ---------- San Raymundo ----------
  {
    _id: 'comedor-mili-san-raymundo',
    name: 'Comedor Doña Mili',
    description: 'Desayunos y almuerzos caseros: pepián, hilachas, carnitas y caldos. Comida del día a precio popular.',
    categoryId: 'restaurantes',
    address: '4a. Calle 3-12, Barrio El Centro, San Raymundo',
    phone: '50255240111',
    whatsapp: '50255240111',
    latitude: 14.7645,
    longitude: -90.5945,
    priceRange: '$',
    rating: 4.5,
    verified: true,
    featured: true,
    hours: { 'Lunes a Viernes': '06:30 - 15:00', Sábado: '06:30 - 14:00', Domingo: 'Cerrado' },
    photoUrls: [
      'https://picsum.photos/seed/gt-comedor1/600/400',
      'https://picsum.photos/seed/gt-comedor2/600/400',
    ],
    email: 'comedormili@gmail.com',
    website: 'https://comedormili.gt',
    instagram: '@comedormili',
    facebook: 'Comedor Doña Mili',
    servicios: ['Desayunos', 'Almuerzos', 'Comida del día', 'Pepián', 'Caldos'],
    tags: ['casero', 'comida típica', 'desayunos', 'económico'],
    delivery: true,
    deliveryZones: ['San Raymundo'],
    deliveryFee: 5,
    minOrder: 40,
    paymentMethods: ['efectivo', 'transferencia'],
    viewsCount: 420,
    reviewCount: 28,
    promos: [{ titulo: 'Comida del día por Q25', descuento: 'Combo', desde: '', hasta: '' }],
  },
  {
    _id: 'farmacia-san-raymundo',
    name: 'Farmacia San Raymundo',
    description: 'Medicamentos, vitaminas y productos de higiene. Entrega a domicilio dentro del casco urbano.',
    categoryId: 'salud',
    address: '1a. Avenida 6-18, frente al parque, San Raymundo',
    phone: '50255270112',
    whatsapp: '50255270112',
    latitude: 14.7652,
    longitude: -90.5958,
    priceRange: '$$',
    rating: 4.3,
    verified: true,
    featured: true,
    hours: { 'Lunes a Domingo': '07:00 - 21:00' },
    photoUrls: ['https://picsum.photos/seed/gt-farm1/600/400'],
    email: 'farmaciasr@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Farmacia San Raymundo',
    servicios: ['Medicamentos', 'Vitaminas', 'Primeros auxilios', 'Toma de presión'],
    tags: ['farmacia', 'salud', 'entrega a domicilio'],
    delivery: true,
    deliveryZones: ['San Raymundo'],
    deliveryFee: 0,
    minOrder: 15,
    paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
    viewsCount: 510,
    reviewCount: 35,
  },
  {
    _id: 'ferreteria-el-constructor',
    name: 'Ferretería El Constructor',
    description: 'Materiales de construcción, herramientas, pintura y plomería. Presupuestos y entregas en obra.',
    categoryId: 'comercios',
    address: 'Carretera a El Chol km 24, San Raymundo',
    phone: '50255120113',
    whatsapp: '50255120113',
    latitude: 14.7633,
    longitude: -90.5937,
    priceRange: '$$$',
    rating: 4.1,
    verified: false,
    featured: false,
    hours: { 'Lunes a Viernes': '07:30 - 18:00', Sábado: '07:30 - 15:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-ferre1/600/400'],
    email: 'ventas@elconstructor.gt',
    website: 'https://elconstructor.gt',
    instagram: '',
    facebook: 'Ferretería El Constructor',
    servicios: ['Materiales de construcción', 'Herramientas', 'Pintura', 'Plomería'],
    tags: ['ferretería', 'construcción', 'herramientas'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta', 'crédito'],
    viewsCount: 380,
    reviewCount: 22,
  },
  {
    _id: 'taller-don-tono-sr',
    name: 'Taller Mecánico Don Toño',
    description: 'Reparación de motor, frenos y suspensión. Cambio de aceite y diagnóstico con escáner.',
    categoryId: 'talleres',
    address: '2a. Calle 5-20, Colonia El Rosario, San Raymundo',
    phone: '50255310114',
    whatsapp: '50255310114',
    latitude: 14.766,
    longitude: -90.5963,
    priceRange: '$$',
    rating: 4.2,
    verified: false,
    featured: false,
    hours: { 'Lunes a Viernes': '08:00 - 18:00', Sábado: '08:00 - 13:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-taller1/600/400'],
    email: 'tallerdontono@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Taller Don Toño',
    servicios: ['Cambio de aceite', 'Frenos', 'Suspensión', 'Diagnóstico con escáner', 'Motor'],
    tags: ['mecánica', 'taller', 'diagnóstico'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'transferencia'],
    viewsCount: 310,
    reviewCount: 19,
  },
  {
    _id: 'barberia-el-raymundo',
    name: 'Barbería El Raymundo',
    description: 'Cortes clásicos y modernos, arreglo de barba y tintes. Estilo sin cita previa.',
    categoryId: 'belleza',
    address: '3a. Calle 2-08, Barrio El Centro, San Raymundo',
    phone: '50255780115',
    whatsapp: '50255780115',
    latitude: 14.7642,
    longitude: -90.5952,
    priceRange: '$',
    rating: 4.4,
    verified: false,
    featured: false,
    hours: { 'Lunes a Sábado': '09:00 - 19:00', Domingo: '09:00 - 14:00' },
    photoUrls: ['https://picsum.photos/seed/gt-barber1/600/400'],
    email: 'raymundo.barber@gmail.com',
    website: '',
    instagram: '@barberiaelraymundo',
    facebook: 'Barbería El Raymundo',
    servicios: ['Corte clásico', 'Corte moderno', 'Arreglo de barba', 'Tintes'],
    tags: ['barbería', 'belleza', 'cortes'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo'],
    viewsCount: 275,
    reviewCount: 16,
  },

  // ---------- San Juan Sacatepéquez ----------
  {
    _id: 'cafe-la-estacion-sjs',
    name: 'Cafetería La Estación',
    description: 'Café de la región, repostería casera y desayunos. Hermoso ambiente junto al parque central.',
    categoryId: 'restaurantes',
    address: '4a. Calle 3-50, Zona 1, San Juan Sacatepéquez',
    phone: '50255450116',
    whatsapp: '50255450116',
    latitude: 14.7186,
    longitude: -90.6438,
    priceRange: '$$',
    rating: 4.6,
    verified: true,
    featured: true,
    hours: { 'Lunes a Viernes': '07:00 - 20:00', 'Sábado y Domingo': '08:00 - 21:00' },
    photoUrls: [
      'https://picsum.photos/seed/gt-cafe1/600/400',
      'https://picsum.photos/seed/gt-cafe2/600/400',
    ],
    email: 'cafeestacion@gmail.com',
    website: '',
    instagram: '@cafelaestacion',
    facebook: 'Cafetería La Estación',
    servicios: ['Café de la región', 'Repostería casera', 'Desayunos', 'Postres'],
    tags: ['cafetería', 'desayunos', 'repostería', 'tranquilo'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta'],
    viewsCount: 640,
    reviewCount: 41,
    promos: [{ titulo: 'Café y pastel por Q30', descuento: 'Combo', desde: '', hasta: '2026-09-30' }],
  },
  {
    _id: 'farmacia-san-juan',
    name: 'Farmacia San Juan',
    description: 'Medicamentos genéricos y de patente, servicio de presión y glucosa gratuita.',
    categoryId: 'salud',
    address: '6a. Avenida 5-12, Zona 1, San Juan Sacatepéquez',
    phone: '50255820117',
    whatsapp: '50255820117',
    latitude: 14.7194,
    longitude: -90.6449,
    priceRange: '$$',
    rating: 4.2,
    verified: true,
    featured: false,
    hours: { 'Lunes a Domingo': '07:00 - 20:30' },
    photoUrls: ['https://picsum.photos/seed/gt-farm2/600/400'],
    email: 'farmaciasanjuan@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Farmacia San Juan',
    servicios: ['Medicamentos', 'Genéricos', 'Toma de presión', 'Glucosa'],
    tags: ['farmacia', 'salud'],
    delivery: true,
    deliveryZones: ['San Juan Sacatepéquez'],
    deliveryFee: 0,
    minOrder: 10,
    paymentMethods: ['efectivo', 'tarjeta'],
    viewsCount: 330,
    reviewCount: 21,
  },
  {
    _id: 'panaderia-dona-julia',
    name: 'Panadería Doña Julia',
    description: 'Pan artesanal, galletas, tradicionales y pasteles por encargo. Pan caliente cada mañana.',
    categoryId: 'comercios',
    address: '2a. Calle 4-08, Barrio La Libertad, San Juan Sacatepéquez',
    phone: '50255900118',
    whatsapp: '50255900118',
    latitude: 14.718,
    longitude: -90.6445,
    priceRange: '$',
    rating: 4.5,
    verified: false,
    featured: false,
    hours: { 'Lunes a Sábado': '06:00 - 18:00', Domingo: '06:00 - 13:00' },
    photoUrls: ['https://picsum.photos/seed/gt-pan1/600/400'],
    email: 'panjulia@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Panadería Doña Julia',
    servicios: ['Pan artesanal', 'Galletas', 'Pan tradicional', 'Pasteles por encargo'],
    tags: ['panadería', 'pan caliente', 'postres'],
    delivery: true,
    deliveryZones: ['San Juan Sacatepéquez'],
    deliveryFee: 3,
    minOrder: 20,
    paymentMethods: ['efectivo', 'transferencia'],
    viewsCount: 290,
    reviewCount: 17,
  },
  {
    _id: 'envios-san-juan',
    name: 'Envíos y Paquetería San Juan',
    description: 'Paquetería nacional, giros y encomiendas. Recolección en tu casa con aviso por WhatsApp.',
    categoryId: 'servicios',
    address: '8a. Avenida 4-33, zona de mercado, San Juan Sacatepéquez',
    phone: '50255290119',
    whatsapp: '50255290119',
    latitude: 14.7192,
    longitude: -90.6431,
    priceRange: '$$',
    rating: 4.0,
    verified: false,
    featured: false,
    hours: { 'Lunes a Viernes': '08:00 - 18:00', Sábado: '08:00 - 14:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-envio1/600/400'],
    email: 'enviosanju@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Envíos y Paquetería San Juan',
    servicios: ['Paquetería nacional', 'Giros', 'Encomiendas', 'Recolección a domicilio'],
    tags: ['envíos', 'paquetería', 'logística'],
    delivery: true,
    deliveryZones: ['San Juan Sacatepéquez', 'San Raymundo'],
    deliveryFee: 10,
    minOrder: 0,
    paymentMethods: ['efectivo', 'transferencia'],
    viewsCount: 450,
    reviewCount: 30,
    promos: [{ titulo: 'Recolección gratis en la zona', descuento: 'Gratis', desde: '', hasta: '2026-12-31' }],
  },
  {
    _id: 'estetica-flor-de-liz',
    name: 'Estética Flor de Liz',
    description: 'Cortes, manicure, pedicure, cejas y tratamientos faciales. Precios accesibles.',
    categoryId: 'belleza',
    address: '1a. Calle 6-21, Zona 1, San Juan Sacatepéquez',
    phone: '50255610120',
    whatsapp: '50255610120',
    latitude: 14.7176,
    longitude: -90.6449,
    priceRange: '$',
    rating: 4.3,
    verified: false,
    featured: false,
    hours: { 'Lunes a Sábado': '09:00 - 19:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-estet1/600/400'],
    email: 'flordeliz@gmail.com',
    website: '',
    instagram: '@esteticaflordeliz',
    facebook: 'Estética Flor de Liz',
    servicios: ['Cortes', 'Manicure', 'Pedicure', 'Cejas', 'Tratamientos faciales'],
    tags: ['estética', 'uñas', 'belleza'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta'],
    viewsCount: 205,
    reviewCount: 12,
  },

  // ---------- Ciudad Quetzal ----------
  {
    _id: 'restaurante-la-ceiba',
    name: 'Restaurante La Ceiba',
    description: 'Comida guatemalteca y antojitos: chuchitos, tamales, rellenitos y platos típicos. Música en vivo los sábados.',
    categoryId: 'restaurantes',
    address: '5a. Calle 2-15, Ciudad Quetzal',
    phone: '50255720121',
    whatsapp: '50255720121',
    latitude: 14.699,
    longitude: -90.5785,
    priceRange: '$$',
    rating: 4.7,
    verified: true,
    featured: true,
    hours: { 'Lunes a Jueves': '11:00 - 21:00', 'Viernes y Sábado': '11:00 - 23:00', Domingo: '11:00 - 20:00' },
    photoUrls: [
      'https://picsum.photos/seed/gt-ceiba1/600/400',
      'https://picsum.photos/seed/gt-ceiba2/600/400',
    ],
    email: 'laceiba.rest@gmail.com',
    website: '',
    instagram: '@restaurantelaceiba',
    facebook: 'Restaurante La Ceiba',
    servicios: ['Chuchitos', 'Tamales', 'Rellenitos', 'Platos típicos', 'Música en vivo'],
    tags: ['comida típica', 'antojitos', 'familiar'],
    delivery: true,
    deliveryZones: ['Ciudad Quetzal'],
    deliveryFee: 8,
    minOrder: 60,
    paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
    viewsCount: 780,
    reviewCount: 52,
    promos: [{ titulo: '2x1 en chuchitos los sábados', descuento: '2x1', desde: '', hasta: '2026-12-31' }],
  },
  {
    _id: 'consultorio-medico-vida',
    name: 'Consultorio Médico Vida',
    description: 'Consulta general, control de niño sano y enfermedades crónicas. Citas por WhatsApp y expediente digital.',
    categoryId: 'salud',
    address: 'Avenida Principal 3-08, Ciudad Quetzal',
    phone: '50255380122',
    whatsapp: '50255380122',
    latitude: 14.6998,
    longitude: -90.5796,
    priceRange: '$$$',
    rating: 4.8,
    verified: true,
    featured: false,
    hours: { 'Lunes a Viernes': '08:00 - 17:00', Sábado: '08:00 - 12:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-med1/600/400'],
    email: 'consultoriovida@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Consultorio Médico Vida',
    servicios: ['Consulta general', 'Control de niño sano', 'Enfermedades crónicas', 'Expediente digital'],
    tags: ['médico', 'salud', 'citas'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'transferencia'],
    viewsCount: 560,
    reviewCount: 38,
  },
  {
    _id: 'ferreteria-el-vecino',
    name: 'Ferretería y Abarrotes El Vecino',
    description: 'Venta de abarrotes, ferretería y productos de limpieza. Crédito de fiado para vecinos de confianza.',
    categoryId: 'comercios',
    address: '3a. Calle 1-22, Colonia San Juan, Ciudad Quetzal',
    phone: '50255890123',
    whatsapp: '50255890123',
    latitude: 14.6987,
    longitude: -90.5777,
    priceRange: '$',
    rating: 4.1,
    verified: false,
    featured: false,
    hours: { 'Lunes a Domingo': '06:30 - 21:00' },
    photoUrls: ['https://picsum.photos/seed/gt-abarro1/600/400'],
    email: '',
    website: '',
    instagram: '',
    facebook: '',
    servicios: ['Abarrotes', 'Ferretería', 'Productos de limpieza', 'Fiado'],
    tags: ['tienda', 'abarrotes', 'limpieza'],
    delivery: true,
    deliveryZones: ['Ciudad Quetzal'],
    deliveryFee: 3,
    minOrder: 30,
    paymentMethods: ['efectivo', 'fiado'],
    viewsCount: 265,
    reviewCount: 14,
  },
  {
    _id: 'lavanderia-burbuja-ctq',
    name: 'Lavandería Burbuja',
    description: 'Lavado y secado por kilo, planchado y tintorería. Recogida y entrega a domicilio en Ciudad Quetzal.',
    categoryId: 'servicios',
    address: '2a. Calle 4-10, Zona de servicios, Ciudad Quetzal',
    phone: '50255530124',
    whatsapp: '50255530124',
    latitude: 14.7,
    longitude: -90.579,
    priceRange: '$',
    rating: 4.2,
    verified: false,
    featured: false,
    hours: { 'Lunes a Sábado': '07:30 - 19:00', Domingo: '08:00 - 14:00' },
    photoUrls: ['https://picsum.photos/seed/gt-lav1/600/400'],
    email: 'burbuja.lav@gmail.com',
    website: '',
    instagram: '',
    facebook: 'Lavandería Burbuja',
    servicios: ['Lavado por kilo', 'Secado', 'Planchado', 'Tintorería', 'Recogida a domicilio'],
    tags: ['lavandería', 'limpieza', 'tintorería'],
    delivery: true,
    deliveryZones: ['Ciudad Quetzal'],
    deliveryFee: 5,
    minOrder: 0,
    paymentMethods: ['efectivo'],
    viewsCount: 195,
    reviewCount: 11,
  },
  {
    _id: 'techfix-ciudad-quetzal',
    name: 'TechFix Reparación de Celulares',
    description: 'Cambio de pantallas, baterías y reparación de software. Diagnóstico gratis y garantía escrita.',
    categoryId: 'tecnologia',
    address: 'Avenida Central 2-30, Ciudad Quetzal',
    phone: '50255170125',
    whatsapp: '50255170125',
    latitude: 14.6994,
    longitude: -90.5801,
    priceRange: '$$',
    rating: 4.4,
    verified: false,
    featured: true,
    hours: { 'Lunes a Viernes': '09:00 - 19:00', Sábado: '09:00 - 17:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-tech1/600/400'],
    email: 'techfix.cq@gmail.com',
    website: '',
    instagram: '@techfixgt',
    facebook: 'TechFix Reparación de Celulares',
    servicios: ['Cambio de pantalla', 'Baterías', 'Reparación de software', 'Diagnóstico gratis'],
    tags: ['celulares', 'reparación', 'tecnología'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
    viewsCount: 605,
    reviewCount: 44,
    promos: [{ titulo: '20% de descuento en cambio de pantalla', descuento: '20%', desde: '', hasta: '2026-10-31' }],
  },

  // ---------- Ciudad de Guatemala ----------
  {
    _id: 'despacho-juridico-torres',
    name: 'Despacho Jurídico Torres y Asociados',
    description: 'Asesoría legal en derecho penal, civil, laboral y de familia. Primera consulta informativa gratuita.',
    categoryId: 'profesionales',
    address: '6a. Avenida 10-15, Zona 1, Edificio Torre Azul, Ciudad de Guatemala',
    phone: '50255660126',
    whatsapp: '50255660126',
    latitude: 14.6426,
    longitude: -90.5133,
    priceRange: '$$$',
    rating: 4.7,
    verified: true,
    featured: false,
    hours: { 'Lunes a Viernes': '09:00 - 18:00', Sábado: 'Cita previa', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-despacho1/600/400'],
    email: 'torres@despachot.gt',
    website: 'https://despachot.gt',
    instagram: '',
    facebook: 'Despacho Jurídico Torres',
    servicios: ['Asesoría penal', 'Asesoría civil', 'Asesoría laboral', 'Asesoría de familia', 'Primera consulta gratis'],
    tags: ['abogados', 'legal', 'consultoría'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'transferencia', 'tarjeta'],
    viewsCount: 540,
    reviewCount: 26,
  },
  {
    _id: 'restaurante-el-faisan',
    name: 'Restaurante El Faisán',
    description: "Platos típicos de alta cocina guatemalteca: kak'ik, jocón, subanik y arroz negro. Ambiente familiar.",
    categoryId: 'restaurantes',
    address: '13 Calle 3-40, Zona 10, Ciudad de Guatemala',
    phone: '50255220127',
    whatsapp: '50255220127',
    latitude: 14.602,
    longitude: -90.5185,
    priceRange: '$$$',
    rating: 4.8,
    verified: true,
    featured: true,
    hours: { 'Lunes a Jueves': '12:00 - 22:00', 'Viernes y Sábado': '12:00 - 23:00', Domingo: '12:00 - 21:00' },
    photoUrls: [
      'https://picsum.photos/seed/gt-faisan1/600/400',
      'https://picsum.photos/seed/gt-faisan2/600/400',
    ],
    email: 'reservas@elfaisan.gt',
    website: 'https://elfaisan.gt',
    instagram: '@restauranteelfaisan',
    facebook: 'Restaurante El Faisán',
    servicios: ["Kak'ik", 'Jocón', 'Subanik', 'Arroz negro', 'Alta cocina'],
    tags: ['gastronomía', 'cocina típica', 'familiar'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta'],
    viewsCount: 890,
    reviewCount: 63,
    promos: [{ titulo: 'Menú degustación con 10%', descuento: '10%', desde: '', hasta: '2026-12-15' }],
  },
  {
    _id: 'gimnasio-iron-sport',
    name: 'Gimnasio Iron Sport',
    description: 'Sala de pesas, cardio, clases grupales y nutrición. Plan mensual sin permanencia.',
    categoryId: 'servicios',
    address: 'Vía 4 4-55, Zona 4, Ciudad de Guatemala',
    phone: '50255490128',
    whatsapp: '50255490128',
    latitude: 14.617,
    longitude: -90.528,
    priceRange: '$$$',
    rating: 4.3,
    verified: false,
    featured: false,
    hours: { 'Lunes a Viernes': '05:00 - 22:00', Sábado: '06:00 - 20:00', Domingo: '07:00 - 12:00' },
    photoUrls: ['https://picsum.photos/seed/gt-gym1/600/400'],
    email: 'info@ironsport.gt',
    website: 'https://ironsport.gt',
    instagram: '@gimnasioironsport',
    facebook: 'Gimnasio Iron Sport',
    servicios: ['Pesas', 'Cardio', 'Clases grupales', 'Nutrición'],
    tags: ['gimnasio', 'fitness', 'deporte'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
    viewsCount: 520,
    reviewCount: 33,
    promos: [{ titulo: 'Primer mes a mitad de precio', descuento: '50%', desde: '', hasta: '2026-12-31' }],
  },
  {
    _id: 'libreria-el-pensativo',
    name: 'Librería El Pensativo',
    description: 'Libros guatemaltecos, historia, literatura y papelería fina. Rincón de lectura y pedidos especiales.',
    categoryId: 'comercios',
    address: '9a. Calle 6-36, Zona 1, Ciudad de Guatemala',
    phone: '50255800129',
    whatsapp: '50255800129',
    latitude: 14.641,
    longitude: -90.5145,
    priceRange: '$$',
    rating: 4.6,
    verified: false,
    featured: false,
    hours: { 'Lunes a Viernes': '09:00 - 19:00', Sábado: '09:00 - 17:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-libreria1/600/400'],
    email: 'libreriaelpensativo@gmail.com',
    website: '',
    instagram: '@el_pensativo',
    facebook: 'Librería El Pensativo',
    servicios: ['Libros guatemaltecos', 'Historia', 'Literatura', 'Papelería fina', 'Pedidos especiales'],
    tags: ['librería', 'libros', 'cultura'],
    delivery: true,
    deliveryZones: ['Ciudad de Guatemala'],
    deliveryFee: 8,
    minOrder: 50,
    paymentMethods: ['efectivo', 'tarjeta'],
    viewsCount: 345,
    reviewCount: 18,
  },
  {
    _id: 'clinica-dental-sonrisa',
    name: 'Clínica Dental Sonrisa',
    description: 'Limpieza, blanqueamiento, ortodoncia y empastes. Equipo moderno y planes financiados.',
    categoryId: 'salud',
    address: '12 Calle 2-16, Zona 10, Ciudad de Guatemala',
    phone: '50255150130',
    whatsapp: '50255150130',
    latitude: 14.5995,
    longitude: -90.516,
    priceRange: '$$$',
    rating: 4.7,
    verified: true,
    featured: false,
    hours: { 'Lunes a Viernes': '08:00 - 18:00', Sábado: '08:00 - 14:00', Domingo: 'Cerrado' },
    photoUrls: ['https://picsum.photos/seed/gt-dental1/600/400'],
    email: 'citas@sonrisa.gt',
    website: 'https://sonrisa.gt',
    instagram: '@clinica.sonrisa',
    facebook: 'Clínica Dental Sonrisa',
    servicios: ['Limpieza dental', 'Blanqueamiento', 'Ortodoncia', 'Empastes', 'Planes financiados'],
    tags: ['dentista', 'salud', 'sonrisa'],
    delivery: false,
    deliveryZones: [],
    deliveryFee: 0,
    minOrder: 0,
    paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
    viewsCount: 470,
    reviewCount: 37,
  },
];

// Promociones de ejemplo (activadas por fecha). Solo para la demo.
const promos = {
  'cafe-la-estacion-sjs': { promoText: 'Café y pastel por Q30', promoStart: '', promoEnd: '2026-09-30' },
  'restaurante-la-ceiba': { promoText: '2x1 en chuchitos los sábados', promoStart: '', promoEnd: '2026-12-31' },
  'techfix-ciudad-quetzal': { promoText: '20% de descuento en cambio de pantalla', promoStart: '', promoEnd: '2026-10-31' },
  'gimnasio-iron-sport': { promoText: 'Primer mes a mitad de precio', promoStart: '', promoEnd: '2026-12-31' },
};

// Resenas de ejemplo: aprobadas (visibles) y pendientes (para moderar en admin)
const reviews = [
  { _id: 'rev-comedor-1', businessId: 'comedor-mili-san-raymundo', userName: 'Rosa M.', rating: 5, comment: 'El pepián es delicioso y el trato es muy amable. Excelente precio.', approved: true },
  { _id: 'rev-comedor-2', businessId: 'comedor-mili-san-raymundo', userName: 'Carlos G.', rating: 4, comment: 'Buena comida casera, porciones generosas.', approved: true },
  { _id: 'rev-comedor-3', businessId: 'comedor-mili-san-raymundo', userName: 'Lucía P.', rating: 5, comment: 'Los caldos los mejores de San Raymundo.', approved: false },
  { _id: 'rev-ceiba-1', businessId: 'restaurante-la-ceiba', userName: 'María F.', rating: 5, comment: 'Los chuchitos están para chuparse los dedos.', approved: true },
  { _id: 'rev-ceiba-2', businessId: 'restaurante-la-ceiba', userName: 'Diego R.', rating: 4, comment: 'Ambiente agradable y música en vivo los sábados.', approved: true },
  { _id: 'rev-techfix-1', businessId: 'techfix-ciudad-quetzal', userName: 'Jorge A.', rating: 5, comment: 'Me cambiaron la pantalla el mismo día, con garantía.', approved: true },
  { _id: 'rev-techfix-2', businessId: 'techfix-ciudad-quetzal', userName: 'Elena S.', rating: 4, comment: 'Buen servicio, diagnóstico honesto.', approved: false },
  { _id: 'rev-cafe-1', businessId: 'cafe-la-estacion-sjs', userName: 'Pedro L.', rating: 5, comment: 'El café de la región está espectacular.', approved: true },
  { _id: 'rev-cafe-2', businessId: 'cafe-la-estacion-sjs', userName: 'Ana V.', rating: 5, comment: 'Mi lugar favorito para desayunar los domingos.', approved: false },
  { _id: 'rev-consulta-1', businessId: 'consultorio-medico-vida', userName: 'Sofía B.', rating: 5, comment: 'La doctora es muy atenta y las citas son puntuales.', approved: true },
  { _id: 'rev-consulta-2', businessId: 'consultorio-medico-vida', userName: 'Fernando T.', rating: 4, comment: 'Muy buen trato y precios justos.', approved: true },
  { _id: 'rev-lavanderia-1', businessId: 'lavanderia-burbuja-ctq', userName: 'Karla D.', rating: 5, comment: 'Ropa limpia y bien doblada, entregan a domicilio.', approved: false },
  { _id: 'rev-faisan-1', businessId: 'restaurante-el-faisan', userName: 'Miguel C.', rating: 5, comment: "El kak'ik es de otro nivel. Recomendado.", approved: true },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a', process.env.MONGODB_URI);

    // Migracion: documentos creados antes de existir el campo "active" se
    // consideran activos. No toca los que ya fueron desactivados.
    await Business.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } }
    );

    for (const cat of categories) {
      await Category.updateOne({ _id: cat._id }, { $set: cat }, { upsert: true });
    }
    console.log(`Categorias: ${categories.length} documentos (idempotente).`);

    for (const biz of businesses) {
      // Asigna la zona por cercania al centroide de cada area
      const data = {
        ...biz,
        zone: zoneOf(biz.latitude, biz.longitude),
        // Horarios estructurados derivados del mapa legible "horas" para
        // permitir consultas por rango horario ($elemMatch sobre el arreglo).
        openingHours: structuredHours(biz.hours),
        ...(promos[biz._id] ?? {}),
      };
      await Business.updateOne({ _id: biz._id }, { $set: data }, { upsert: true });
    }
    console.log(`Negocios: ${businesses.length} documentos (idempotente).`);

    for (const rev of reviews) {
      await Review.updateOne({ _id: rev._id }, { $set: rev }, { upsert: true });
    }
    console.log(`Resenas: ${reviews.length} documentos (idempotente).`);

    // Cuentas de acceso demo
    // - admin  / admin123 (rol admin)
    // - un `owner` por negocio: usuario = slug del negocio, password = owner123
    const ownerPasswordHash = bcrypt.hashSync('owner123', 10);
    const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);

    await User.updateOne(
      { _id: 'admin' },
      { $set: { username: 'admin', passwordHash: adminHash, role: 'admin', name: 'Administrador LocalMarket', active: true } },
      { upsert: true }
    );

    let owners = 0;
    for (const biz of businesses) {
      await Business.updateOne(
        { _id: biz._id },
        { $set: { ownerUsername: biz._id } }
      );
      await User.updateOne(
        { _id: biz._id },
        {
          $set: {
            username: biz._id,
            passwordHash: ownerPasswordHash,
            role: 'owner',
            businessId: biz._id,
            businessIds: [biz._id],
            name: biz.name,
            active: true,
          },
        },
        { upsert: true }
      );
      owners++;
    }
    console.log(`Usuarios: 1 admin + ${owners} duenos (password de duenos: owner123).`);

    // Recalcula el rating de negocios con resenas aprobadas de ejemplo
    const approved = await Review.find({ approved: true });
    const byBusiness = approved.reduce((acc, r) => {
      (acc[r.businessId] ??= []).push(r.rating);
      return acc;
    }, {});
    for (const [businessId, ratings] of Object.entries(byBusiness)) {
      const average = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      await Business.updateOne({ _id: businessId }, { rating: average });
    }
    console.log('Ratings recalculados desde resenas aprobadas.');
  } catch (err) {
    console.error('Error en el seed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Convierte el mapa legible de horarios ("Lunes a Viernes": "06:30 - 15:00" o
 * "Cerrado"/"Cita previa") en filas estructuradas {dia, abre, cierra, cerrado}
 * para poder consultarlas por rango de horas con $elemMatch.
 */
function structuredHours(hours = {}) {
  return Object.entries(hours)
    .map(([dia, valor]) => {
      const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(String(valor).trim());
      if (m) return { dia, abre: m[1], cierra: m[2], cerrado: false };
      return { dia, abre: '', cierra: '', cerrado: true };
    })
    .filter((row) => row.dia);
}

/** Devuelve el nombre del area mas cercana a unas coordenadas. */
function zoneOf(lat, lon) {
  const zones = [
    ['San Raymundo', 14.7646, -90.5949],
    ['San Juan Sacatepéquez', 14.7189, -90.6442],
    ['Ciudad Quetzal', 14.6992, -90.5788],
    ['Ciudad de Guatemala', 14.6349, -90.5069],
  ];
  let best = zones[0][0];
  let bestD = Infinity;
  for (const [name, zLat, zLon] of zones) {
    const d = (lat - zLat) ** 2 + (lon - zLon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

run();