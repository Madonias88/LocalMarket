/** Dias de la semana con indice JS (0=Domingo ... 6=Sabado). */
const DAY_INDEX: Record<string, number> = {
  lunes: 1,
  martes: 2,
  'miércoles': 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  'sábado': 6,
  sabado: 6,
  domingo: 0,
};

function mentions(key: string): number[] {
  const out: number[] = [];
  for (const word of key.toLowerCase().split(/\s+/)) {
    const idx = DAY_INDEX[word];
    if (idx !== undefined && !out.includes(idx)) out.push(idx);
  }
  return out;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; ; i = (i + 1) % 7) {
    out.push(i);
    if (i === b) break;
  }
  return out;
}

/** Dias cubiertos por la etiqueta de un bloque de horario. */
function keyDays(key: string): number[] {
  const k = key.toLowerCase();
  const dayMentions = mentions(k);

  if (/\sa\s/.test(k) && dayMentions.length >= 2) {
    return range(dayMentions[0], dayMentions[dayMentions.length - 1]);
  }
  return dayMentions;
}

/** Si un bloque de horas esta "abierto" en el momento dado. */
function inTimeRange(value: string, now: Date): boolean {
  const m = value.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return false;

  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (start <= end) return nowMin >= start && nowMin <= end;
  // horario que cruza la medianoche
  return nowMin >= start || nowMin <= end;
}

/**
 * Determina si un negocio esta abierto ahora segun su mapa de horarios.
 * Formato: { 'Lunes a Viernes': '06:30 - 15:00', Sábado: 'Cerrado' }
 */
export function isOpenNow(hours: Record<string, string> | undefined, now = new Date()): boolean {
  if (!hours) return false;

  for (const [key, value] of Object.entries(hours)) {
    const v = (value || '').toLowerCase();
    if (!v || v.includes('cerrado') || v.includes('cita previa')) continue;
    if (keyDays(key).includes(now.getDay()) && inTimeRange(value, now)) {
      return true;
    }
  }
  return false;
}

/** Etiqueta para mostrar "Abierto ahora" / "Cerrado ahora". */
export function openNowLabel(hours: Record<string, string> | undefined, now = new Date()): string {
  return isOpenNow(hours, now) ? 'Abierto ahora' : 'Cerrado ahora';
}