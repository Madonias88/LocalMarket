export type ScheduleMode = 'weekdays-weekend' | 'daily' | 'custom';

export interface DayRow {
  day: string;
  isOpen: boolean;
  start: string;
  end: string;
  isAppointment: boolean;
}

export interface WeekdayWeekendConfig {
  weekdaysOpen: boolean;
  weekdaysStart: string;
  weekdaysEnd: string;
  weekdaysAppointment: boolean;

  saturdayOpen: boolean;
  saturdayStart: string;
  saturdayEnd: string;
  saturdayAppointment: boolean;

  sundayOpen: boolean;
  sundayStart: string;
  sundayEnd: string;
  sundayAppointment: boolean;
}

export const DEFAULT_WEEKDAYS_WEEKEND: WeekdayWeekendConfig = {
  weekdaysOpen: true,
  weekdaysStart: '08:00',
  weekdaysEnd: '18:00',
  weekdaysAppointment: false,

  saturdayOpen: true,
  saturdayStart: '08:00',
  saturdayEnd: '13:00',
  saturdayAppointment: false,

  sundayOpen: false,
  sundayStart: '09:00',
  sundayEnd: '14:00',
  sundayAppointment: false,
};

export const DAYS_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export function createDefaultDays(): DayRow[] {
  return [
    { day: 'Lunes', isOpen: true, start: '08:00', end: '18:00', isAppointment: false },
    { day: 'Martes', isOpen: true, start: '08:00', end: '18:00', isAppointment: false },
    { day: 'Miércoles', isOpen: true, start: '08:00', end: '18:00', isAppointment: false },
    { day: 'Jueves', isOpen: true, start: '08:00', end: '18:00', isAppointment: false },
    { day: 'Viernes', isOpen: true, start: '08:00', end: '18:00', isAppointment: false },
    { day: 'Sábado', isOpen: true, start: '08:00', end: '13:00', isAppointment: false },
    { day: 'Domingo', isOpen: false, start: '09:00', end: '14:00', isAppointment: false },
  ];
}

export function weekdayWeekendToText(cfg: WeekdayWeekendConfig): string {
  const lines: string[] = [];

  // Lunes a Viernes
  if (!cfg.weekdaysOpen) {
    lines.push('Lunes a Viernes: Cerrado');
  } else if (cfg.weekdaysAppointment) {
    lines.push('Lunes a Viernes: Cita previa');
  } else {
    lines.push(`Lunes a Viernes: ${cfg.weekdaysStart || '08:00'} - ${cfg.weekdaysEnd || '18:00'}`);
  }

  // Sábado
  if (!cfg.saturdayOpen) {
    lines.push('Sábado: Cerrado');
  } else if (cfg.saturdayAppointment) {
    lines.push('Sábado: Cita previa');
  } else {
    lines.push(`Sábado: ${cfg.saturdayStart || '08:00'} - ${cfg.saturdayEnd || '13:00'}`);
  }

  // Domingo
  if (!cfg.sundayOpen) {
    lines.push('Domingo: Cerrado');
  } else if (cfg.sundayAppointment) {
    lines.push('Domingo: Cita previa');
  } else {
    lines.push(`Domingo: ${cfg.sundayStart || '09:00'} - ${cfg.sundayEnd || '14:00'}`);
  }

  return lines.join('\n');
}

export function daysToText(days: DayRow[]): string {
  return days
    .map((d) => {
      if (!d.isOpen) return `${d.day}: Cerrado`;
      if (d.isAppointment) return `${d.day}: Cita previa`;
      return `${d.day}: ${d.start || '08:00'} - ${d.end || '18:00'}`;
    })
    .join('\n');
}

export interface SchedulePreset {
  id: string;
  title: string;
  description: string;
  text: string;
  icon: string;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: 'comercial',
    title: 'Comercial estándar',
    description: 'Lun-Vie 8-18h, Sáb 8-13h, Dom Cerrado',
    text: 'Lunes a Viernes: 08:00 - 18:00\nSábado: 08:00 - 13:00\nDomingo: Cerrado',
    icon: '🏢',
  },
  {
    id: 'restaurante',
    title: 'Restaurante / Cafetería',
    description: 'Martes a Domingo 11-22h, Lunes cerrado',
    text: 'Lunes: Cerrado\nMartes a Domingo: 11:00 - 22:00',
    icon: '🍽️',
  },
  {
    id: 'continuo',
    title: 'Todos los días (Corrido)',
    description: 'Lunes a Domingo de 7:00 a 21:00',
    text: 'Lunes a Domingo: 07:00 - 21:00',
    icon: '🏪',
  },
  {
    id: 'nocturno',
    title: 'Horario nocturno / Bar',
    description: 'Jueves a Sábado de 18:00 a 02:00',
    text: 'Lunes a Miércoles: Cerrado\nJueves a Sábado: 18:00 - 02:00\nDomingo: Cerrado',
    icon: '🍸',
  },
  {
    id: 'cita',
    title: 'Solo cita previa',
    description: 'Lunes a Sábado por previa cita',
    text: 'Lunes a Sábado: Cita previa\nDomingo: Cerrado',
    icon: '📅',
  },
  {
    id: '24h',
    title: 'Servicio 24 Horas',
    description: 'Abierto las 24 horas todos los días',
    text: 'Lunes a Domingo: 00:00 - 23:59',
    icon: '⏰',
  },
];

export function parseTimeRange(val: string): {
  isOpen: boolean;
  isAppointment: boolean;
  start: string;
  end: string;
} {
  const v = val.trim();
  const vLower = v.toLowerCase();
  if (!v || vLower.includes('cerrado')) {
    return { isOpen: false, isAppointment: false, start: '08:00', end: '18:00' };
  }
  if (vLower.includes('cita previa') || vLower.includes('cita')) {
    return { isOpen: true, isAppointment: true, start: '08:00', end: '18:00' };
  }
  const m = v.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (m) {
    const pad = (s: string) => (s.length === 4 ? '0' + s : s);
    return { isOpen: true, isAppointment: false, start: pad(m[1]), end: pad(m[2]) };
  }
  return { isOpen: true, isAppointment: false, start: '08:00', end: '18:00' };
}

export function parseScheduleText(text: string): {
  mode: ScheduleMode;
  weekdaysConfig: WeekdayWeekendConfig;
  days: DayRow[];
} {
  const weekdaysConfig: WeekdayWeekendConfig = { ...DEFAULT_WEEKDAYS_WEEKEND };
  const days: DayRow[] = createDefaultDays();

  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { mode: 'weekdays-weekend', weekdaysConfig, days };
  }

  const entries: { key: string; value: string }[] = [];
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      entries.push({
        key: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      });
    }
  }

  let singleDayMatches = 0;
  for (const entry of entries) {
    const k = entry.key.toLowerCase();
    const matchingDay = days.find(
      (d) =>
        d.day.toLowerCase() === k ||
        (k === 'sabado' && d.day === 'Sábado') ||
        (k === 'miercoles' && d.day === 'Miércoles')
    );
    if (matchingDay) {
      singleDayMatches++;
      const parsed = parseTimeRange(entry.value);
      matchingDay.isOpen = parsed.isOpen;
      matchingDay.isAppointment = parsed.isAppointment;
      matchingDay.start = parsed.start;
      matchingDay.end = parsed.end;
    }
  }

  const hasWeekdays = entries.some((e) => /lunes\s+a\s+viernes/i.test(e.key));
  const hasSaturday = entries.some(
    (e) => /s[áa]bado/i.test(e.key) && !/lunes|domingo/i.test(e.key)
  );
  const hasSunday = entries.some(
    (e) => /domingo/i.test(e.key) && !/lunes|s[áa]bado/i.test(e.key)
  );

  if (hasWeekdays) {
    for (const e of entries) {
      if (/lunes\s+a\s+viernes/i.test(e.key)) {
        const p = parseTimeRange(e.value);
        weekdaysConfig.weekdaysOpen = p.isOpen;
        weekdaysConfig.weekdaysAppointment = p.isAppointment;
        weekdaysConfig.weekdaysStart = p.start;
        weekdaysConfig.weekdaysEnd = p.end;
      } else if (/s[áa]bado/i.test(e.key)) {
        const p = parseTimeRange(e.value);
        weekdaysConfig.saturdayOpen = p.isOpen;
        weekdaysConfig.saturdayAppointment = p.isAppointment;
        weekdaysConfig.saturdayStart = p.start;
        weekdaysConfig.saturdayEnd = p.end;
      } else if (/domingo/i.test(e.key)) {
        const p = parseTimeRange(e.value);
        weekdaysConfig.sundayOpen = p.isOpen;
        weekdaysConfig.sundayAppointment = p.isAppointment;
        weekdaysConfig.sundayStart = p.start;
        weekdaysConfig.sundayEnd = p.end;
      }
    }
  }

  let mode: ScheduleMode = 'custom';
  if (hasWeekdays || (entries.length <= 3 && (hasSaturday || hasSunday))) {
    mode = 'weekdays-weekend';
  } else if (singleDayMatches >= 4) {
    mode = 'daily';
  } else {
    mode = 'custom';
  }

  return { mode, weekdaysConfig, days };
}
