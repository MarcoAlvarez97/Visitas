// Utilidades de parseo: CSV, fechas, horas, teléfonos y URLs de Google Maps
// (seguras para usar en cliente y servidor)

// ---------- Normalización de texto ----------

/** minúsculas, sin acentos, sin espacios extra */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function pad(n: number | string): string {
  return String(n).padStart(2, '0')
}

// ---------- CSV ----------

/** Parser CSV robusto: soporta comillas, comas dentro de comillas, CRLF y BOM */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else if (c !== '\r') {
        field += c
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// ---------- Detección de columnas ----------

export const FIELDS = ['date', 'time', 'company', 'address', 'contact', 'phone', 'maps', 'notes'] as const
export type FieldKey = (typeof FIELDS)[number]

const SYNONYMS: Record<FieldKey, string[]> = {
  date: ['fecha', 'fecha visita', 'fecha reunion', 'fecha de reunion', 'dia', 'dia visita', 'date', 'day', 'visita', 'fecha de visita'],
  time: ['hora', 'hora visita', 'hora reunion', 'horario', 'time', 'hs', 'hrs', 'hora de visita'],
  company: ['empresa', 'cliente', 'company', 'nombre empresa', 'empresa cliente', 'nombre cliente', 'razon social', 'cuenta', 'nombre'],
  address: ['direccion', 'address', 'domicilio', 'ubicacion', 'location', 'dir', 'direccion empresa', 'lugar', 'direccion de la empresa'],
  contact: ['contacto', 'contact', 'persona de contacto', 'contacto empresa', 'nombre contacto', 'persona', 'referente', 'contacto comercial', 'nombre del contacto'],
  phone: ['telefono', 'phone', 'tel', 'celular', 'movil', 'whatsapp', 'tel contacto', 'telefono contacto', 'wpp', 'whats', 'telefono de contacto'],
  maps: ['maps', 'mapa', 'link', 'enlace', 'link google maps', 'google maps', 'googlemaps', 'url', 'link maps', 'ubicacion maps', 'maps link', 'link de google maps'],
  notes: ['notas', 'notes', 'observaciones', 'comentarios', 'detalle', 'detalles', 'comentario'],
}

/** Devuelve para cada campo el índice de columna donde se encontró (o nada) */
export function detectColumns(headers: string[]): Partial<Record<FieldKey, number>> {
  const result: Partial<Record<FieldKey, number>> = {}
  const used = new Set<number>()
  const normHeaders = headers.map((h) => norm(h))

  // 1) coincidencia exacta
  for (const f of FIELDS) {
    for (let i = 0; i < normHeaders.length; i++) {
      if (used.has(i)) continue
      if (SYNONYMS[f].includes(normHeaders[i])) {
        result[f] = i
        used.add(i)
        break
      }
    }
  }
  // 2) coincidencia por inclusión (solo sinónimos de 4+ caracteres)
  for (const f of FIELDS) {
    if (result[f] !== undefined) continue
    for (let i = 0; i < normHeaders.length; i++) {
      if (used.has(i)) continue
      const h = normHeaders[i]
      if (!h) continue
      if (SYNONYMS[f].some((s) => s.length >= 4 && h.includes(s))) {
        result[f] = i
        used.add(i)
        break
      }
    }
  }
  return result
}

/** Orden posicional por defecto si la hoja no tiene encabezados reconocibles */
export const POSITIONAL_COLS: Partial<Record<FieldKey, number>> = {
  date: 0,
  time: 1,
  company: 2,
  address: 3,
  contact: 4,
  phone: 5,
  maps: 6,
  notes: 7,
}

/** Indica si la fila parece ser una fila de encabezados */
export function looksLikeHeader(row: string[]): boolean {
  const c = detectColumns(row)
  const keys = Object.keys(c).length
  return keys >= 3 || ('company' in c && ('address' in c || 'date' in c))
}

// ---------- Fechas ----------

const DAY_NAME_RE = /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo|lun|mar|mie|jue|vie|sab|dom)\.?\s*/i
const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
}

/** Parsea fechas en español / ISO → "YYYY-MM-DD" (o null) */
export function parseSheetDate(raw: string): string | null {
  if (!raw) return null
  const s = norm(raw).replace(DAY_NAME_RE, '').trim()
  if (!s) return null

  // ISO: 2026-10-05 (permite hora pegada)
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3]
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (también 2 dígitos de año)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) {
    let d = +m[1]
    let mo = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    // formato español: día primero; si el "día" > 12 en realidad era mes, invertimos
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`
    return null
  }

  // "5 oct", "5 de octubre"
  m = s.match(/^(\d{1,2})\s*(?:de\s*)?([a-z]+)$/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3)]
    if (mo) {
      const y = new Date().getFullYear()
      return `${y}-${pad(mo)}-${pad(+m[1])}`
    }
  }
  return null
}

// ---------- Horas ----------

/** Parsea horas → "HH:mm" (o null) */
export function parseSheetTime(raw: string): string | null {
  if (!raw) return null
  let s = norm(raw)
  const pm = /\bp\.?m\.?\b/.test(s) || /\bpm\b/.test(s)
  const am = /\ba\.?m\.?\b/.test(s) || /\bam\b/.test(s)
  s = s.replace(/\b(p\.?m\.?|a\.?m\.?)\b/g, '').replace(/h|hs|hrs|horas/g, '').trim()

  // HH:mm o HH.mm (opcional :ss)
  let m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/)
  if (m) {
    let h = +m[1]
    const mi = +m[2]
    if (pm && h < 12) h += 12
    if (am && h === 12) h = 0
    if (h <= 23 && mi <= 59) return `${pad(h)}:${pad(mi)}`
    return null
  }
  // solo hora: "9"
  m = s.match(/^(\d{1,2})$/)
  if (m) {
    let h = +m[1]
    if (pm && h < 12) h += 12
    if (h <= 23) return `${pad(h)}:00`
  }
  // "930" / "1430"
  m = s.match(/^(\d{3,4})$/)
  if (m) {
    const v = m[1]
    let h = +v.slice(0, v.length - 2)
    const mi = +v.slice(-2)
    if (pm && h < 12) h += 12
    if (h <= 23 && mi <= 59) return `${pad(h)}:${pad(mi)}`
  }
  return null
}

// ---------- Teléfonos ----------

/** Normaliza a formato internacional argentino para links de WhatsApp (best-effort) */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('54')) return d
  d = d.replace(/^0+/, '')
  if (d.startsWith('54')) return d
  if (d.length < 8) return null // demasiado corto para ser un teléfono real
  return '54' + d
}

/** Teléfono para mostrar (limpia espacios duplicados) */
export function displayPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  return t || null
}

// ---------- URLs de Google Maps ----------

/** Extrae coordenadas de un link de Google Maps, si las tiene */
export function extractCoordsFromMapsUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url) return null
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|destination|ll|center|daddr)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /(-?\d{1,3}\.\d+)%2C\s*(-?\d{1,3}\.\d+)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}

/** Extrae el ID de hoja y el gid de una URL de Google Sheets */
export function extractSheetIds(url: string): { id: string; gid: string } | null {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!m) return null
  let gid = '0'
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  if (gidMatch) gid = gidMatch[1]
  return { id: m[1], gid }
}
