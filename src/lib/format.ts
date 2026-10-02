// Utilidades de formato y links — seguras para cliente

const TZ = 'America/Argentina/Buenos_Aires'

/** Fecha de hoy (Argentina) como "YYYY-MM-DD" */
export function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { y, m, d }
}

function utcNoon(dateStr: string): number {
  const { y, m, d } = parseDateParts(dateStr)
  return Date.UTC(y, m - 1, d, 12)
}

function toStr(ms: number): string {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD" */
export function addDaysStr(dateStr: string, n: number): string {
  return toStr(utcNoon(dateStr) + n * 86400000)
}

/** Título amigable del día: "Hoy", "Mañana", "Ayer" o "lunes 6 de octubre" */
export function formatDayTitle(dateStr: string): string {
  const today = todayStr()
  if (dateStr === today) return 'Hoy'
  if (dateStr === addDaysStr(today, 1)) return 'Mañana'
  if (dateStr === addDaysStr(today, -1)) return 'Ayer'
  const dt = new Date(utcNoon(dateStr))
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dt)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Etiqueta corta: "lun 2 oct" */
export function formatDayShort(dateStr: string): string {
  const dt = new Date(utcNoon(dateStr))
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt)
  return label.replace(/\./g, '')
}

export function isPast(dateStr: string): boolean {
  return dateStr < todayStr()
}

/** Link de WhatsApp a partir del teléfono guardado (formato AR best-effort) */
export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null
  let d = digits
  if (!d.startsWith('54')) {
    d = d.replace(/^0+/, '')
    if (!d.startsWith('54')) d = '54' + d
  }
  return `https://wa.me/${d}`
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.replace(/\+/g, '').length < 6) return null
  return `tel:${digits}`
}

/** Escapa HTML para popups del mapa */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Formatea fecha ISO relativa para "última sincronización" */
export function formatDateTimeEs(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const dt = new Date(iso)
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    }).format(dt)
  } catch {
    return null
  }
}

export function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`
}

export function formatMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
