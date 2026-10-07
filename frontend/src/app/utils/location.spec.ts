import { distanceKm, formatDistance } from './location';

describe('distanceKm', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanceKm(14.6349, -90.5069, 14.6349, -90.5069)).toBe(0);
  });

  it('calcula 1 grado de longitud en el ecuador (~111 km)', () => {
    // El resultado real usa Haversine; comparamos con la aproximación
    // equirectangular con tolerancia de 1 metro.
    const equirect = 6371 * Math.cos((10 * Math.PI) / 180) * (Math.PI / 180);
    expect(distanceKm(10, 0, 10, 1)).toBeCloseTo(equirect, 3);
  });

  it('devuelve infinito cuando una coordenada es (0,0)', () => {
    expect(distanceKm(0, 0, 14.6, -90.5)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('formatDistance', () => {
  it('formatea en metros por debajo de 1 km', () => {
    expect(formatDistance(0.35)).toBe('350 m');
  });

  it('formatea en km con un decimal', () => {
    expect(formatDistance(2.4)).toBe('2.4 km');
  });

  it('devuelve vacío para distancias no finitas', () => {
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe('');
  });
});