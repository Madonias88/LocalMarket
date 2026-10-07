import { activePromo } from './promo';
import type { Business } from '../models/business';

function biz(overrides: Partial<Business> = {}): Business {
  return {
    name: 'Negocio X',
    description: '',
    categoryId: 'c',
    address: '',
    phone: '',
    whatsapp: '',
    latitude: 0,
    longitude: 0,
    priceRange: '$',
    rating: 4,
    verified: false,
    featured: false,
    ...overrides,
  };
}

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

describe('activePromo', () => {
  it('es falsa cuando no hay texto de promoción', () => {
    expect(activePromo(biz())).toBeFalse();
  });

  it('es falsa si la promoción no ha iniciado', () => {
    expect(activePromo(biz({ promoText: '2x1', promoStart: dateInDays(3) }))).toBeFalse();
  });

  it('es falsa si la promoción ya venció', () => {
    expect(activePromo(biz({ promoText: '2x1', promoEnd: dateInDays(-3) }))).toBeFalse();
  });

  it('es verdadera con texto y sin fechas (indefinida)', () => {
    expect(activePromo(biz({ promoText: '2x1' }))).toBeTrue();
  });

  it('es verdadera dentro del rango de fechas', () => {
    expect(
      activePromo(
        biz({ promoText: '2x1', promoStart: dateInDays(-3), promoEnd: dateInDays(3) })
      )
    ).toBeTrue();
  });
});