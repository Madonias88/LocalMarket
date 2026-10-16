import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getBusinessQuery } from './businesses.js';

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
  await Business.updateOne({ _id: businessId }, { rating: average, reviewCount: approved.length });
}

// Resenas aprobadas de un negocio + resumen (publico)
// Acepta tanto ObjectId como slug del negocio
reviewsRouter.get('/:businessId', async (req, res) => {
  try {
    // Resolver el negocio por ObjectId o slug para obtener el _id real
    const query = getBusinessQuery(req.params.businessId);
    const business = await Business.findOne(query);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    const reviews = await Review.find({
      businessId: business._id,
      approved: true,
    }).sort({ createdAt: -1 });

    const average = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
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
    const review = new Review({
      businessId: business._id,
      userName: userName.trim(),
      rating: Number(rating),
      comment: (comment || '').trim(),
      approved: true, // Auto-aprobada para que se muestre de inmediato
    });
    await review.save();
    await recalcRating(business._id);
    res.status(201).json(review);
  } catch (err) {
    console.error('Error al crear resena:', err);
    res.status(400).json({ message: 'No se pudo publicar la reseña' });
  }
});

// Moderacion: todas las resenas (pendientes primero). Solo admin.
reviewsRouter.get('/admin/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { businessId, status } = req.query;
    const filter = {};
    if (businessId) {
      const query = getBusinessQuery(businessId);
      const biz = await Business.findOne(query);
      if (biz) filter.businessId = biz._id;
      else filter.businessId = businessId; // fallback
    }
    if (status === 'pending') filter.approved = false;
    else if (status === 'approved') filter.approved = true;

    const reviews = await Review.find(filter).sort({
      approved: 1,
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
    const { approved } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'El campo approved debe ser booleano' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { approved },
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