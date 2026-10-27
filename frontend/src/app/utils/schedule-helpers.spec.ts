import {
  createDefaultDays,
  daysToText,
  parseScheduleText,
  weekdayWeekendToText,
  DEFAULT_WEEKDAYS_WEEKEND,
} from './schedule-helpers';

describe('schedule-helpers', () => {
  it('formats weekdays and weekend correctly', () => {
    const text = weekdayWeekendToText(DEFAULT_WEEKDAYS_WEEKEND);
    expect(text).toContain('Lunes a Viernes: 08:00 - 18:00');
    expect(text).toContain('Sábado: 08:00 - 13:00');
    expect(text).toContain('Domingo: Cerrado');
  });

  it('formats days to text correctly', () => {
    const days = createDefaultDays();
    const text = daysToText(days);
    expect(text).toContain('Lunes: 08:00 - 18:00');
    expect(text).toContain('Domingo: Cerrado');
  });

  it('parses typical weekday-weekend text correctly', () => {
    const raw = `Lunes a Viernes: 07:00 - 18:00
Sábado: 08:00 - 13:00
Domingo: Cerrado`;
    const res = parseScheduleText(raw);
    expect(res.mode).toBe('weekdays-weekend');
    expect(res.weekdaysConfig.weekdaysStart).toBe('07:00');
    expect(res.weekdaysConfig.weekdaysEnd).toBe('18:00');
    expect(res.weekdaysConfig.saturdayOpen).toBeTrue();
    expect(res.weekdaysConfig.saturdayStart).toBe('08:00');
    expect(res.weekdaysConfig.sundayOpen).toBeFalse();
  });

  it('parses daily individual day lines', () => {
    const raw = `Lunes: 09:00 - 17:00
Martes: 09:00 - 17:00
Miércoles: 09:00 - 17:00
Jueves: 09:00 - 17:00
Viernes: 09:00 - 17:00
Sábado: Cerrado
Domingo: Cerrado`;
    const res = parseScheduleText(raw);
    expect(res.mode).toBe('daily');
    const lunes = res.days.find((d) => d.day === 'Lunes');
    expect(lunes?.start).toBe('09:00');
    expect(lunes?.end).toBe('17:00');
  });

  it('parses custom lines to custom mode', () => {
    const raw = `Lunes a Jueves: 11:00 - 21:00
Viernes y Sábado: 11:00 - 23:00`;
    const res = parseScheduleText(raw);
    expect(res.mode).toBe('custom');
  });
});
