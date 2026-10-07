import { isOpenNow, openNowLabel } from './open-hours';

// 2026-10-08 (jueves) a las 12:00 y a las 23:00.
const JUEVES_MEDIO_DIA = new Date(2026, 9, 8, 12, 0, 0);
const JUEVES_NOCHE = new Date(2026, 9, 8, 23, 0, 0);

describe('isOpenNow', () => {
  it('es falsa sin mapa de horarios', () => {
    expect(isOpenNow(undefined, JUEVES_MEDIO_DIA)).toBeFalse();
  });

  it('abre a mediodía en "Lunes a Viernes 08:00-18:00"', () => {
    const hours = { 'Lunes a Viernes': '08:00 - 18:00' };
    expect(isOpenNow(hours, JUEVES_MEDIO_DIA)).toBeTrue();
  });

  it('cierra a las 23:00 con el mismo horario', () => {
    const hours = { 'Lunes a Viernes': '08:00 - 18:00' };
    expect(isOpenNow(hours, JUEVES_NOCHE)).toBeFalse();
  });

  it('ignora bloques con valor "Cerrado"', () => {
    const hours = { Jueves: 'Cerrado', 'Lunes a Viernes': '08:00 - 18:00' };
    expect(isOpenNow(hours, JUEVES_MEDIO_DIA)).toBeTrue();
    const soloCerrado = { Jueves: 'Cerrado' };
    expect(isOpenNow(soloCerrado, JUEVES_MEDIO_DIA)).toBeFalse();
  });
});

describe('openNowLabel', () => {
  it('etiqueta correcta según el estado', () => {
    const hours = { 'Lunes a Viernes': '08:00 - 18:00' };
    expect(openNowLabel(hours, JUEVES_MEDIO_DIA)).toBe('Abierto ahora');
    expect(openNowLabel(hours, JUEVES_NOCHE)).toBe('Cerrado ahora');
  });
});