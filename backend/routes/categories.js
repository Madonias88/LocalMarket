import { Router } from 'express';
import Category from '../models/Category.js';

export const categoriesRouter = Router();

// Lista publica de categorias
categoriesRouter.get('/', async (_req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    console.error('Error al listar categorias:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});