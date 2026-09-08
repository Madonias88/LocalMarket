import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

/**
 * Autenticacion del panel de administracion.
 * Se usa un unico usuario definido en .env y un JWT firmado como token.
 * Para la demo es suficiente; en produccion se moveria a cuentas reales.
 */

export const authRouter = Router();

export function loginValidators() {
  return [
    body('username').trim().notEmpty().withMessage('El usuario es obligatorio'),
    body('password').trim().notEmpty().withMessage('La contraseña es obligatoria'),
  ];
}

authRouter.post('/login', loginValidators(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { role: 'admin', username },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token });
});

/** Middleware: valida el Bearer token en rutas protegidas. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}