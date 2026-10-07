import type { Business } from '../models/business';

/** Indica si una promocion esta vigente segun sus fechas (formato YYYY-MM-DD). */
export function activePromo(b: Business | null | undefined): boolean {
  if (!b || !b.promoText || !b.promoText.trim()) return false;
  const now = new Date();
  if (b.promoStart && new Date(b.promoStart) > now) return false;
  if (b.promoEnd && new Date(b.promoEnd) < now) return false;
  return true;
}