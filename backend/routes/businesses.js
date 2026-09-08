import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Business from '../models/Business.js';
import Review from '../models/Review.js';
import { requireAuth } from '../middleware/auth.js';

export const businessesRouter = Router();

// Validacion al crear o editar un negocio
const businessValidators = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('categoryId').trim().notEmpty().withMessage('La categoría es obligatoria'),
  body('latitude')
    .optional({ values: 'falsy' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitud inválida'),
  body('longitude')
    .optional({ values: 'falsy' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitud inválida'),
  body('rating')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 5 })
    .withMessage('El rating debe estar entre 0 y 5'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, details: errors.array() });
  }
  next();
}

// Estadisticas del dashboard (solo admin)
businessesRouter.get('/stats', requireAuth, async (_req, res) => {
  try {
    const [total, active, featured, pendingReviews, byCategory, zones] = await Promise.all([
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
    ]);

    res.json({
      total,
      active,
      inactive: total - active,
      featured,
      pendingReviews,
      byCategory,
      zones,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lista publica de negocios activos, con filtros por categoria, zona y busqueda.
// El admin puede pedir todos (incluidos inactivos) con includeInactive=1
businessesRouter.get('/', async (req, res) => {
  try {
    const { category, zone, q, includeInactive } = req.query;
    const filter = {};

    if (!includeInactive) filter.active = true;
    if (category) filter.categoryId = category;
    if (zone) filter.zone = zone;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { address: regex },
      ];
    }

    const businesses = await Business.find(filter).sort({ name: 1 });
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
  }
});

// --- CRUD protegido (panel admin) ---

businessesRouter.post('/', requireAuth, businessValidators, handleValidation, async (req, res) => {
  try {
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
    const business = new Business(body);
    await business.save();
    res.status(201).json(business);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

businessesRouter.put('/:id', requireAuth, businessValidators, handleValidation, async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    res.json(business);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Baja logica: en vez de borrar el documento, se desactiva para que no
// aparezca en la lista publica pero se conserve su informacion en la BD.
businessesRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
    res.json({ message: 'Negocio desactivado', business });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});