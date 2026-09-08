import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { requireAuth } from '../middleware/auth.js';

export const reviewsRouter = Router();

const reviewValidators = [
  body('userName').trim().notEmpty().withMessage('Tu nombre es obligatorio').isLength({ max: 60 }).withMessage('El nombre es demasiado largo'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('La calificación debe ser entre 1 y 5 estrellas'),
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
  const approved = await Review.find({ businessId, approved: true });
  const average = approved.length
    ? Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / approved.length) * 10) / 10
    : 0;
  await Business.updateOne({ _id: businessId }, { rating: average });
}

// Resenas aprobadas de un negocio + resumen (publico)
reviewsRouter.get('/:businessId', async (req, res) => {
  try {
    const reviews = await Review.find({
      businessId: req.params.businessId,
      approved: true,
    }).sort({ createdAt: -1 });

    const average = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ reviews, count: reviews.length, average });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Crear una resena (se publica tras moderacion del admin)
reviewsRouter.post('/:businessId', reviewValidators, handleValidation, async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    const { userName, rating, comment } = req.body;
    const review = new Review({
      _id: `rev-${Date.now().toString(36)}`,
      businessId: req.params.businessId,
      userName: userName.trim(),
      rating: Number(rating),
      comment: (comment || '').trim(),
      approved: false,
    });
    await review.save();
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Moderacion: todas las resenas (pendientes primero). Admin.
reviewsRouter.get('/admin/list', requireAuth, async (req, res) => {
  try {
    const { businessId, status } = req.query;
    const filter = {};
    if (businessId) filter.businessId = businessId;
    if (status === 'pending') filter.approved = false;
    else if (status === 'approved') filter.approved = true;

    const reviews = await Review.find(filter).sort({
      approved: 1,
      createdAt: -1,
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Aprobar / rechazar resena. Admin.
reviewsRouter.put('/:id', requireAuth, async (req, res) => {
  try {
    const { approved } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'El campo approved debe ser booleano' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { approved },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: 'Reseña no encontrada' });

    if (approved) await recalcRating(review.businessId);
    res.json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Eliminar resena. Admin.
reviewsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Reseña no encontrada' });

    if (review.approved) await recalcRating(review.businessId);
    res.json({ message: 'Reseña eliminada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});