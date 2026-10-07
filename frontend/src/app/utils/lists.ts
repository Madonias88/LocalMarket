import type { BusinessPromo } from '../models/business';

/**
 * Helpers para los formularios: las listas (servicios, etiquetas, zonas de
 * entrega, métodos de pago) y las ofertas estructuradas se editan como texto
 * (una por línea) y se convierten a arreglos antes de guardar.
 */

/** Convierte una lista en texto editable (una entrada por línea). */
export function listToText(arr: string[] | undefined): string {
  return (arr ?? []).join('\n');
}

/** Convierte texto editable (una entrada por línea) en una lista limpia. */
export function textToList(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Texto editable de ofertas: formato "Título | descuento | desde | hasta" por línea. */
export function promosToText(promos: BusinessPromo[] | undefined): string {
  return (promos ?? [])
    .map((p) => [p.titulo, p.descuento ?? '', p.desde ?? '', p.hasta ?? ''].join(' | '))
    .join('\n');
}

/** Parsea el texto editable de ofertas (una por línea, columnas separadas por |). */
export function textToPromos(text: string): BusinessPromo[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titulo = '', descuento = '', desde = '', hasta = ''] = line
        .split('|')
        .map((s) => s.trim());
      return { titulo, descuento, desde, hasta };
    })
    .filter((p) => p.titulo);
}