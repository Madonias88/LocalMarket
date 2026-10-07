import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// La clave secreta SIEMPRE proviene del entorno (backend/.env). Se lee en el
// momento de firmar/verificar (no al importar el módulo) porque dotenv carga el
// .env en el cuerpo de server.js, que corre después de los imports en ESM.
let warnedSecret = false;
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && !warnedSecret) {
    warnedSecret = true;
    console.warn('[auth] OJO: JWT_SECRET no está definido. Usando un secreto de DESARROLLO inseguro.');
  }
  return secret || 'localmarket-dev-secret-cambiar-en-produccion';
}

export const authRouter = Router();

export function loginValidators() {
  return [
    body('username').trim().notEmpty().withMessage('El usuario es obligatorio'),
    body('password').trim().notEmpty().withMessage('La contraseña es obligatoria'),
  ];
}

authRouter.post('/login', loginValidators(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { username, password } = req.body;
  const identifier = username.trim().toLowerCase();

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
    active: true,
  });

  // Cuenta real en BD (admin, owner, etc.)
  if (user) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      {
        role: user.role,
        username: user.username,
        businessId: user.businessId || undefined,
        userId: user._id,
      },
      getSecret(),
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      businessId: user.businessId || undefined,
      name: user.name,
    });
  }

  // Compatibilidad: unico admin del .env (antes de migrar a cuentas en BD)
  if (process.env.ADMIN_USER && username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin', username }, getSecret(), { expiresIn: '8h' });
    return res.json({ token, username, role: 'admin' });
  }

  res.status(401).json({ message: 'Credenciales inválidas' });
});

// Endpoint para registrar nuevos usuarios con correo electrónico en MongoDB
authRouter.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body ?? {};
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Usuario, correo electrónico y contraseña son obligatorios' });
    }

    const uname = String(username).trim().toLowerCase();
    const uemail = String(email).trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) {
      return res.status(400).json({ message: 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto o guión)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uemail)) {
      return res.status(400).json({ message: 'Proporciona un correo electrónico válido' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existingUser = await User.findOne({ $or: [{ username: uname }, { email: uemail }] });
    if (existingUser) {
      const field = existingUser.username === uname ? 'nombre de usuario' : 'correo electrónico';
      return res.status(409).json({ message: `Ese ${field} ya está en uso, intenta con otro` });
    }

    const newUser = new User({
      _id: uname,
      username: uname,
      email: uemail,
      passwordHash: await bcrypt.hash(String(password), 10),
      name: String(name || uname).trim(),
      role: 'owner',
      active: true,
    });

    await newUser.save();

    const token = jwt.sign(
      {
        role: newUser.role,
        username: newUser.username,
        businessId: newUser.businessId || undefined,
        userId: newUser._id,
      },
      getSecret(),
      { expiresIn: '8h' }
    );

    res.status(201).json({
      message: 'Usuario registrado correctamente en MongoDB',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ message: 'Error interno del servidor al registrar el usuario' });
  }
});

/** Middleware: valida el Bearer token en rutas protegidas. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, getSecret());
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

/** Middleware: solo admins. Requiere requireAuth antes. */
export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ message: 'Requiere permisos de administrador' });
  }
  next();
}