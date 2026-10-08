import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Business from '../models/Business.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const businessesRouter = Router();

// --- Subida de fotos (multer) ---
// Las imágenes se guardan en backend/uploads/ y Express las sirve en /uploads.
// El nombre de archivo lo genera el servidor (nunca se confía en el del cliente).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB: las fotos de celular pesan varios MB 

/**
 * Deriva el arreglo estructurado openingHours a partir del mapa legible
 * "hours" ("06:30 - 15:00" / "Cerrado"). Así, editar el horario desde el
 * formulario mantiene la versión consultable con $elemMatch actualizada.
 */
function structuredHours(hours = {}) {
  // `hours` llega como Map de Mongoose (es subclase de Map nativo) o como
  // objeto plano; Object.entries() sobre un Map de mongoose expondría sus
  // propiedades internas ($__parent, $__path...), así que se itera como Map.
  const entries =
    typeof hours?.entries === 'function' ? Array.from(hours.entries()) : Object.entries(hours);
  return entries
    .map(([dia, valor]) => {
      const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(String(valor).trim());
      if (m) return { dia, abre: m[1], cierra: m[2], cerrado: false };
      return { dia, abre: '', cierra: '', cerrado: true };
    })
    .filter((row) => row.dia);
}

const uploadPhotos = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_TYPES[file.mimetype] || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('Formato no permitido: usa JPG, PNG o WebP'), { code: 'BAD_FORMAT' }));
  },
});

/** Traduce el error del middleware a un mensaje claro para el usuario. */
function uploadErrorMessage(uploadErr) {
  if (uploadErr.code === 'BAD_FORMAT') return uploadErr.message;
  if (uploadErr.code === 'LIMIT_FILE_SIZE') return 'La imagen supera el tamaño máximo de 10 MB';
  if (uploadErr.code === 'LIMIT_FILE_COUNT') return 'Máximo 5 fotos por carga';
  return 'No se pudieron subir las imágenes';
}

function isUploadedUrl(url) {
  // Solo acepta archivos servidos desde esta API y con el nombre generado por ella.
  return /\/uploads\/\d+-[a-f0-9]{12}\.(jpg|png|webp)$/.test(url);
}

/** Verifica que el dueño del negocio es el que pide la operación (o es admin). */
async function checkOwnerOrAdmin(req, res) {
  if (req.auth.role === 'admin') return true;
  const user = await User.findOne({ username: req.auth.username, active: true });
  if (!user) {
    res.status(403).json({ message: 'Usuario no encontrado' });
    return false;
  }
  const isOwner =
    user.businessId === req.params.id ||
    (Array.isArray(user.businessIds) && user.businessIds.includes(req.params.id));
  if (!isOwner) {
    const b = await Business.findOne({ _id: req.params.id, ownerUsername: user.username });
    if (!b) {
      res.status(403).json({ message: 'Solo puedes editar tus propios negocios' });
      return false;
    }
  }
  return true;
}

// Campos que un OWNER puede editar de su propio negocio.
// Categoria, rating, verificado, destacado y activo son solo admin.
const OWNER_FIELDS = [
  'name',
  'description',
  'address',
  'zone',
  'phone',
  'whatsapp',
  'latitude',
  'longitude',
  'priceRange',
  'photoUrls',
  'hours',
  'openingHours',
  'promoText',
  'promoStart',
  'promoEnd',
  'promos',
  'email',
  'website',
  'instagram',
  'facebook',
  'servicios',
  'tags',
  'delivery',
  'deliveryZones',
  'deliveryFee',
  'minOrder',
  'paymentMethods',
];
const ADMIN_FIELDS = [
  ...OWNER_FIELDS,
  'categoryId',
  'rating',
  'verified',
  'featured',
  'active',
  'viewsCount',
  'reviewCount',
];

// Validaciones compartidas (lat/long/rating y los campos nuevos). Los campos
// obligatorios se exigen en POST; en PUT se permite edicion parcial (solo si
// llegan se validan).
const businessValidators = [
  body('name')
    .optional({ values: 'falsy' })
    .trim()
    .notEmpty()
    .withMessage('El nombre no puede quedar vacío'),
  body('latitude').optional({ values: 'falsy' }).isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitude').optional({ values: 'falsy' }).isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  body('rating').optional({ values: 'falsy' }).isFloat({ min: 0, max: 5 }).withMessage('El rating debe estar entre 0 y 5'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('El correo electrónico es inválido'),
  body('servicios').optional().isArray().withMessage('Servicios debe ser una lista'),
  body('tags').optional().isArray().withMessage('Etiquetas debe ser una lista'),
  body('deliveryZones').optional().isArray().withMessage('Zonas de entrega debe ser una lista'),
  body('paymentMethods').optional().isArray().withMessage('Métodos de pago debe ser una lista'),
  body('promos').optional().isArray().withMessage('Ofertas debe ser una lista'),
  body('openingHours').optional().isArray().withMessage('Horarios estructurados debe ser una lista'),
  body('deliveryFee').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('El costo de envío no puede ser negativo'),
  body('minOrder').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('El pedido mínimo no puede ser negativo'),
  body('viewsCount').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Vistas inválidas'),
  body('reviewCount').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Cantidad de reseñas inválida'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, details: errors.array() });
  }
  next();
}

// Estadisticas del dashboard (solo admin)
businessesRouter.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [total, active, featured, pendingReviews, byCategory, zones, owners] = await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ active: true }),
      Business.countDocuments({ featured: true }),
      Review.countDocuments({ approved: false }),
      Business.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Business.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      User.countDocuments({ role: 'owner' }),
    ]);

    res.json({
      total,
      active,
      inactive: total - active,
      featured,
      pendingReviews,
      owners,
      byCategory,
      zones,
    });
  } catch (err) {
    console.error('Error en /stats:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Negocios vinculados al usuario autenticado (mis negocios)
businessesRouter.get('/my-businesses', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.auth.username });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    let filter = {};
    if (user.role === 'admin') {
      filter = {};
    } else {
      const userBIds = Array.isArray(user.businessIds) ? [...user.businessIds] : [];
      if (user.businessId && !userBIds.includes(user.businessId)) {
        userBIds.push(user.businessId);
      }
      filter = {
        $or: [
          { ownerUsername: user.username },
          { _id: { $in: userBIds } },
        ],
      };
    }

    const myBusinesses = await Business.find(filter).sort({ createdAt: -1 });
    res.json(myBusinesses);
  } catch (err) {
    console.error('Error al obtener mis negocios:', err);
    res.status(500).json({ message: 'Error al obtener tus negocios' });
  }
});

// Lista pública de negocios activos con filtros que se resuelven con
// OPERADORES DE CONSULTA de MongoDB (sencillas, dobles y combinadas):
//   - ratingMin / ratingMax  -> $gte + $lte (rango sobre un campo = doble)
//   - price  (lista con comas)-> $in
//   - featured / verified    -> $eq true (AND implícito con el resto)
//   - promo                  -> $exists + $ne (promoción no vacía = doble)
//   - photos                 -> $not { $size: 0 } (al menos una foto = combinada)
//   - fotos                  -> $size (cantidad exacta de fotos)
//   - q                      -> $or de $regex sobre nombre, descripción y dirección
// El admin puede pedir todos (incluidos inactivos) con includeInactive=1
businessesRouter.get('/', async (req, res) => {
  try {
    const { category, zone, q, includeInactive, price, featured, verified, promo, photos, delivery } = req.query;

    const toNumber = (v) => {
      if (v === undefined || v === null || v === '') return Number.NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    };
    const ratingMin = toNumber(req.query.ratingMin);
    const ratingMax = toNumber(req.query.ratingMax);
    const fotos = toNumber(req.query.fotos);

    const filter = {};

    if (!includeInactive) filter.active = true; // $eq implícito (sencilla)
    if (category) filter.categoryId = category; // $eq implícito (sencilla)
    if (zone) filter.zone = zone; // $eq implícito (sencilla)

    // Sencilla (evaluación): $regex sobre nombre, descripción y dirección con $or
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { address: regex },
      ];
    }

    // Doble (comparación): rango de rating con $gte + $lte en el mismo campo
    if (Number.isFinite(ratingMin) || Number.isFinite(ratingMax)) {
      const rating = {};
      if (Number.isFinite(ratingMin)) rating.$gte = ratingMin;
      if (Number.isFinite(ratingMax)) rating.$lte = ratingMax;
      if (rating.$gte > rating.$lte) {
        return res.status(400).json({ message: 'El rating mínimo no puede ser mayor que el máximo' });
      }
      filter.rating = rating;
    }

    // Sencilla (comparación): varias opciones de precio con $in
    if (price !== undefined && price !== '') {
      filter.priceRange = { $in: String(price).split(',') };
    }

    // Combinadas: AND implícito al combinar varios filtros
    if (featured === '1') filter.featured = true; // $eq implícito
    if (verified === '1') filter.verified = true; // $eq implícito
    if (delivery === '1') filter.delivery = true; // $eq implícito

    // Doble (elementos): campo existe y no está vacío
    if (promo === '1') filter.promoText = { $exists: true, $ne: '' };

    // Combinada (arreglos): $not sobre $size (al menos una foto)
    if (photos === '1' && !Number.isFinite(fotos)) {
      filter.photoUrls = { $not: { $size: 0 } };
    }

    // Sencilla (arreglos): cantidad exacta de fotos con $size
    if (Number.isFinite(fotos) && fotos >= 0) {
      filter.photoUrls = { $size: fotos };
    }

    const businesses = await Business.find(filter).sort({ name: 1 });
    res.json(businesses);
  } catch (err) {
    console.error('Error al listar negocios:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Zonas disponibles (público): agregación con $group y $sum (MongoDB aggregate)
businessesRouter.get('/zones', async (_req, res) => {
  try {
    const zones = await Business.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$zone', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    res.json(zones.filter((z) => z._id));
  } catch (err) {
    console.error('Error al listar zonas:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Detalle publico de un negocio (activos; y cualquiera si admin pide includeInactive)
businessesRouter.get('/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    if (business.active === false && !req.query.includeInactive) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    res.json(business);
  } catch (err) {
    console.error('Error al obtener negocio:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// --- Registro público de negocio ---
// Soporta dos flujos:
//   1) Usuario ya autenticado (JWT en header): vincula el negocio a su cuenta existente.
//   2) Flujo legado (sin token): crea usuario + negocio al mismo tiempo con username/password.
// En ambos casos el negocio queda PENDIENTE (active: false) hasta que el admin apruebe.
businessesRouter.post('/register', businessValidators, handleValidation, async (req, res) => {
  try {
    const { name, categoryId } = req.body;
    if (!name || !categoryId) {
      return res.status(400).json({ message: 'Nombre y categoría son obligatorios' });
    }

    // ── Detectar si viene con token de sesión ───────────────────────────────
    const header = req.headers.authorization || '';
    const rawToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    let sessionUser = null;
    if (rawToken) {
      try {
        sessionUser = jwt.verify(rawToken, process.env.JWT_SECRET || 'localmarket-dev-secret-cambiar-en-produccion');
      } catch { /* token inválido → flujo legado */ }
    }

    const slug =
      String(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'negocio';
    const businessId = `${slug}-${Date.now().toString(36)}`;

    const business = new Business({
      _id: businessId,
      name: String(name).trim(),
      categoryId: String(categoryId),
      description: String(req.body.description || '').trim(),
      address: String(req.body.address || '').trim(),
      zone: String(req.body.zone || '').trim(),
      phone: String(req.body.phone || '').trim(),
      whatsapp: String(req.body.whatsapp || '').trim(),
      email: String(req.body.email || '').trim(),
      website: String(req.body.website || '').trim(),
      latitude: Number(req.body.latitude) || 0,
      longitude: Number(req.body.longitude) || 0,
      priceRange: String(req.body.priceRange || '$').trim() || '$',
      active: false, // pendiente de aprobación
    });
    if (req.body.hours) business.openingHours = structuredHours(req.body.hours);

    if (sessionUser) {
      // ── Flujo 1: usuario autenticado ───────────────────────────────────────
      const existingUser = await User.findOne({ username: sessionUser.username });
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      business.ownerUsername = existingUser.username;
      await business.save();

      if (!existingUser.businessIds) existingUser.businessIds = [];
      if (!existingUser.businessIds.includes(businessId)) {
        existingUser.businessIds.push(businessId);
      }
      if (!existingUser.businessId) {
        existingUser.businessId = businessId;
      }
      await existingUser.save();

      res.status(201).json({
        message: 'Registro recibido. Un administrador revisará tu ficha y la publicará en breve.',
        business,
      });
    } else {
      // ── Flujo 2: legado sin token (username + password en el body) ─────────
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Inicia sesión o proporciona usuario y contraseña para registrar tu negocio' });
      }
      const uname = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(uname)) {
        return res.status(400).json({ message: 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto o guión)' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      }

      let user = await User.findOne({ username: uname });
      business.ownerUsername = uname;

      if (user) {
        // Si el usuario ya existe, vincular el nuevo negocio a su cuenta
        await business.save();
        if (!user.businessIds) user.businessIds = [];
        if (!user.businessIds.includes(businessId)) user.businessIds.push(businessId);
        if (!user.businessId) user.businessId = businessId;
        await user.save();
      } else {
        // Crear usuario nuevo con negocio vinculado
        user = new User({
          _id: uname,
          username: uname,
          passwordHash: bcrypt.hashSync(String(password), 10),
          role: 'owner',
          businessId,
          businessIds: [businessId],
          name: String(name).trim(),
          active: false,
        });

        try {
          await business.save();
          await user.save();
        } catch (saveErr) {
          await business.deleteOne().catch(() => {});
          await user.deleteOne().catch(() => {});
          throw saveErr;
        }
      }

      res.status(201).json({
        message: 'Registro recibido. Un administrador revisará tu ficha y la publicará en breve.',
        business,
      });
    }
  } catch (err) {
    console.error('Error al registrar negocio:', err);
    res.status(400).json({ message: 'No se pudo registrar el negocio' });
  }
});

// --- CRUD protegido ---

// Crear negocios: SOLO admin
businessesRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!req.body.name || !req.body.categoryId) {
      return res.status(400).json({ message: 'Nombre y categoría son obligatorios' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, details: errors.array() });
    }

    const body = { ...req.body };
    if (!body._id && body.name) {
      body._id =
        body.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    }
    // Si se envió el horario legible pero no el estructurado, se deriva aquí.
    if (body.hours && !body.openingHours) body.openingHours = structuredHours(body.hours);
    const business = new Business(body);
    await business.save();
    res.status(201).json(business);
  } catch (err) {
    console.error('Error al crear negocio:', err);
    res.status(400).json({ message: 'No se pudo crear el negocio' });
  }
});

// Aprobar un negocio registrado por el público: lo publica y habilita la
// cuenta del dueño para que entre a "Mi negocio". SOLO admin.
businessesRouter.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(req.params.id, { active: true }, { new: true });
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    await User.updateOne({ businessId: business._id, role: 'owner' }, { active: true });
    res.json({ message: 'Negocio aprobado y publicado', business });
  } catch (err) {
    console.error('Error al aprobar negocio:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Rechazar una solicitud pendiente: elimina el negocio y su cuenta de dueño.
businessesRouter.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const business = await Business.findByIdAndDelete(req.params.id);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    await User.deleteMany({ businessId: business._id, role: 'owner' });
    res.json({ message: 'Solicitud rechazada y eliminada' });
  } catch (err) {
    console.error('Error al rechazar solicitud:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Editar: el admin todo; el OWNER solo su propio negocio y con sus campos permitidos.
businessesRouter.put('/:id', requireAuth, businessValidators, handleValidation, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    // Owner: verifica si el usuario es dueño o admin
    const ok = await checkOwnerOrAdmin(req, res);
    if (!ok) return;

    // Limpia el body segun el rol (evita que un owner cambie rating/featured, etc.)
    const allowed = req.auth.role === 'admin' ? ADMIN_FIELDS : OWNER_FIELDS;
    const body = {};
    for (const key of allowed) {
      if (key in req.body) body[key] = req.body[key];
    }

    const updated = await Business.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    // Si se editó el horario legible sin tocar el estructurado, se re-sincroniza.
    if (updated.hours && !body.openingHours) {
      return res.json(
        await Business.findByIdAndUpdate(
          req.params.id,
          { openingHours: structuredHours(updated.hours) },
          { new: true }
        )
      );
    }
    res.json(updated);
  } catch (err) {
    console.error('Error al editar negocio:', err);
    res.status(400).json({ message: 'No se pudo guardar el negocio' });
  }
});

// Baja logica: en vez de borrar el documento, se desactiva. SOLO admin.
businessesRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    res.json({ message: 'Negocio desactivado', business });
  } catch (err) {
    console.error('Error al desactivar negocio:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Subir fotos del negocio: el OWNER de su propio negocio (o el admin).
// Multipart field "photos" (archivos de imagen). Respeta OWNER_FIELDS.
businessesRouter.post('/:id/photos', requireAuth, (req, res) => {
  uploadPhotos.array('photos', 5)(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErrorMessage(uploadErr) });
    }
    try {
      const business = await Business.findById(req.params.id);
      if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
      const ok = await checkOwnerOrAdmin(req, res);
      if (!ok) return;
      if (!req.files?.length) {
        return res.status(400).json({ message: 'No se recibió ninguna imagen' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const newUrls = req.files.map((f) => `${baseUrl}/uploads/${f.filename}`);
      const photoUrls = [...(business.photoUrls || []), ...newUrls].slice(0, MAX_PHOTOS);

      const updated = await Business.findByIdAndUpdate(req.params.id, { photoUrls }, { new: true });
      res.json({ photoUrls, business: updated });
    } catch (err) {
      console.error('Error al subir fotos:', err);
      res.status(400).json({ message: 'No se pudieron subir las imágenes' });
    }
  });
});

// Eliminar UNA foto del negocio (recibe la URL completa). Quita la foto de la
// lista; si el archivo fue subido por esta API, también lo borra del disco.
businessesRouter.delete('/:id/photos', requireAuth, async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL de foto inválida' });
    }
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    const ok = await checkOwnerOrAdmin(req, res);
    if (!ok) return;

    const photoUrls = (business.photoUrls || []).filter((u) => u !== url);
    if ((business.photoUrls || []).length !== photoUrls.length && isUploadedUrl(url)) {
      const filename = path.basename(url.split('/uploads/')[1]);
      fs.promises.unlink(path.join(uploadsDir, filename)).catch(() => {});
    }

    const updated = await Business.findByIdAndUpdate(req.params.id, { photoUrls }, { new: true });
    res.json({ photoUrls, business: updated });
  } catch (err) {
    console.error('Error al eliminar foto:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});