import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { authRouter } from './middleware/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { businessesRouter } from './routes/businesses.js';
import { reviewsRouter } from './routes/reviews.js';

const PORT = process.env.PORT || 3000;

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Limite generico para toda la API (anti-abuso)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas peticiones. Intenta en unos minutos.' },
});
app.use('/api', apiLimiter);

// Limite mas estricto para el login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' },
});
app.use('/api/auth/login', loginLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'localmarket-backend' });
});

app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/businesses', businessesRouter);
app.use('/api/reviews', reviewsRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.originalUrl}` });
});

// Manejo centralizado de errores
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido en la petición' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El cuerpo de la petición es demasiado grande' });
  }
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, () => {
      console.log(`API LocalMarket escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  });