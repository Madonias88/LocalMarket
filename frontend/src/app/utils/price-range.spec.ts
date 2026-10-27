import { formatPriceRange, getPriceRangeOption, PRICE_RANGE_OPTIONS } from './price-range';

describe('price-range utils', () => {
  it('returns valid option for known value', () => {
    const opt = getPriceRangeOption('$$');
    expect(opt.label).toBe('Moderado');
    expect(opt.value).toBe('$$');
  });

  it('falls back to first option for unknown value', () => {
    const opt = getPriceRangeOption('????');
    expect(opt.value).toBe('$');
  });

  it('formats price range with badge and label', () => {
    expect(formatPriceRange('$')).toBe('$ · Económico');
    expect(formatPriceRange('$$$')).toBe('$$$ · Premium');
  });
});
