export interface PriceRangeOption {
  value: string;
  label: string;
  badge: string;
  description: string;
  hint: string;
  icon: string;
}

export const PRICE_RANGE_OPTIONS: PriceRangeOption[] = [
  {
    value: '$',
    label: 'Económico',
    badge: '$',
    description: 'Precios accesibles y opciones populares',
    hint: 'Menos de Q50 por persona o compra promedio',
    icon: '💵',
  },
  {
    value: '$$',
    label: 'Moderado',
    badge: '$$',
    description: 'Precios estándar y rango intermedio',
    hint: 'Aprox. Q50 - Q150 por consumo o servicio',
    icon: '💳',
  },
  {
    value: '$$$',
    label: 'Premium',
    badge: '$$$',
    description: 'Alta gama, exclusivo o especializado',
    hint: 'Más de Q150 por persona o servicio exclusivo',
    icon: '✨',
  },
];

export function getPriceRangeOption(value?: string): PriceRangeOption {
  return PRICE_RANGE_OPTIONS.find((p) => p.value === value) ?? PRICE_RANGE_OPTIONS[0];
}

export function formatPriceRange(value?: string): string {
  const opt = PRICE_RANGE_OPTIONS.find((p) => p.value === value);
  return opt ? `${opt.badge} · ${opt.label}` : value || '$';
}
