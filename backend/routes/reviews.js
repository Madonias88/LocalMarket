import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getBusinessQuery } from './businesses.js';

export const reviewsRouter = Router();

const reviewValidators = [
  body('userName').trim().notEmpty().withMessage('Tu nombre es obligatorio').isLength({ max: 60 }).withMessage('El nombre es demasiado largo'),
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('La calificación debe ser entre 1 y 5 estrellas'),
  body('comment')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('El comentario no puede superar 500 caracteres'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, details: errors.array() });
  }
  next();
}

/** Recalcula el rating de un negocio como promedio de sus resenas aprobadas. */
async function recalcRating(businessId) {
  const objectId = mongoose.isValidObjectId(businessId) ? new mongoose.Types.ObjectId(businessId) : null;
  const filter = objectId
    ? { $or: [{ businessId: objectId }, { businessId: String(businessId) }], approved: true }
    : { businessId, approved: true };

  const approved = await Review.find(filter);
  const average = approved.length
    ? Math.round((approved.reduce((sum, r) => sum + Number(r.rating || 0), 0) / approved.length) * 10) / 10
    : 0;

  const bizFilter = objectId
    ? { $or: [{ _id: objectId }, { _id: String(businessId) }] }
    : { _id: businessId };

  await Business.updateOne(bizFilter, { rating: average, reviewCount: approved.length });
  return { average, count: approved.length };
}

// Resenas aprobadas de un negocio + resumen (publico)
// Acepta tanto ObjectId como slug del negocio
reviewsRouter.get('/:businessId', async (req, res) => {
  try {
    // Resolver el negocio por ObjectId o slug para obtener el _id real
    const query = getBusinessQuery(req.params.businessId);
    const business = await Business.findOne(query);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    const objectId = mongoose.isValidObjectId(business._id) ? new mongoose.Types.ObjectId(business._id) : null;
    const filter = objectId
      ? { $or: [{ businessId: objectId }, { businessId: String(business._id) }], approved: true }
      : { businessId: business._id, approved: true };

    const reviews = await Review.find(filter).sort({ createdAt: -1 });

    const average = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ reviews, count: reviews.length, average });
  } catch (err) {
    console.error('Error al listar resenas:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Crear una resena (se publica de inmediato y actualiza el rating del negocio)
reviewsRouter.post('/:businessId', reviewValidators, handleValidation, async (req, res) => {
  try {
    const query = getBusinessQuery(req.params.businessId);
    const business = await Business.findOne(query);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    const { userName, rating, comment } = req.body;

    let userId = undefined;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(
          authHeader.slice(7),
          process.env.JWT_SECRET || 'localmarket-dev-secret-cambiar-en-produccion'
        );
        if (decoded?.userId) userId = decoded.userId;
      } catch {}
    }

    const review = new Review({
      businessId: business._id,
      userId,
      userName: userName.trim(),
      rating: Number(rating),
      comment: (comment || '').trim(),
      approved: false, // En moderación: requiere aprobación del administrador para publicarse
      status: 'pending',
    });
    await review.save();
    const stats = await recalcRating(business._id);
    res.status(201).json({
      ...review.toObject(),
      businessRating: stats.average,
      businessReviewCount: stats.count,
    });
  } catch (err) {
    console.error('Error al crear resena:', err);
    res.status(400).json({ message: 'No se pudo registrar la reseña' });
  }
});

// Moderacion: resenas (con filtro por negocio y estado). Solo admin.
reviewsRouter.get('/admin/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { businessId, status } = req.query;
    const conditions = [];

    if (businessId && businessId !== 'all') {
      const query = getBusinessQuery(businessId);
      const biz = await Business.findOne(query);
      const targetId = biz ? biz._id : businessId;
      const objectId = mongoose.isValidObjectId(targetId) ? new mongoose.Types.ObjectId(targetId) : null;
      if (objectId) {
        conditions.push({ $or: [{ businessId: objectId }, { businessId: String(targetId) }] });
      } else {
        conditions.push({ businessId: targetId });
      }
    }

    if (status === 'pending') {
      conditions.push({
        $or: [{ status: 'pending' }, { status: { $exists: false }, approved: false }],
      });
    } else if (status === 'approved') {
      conditions.push({
        $or: [{ status: 'approved' }, { status: { $exists: false }, approved: true }],
      });
    } else if (status === 'rejected') {
      conditions.push({ status: 'rejected' });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const reviews = await Review.find(filter).sort({
      createdAt: -1,
    });
    res.json(reviews);
  } catch (err) {
    console.error('Error al listar resenas del admin:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Aprobar / rechazar resena. Solo admin.
reviewsRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { approved, status } = req.body;
    const update = {};

    if (typeof approved === 'boolean') {
      update.approved = approved;
      update.status = approved ? 'approved' : 'rejected';
    }
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      update.status = status;
      update.approved = status === 'approved';
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Se requiere el campo approved o status' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      update,
      { returnDocument: 'after' }
    );
    if (!review) return res.status(404).json({ message: 'Reseña no encontrada' });

    await recalcRating(review.businessId);
    res.json(review);
  } catch (err) {
    console.error('Error al moderar resena:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Eliminar resena. Solo admin.
reviewsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Reseña no encontrada' });

    await recalcRating(review.businessId);
    res.json({ message: 'Reseña eliminada' });
  } catch (err) {
    console.error('Error al eliminar resena:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});