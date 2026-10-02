'use server'

// Server Actions: CRUD de reuniones, sincronización con Google Sheets / CSV,
// configuración y planificador de ruta diaria.

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import type { Meeting } from '@prisma/client'
import { toMeetingDTO, toSettingsDTO, getSettingsRow, MEETING_ORDER } from '@/lib/server-data'
import { geocodeAddress, reverseGeocode } from '@/lib/geocode'
import { parseCsv, parseSheetDate, parseSheetTime, detectColumns, looksLikeHeader, extractCoordsFromMapsUrl, extractSheetIds, POSITIONAL_COLS, FIELDS, type FieldKey } from '@/lib/parse'
import { optimizeOrder, roadKm, driveMinutes, buildDirectionsUrl, coordsStr, placeSearchUrl, MAX_WAYPOINTS } from '@/lib/geo'
import type { DayPlan, MeetingDTO, MeetingInput, RouteStop, SettingsDTO, StartMode, SyncResult } from '@/lib/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
const MAX_GEOCODES_PER_PLAN = 20

// ============ Reuniones ============

export async function getMeetings(): Promise<MeetingDTO[]> {
  const rows = await db.meeting.findMany({ orderBy: MEETING_ORDER })
  return rows.map(toMeetingDTO)
}

function validateInput(input: MeetingInput): string | null {
  if (!input.company?.trim()) return 'El nombre de la empresa es obligatorio.'
  if (!input.address?.trim()) return 'La dirección es obligatoria.'
  if (!DATE_RE.test(input.date ?? '')) return 'La fecha no es válida.'
  if (!TIME_RE.test(input.time ?? '')) return 'La hora no es válida.'
  return null
}

export async function createMeeting(input: MeetingInput): Promise<{ ok: boolean; meeting?: MeetingDTO; error?: string }> {
  const err = validateInput(input)
  if (err) return { ok: false, error: err }
  const created = await db.meeting.create({
    data: {
      date: input.date,
      time: input.time,
      company: input.company.trim(),
      address: input.address.trim(),
      contact: input.contact?.trim() || null,
      phone: input.phone?.trim() || null,
      mapsUrl: input.mapsUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      source: 'MANUAL',
    },
  })
  revalidatePath('/')
  return { ok: true, meeting: toMeetingDTO(created) }
}

export async function updateMeeting(id: string, input: MeetingInput): Promise<{ ok: boolean; meeting?: MeetingDTO; error?: string }> {
  const err = validateInput(input)
  if (err) return { ok: false, error: err }
  const existing = await db.meeting.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'La reunión no existe.' }
  const coords = extractCoordsFromMapsUrl(input.mapsUrl)
  const updated = await db.meeting.update({
    where: { id },
    data: {
      date: input.date,
      time: input.time,
      company: input.company.trim(),
      address: input.address.trim(),
      contact: input.contact?.trim() || null,
      phone: input.phone?.trim() || null,
      mapsUrl: input.mapsUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      // si cambió la dirección o el link, invalidamos coordenadas viejas
      lat: coords ? coords.lat : input.address.trim() === existing.address ? existing.lat : null,
      lng: coords ? coords.lng : input.address.trim() === existing.address ? existing.lng : null,
    },
  })
  revalidatePath('/')
  return { ok: true, meeting: toMeetingDTO(updated) }
}

export async function deleteMeeting(id: string): Promise<{ ok: boolean; error?: string }> {
  await db.meeting.delete({ where: { id } }).catch(() => {})
  revalidatePath('/')
  return { ok: true }
}

// Marca (o desmarca) una visita como realizada
export async function setMeetingDone(id: string, done: boolean): Promise<{ ok: boolean; meeting?: MeetingDTO; error?: string }> {
  const existing = await db.meeting.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'La reunión no existe.' }
  const updated = await db.meeting.update({
    where: { id },
    data: { done, doneAt: done ? new Date() : null },
  })
  revalidatePath('/')
  return { ok: true, meeting: toMeetingDTO(updated) }
}

export async function deleteAllMeetings(): Promise<{ ok: boolean }> {
  await db.meeting.deleteMany({})
  revalidatePath('/')
  return { ok: true }
}

// ============ Configuración ============

export async function getSettings(): Promise<SettingsDTO> {
  return toSettingsDTO(await getSettingsRow())
}

export async function saveSheetsUrl(url: string): Promise<SettingsDTO> {
  const clean = url.trim()
  if (clean && !extractSheetIds(clean)) {
    const s = await getSettingsRow()
    return toSettingsDTO(s)
  }
  const s = await db.settings.upsert({
    where: { id: 'default' },
    create: { id: 'default', sheetsUrl: clean || null },
    update: { sheetsUrl: clean || null },
  })
  revalidatePath('/')
  return toSettingsDTO(s)
}

export async function saveStartLocation(input: {
  address?: string
  lat?: number
  lng?: number
}): Promise<{ ok: boolean; settings?: SettingsDTO; error?: string }> {
  let address = input.address?.trim() || null
  let lat = typeof input.lat === 'number' ? input.lat : null
  let lng = typeof input.lng === 'number' ? input.lng : null

  if (address && (lat == null || lng == null)) {
    const coords = await geocodeAddress(address)
    if (coords) {
      lat = coords.lat
      lng = coords.lng
    } else {
      return { ok: false, error: 'No pudimos ubicar esa dirección en el mapa. Probá con calle, número y ciudad.' }
    }
  }
  if (lat != null && lng != null && !address) {
    const rev = await reverseGeocode(lat, lng)
    address = rev ?? 'Mi ubicación actual'
  }
  if (!address && (lat == null || lng == null)) {
    return { ok: false, error: 'Ingresá una dirección o usá tu ubicación actual.' }
  }

  const s = await db.settings.upsert({
    where: { id: 'default' },
    create: { id: 'default', startAddress: address, startLat: lat, startLng: lng },
    update: { startAddress: address, startLat: lat, startLng: lng },
  })
  revalidatePath('/')
  return { ok: true, settings: toSettingsDTO(s) }
}

// ============ Sincronización ============

export async function syncSheets(): Promise<SyncResult> {
  const settings = await getSettingsRow()
  const url = settings.sheetsUrl?.trim()
  if (!url) {
    return { ok: false, imported: 0, errors: [], message: 'Primero guardá el enlace de tu hoja de Google Sheets.' }
  }
  const ids = extractSheetIds(url)
  if (!ids) {
    return { ok: false, imported: 0, errors: [], message: 'El enlace guardado no es una URL válida de Google Sheets.' }
  }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${ids.id}/export?format=csv&gid=${ids.gid}`
  const fail = async (msg: string): Promise<SyncResult> => {
    await db.settings.update({ where: { id: 'default' }, data: { lastSyncAt: new Date(), lastSyncMsg: msg } })
    revalidatePath('/')
    return { ok: false, imported: 0, errors: [], message: msg }
  }
  try {
    const res = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(25000) })
    const text = await res.text()
    if (res.status === 404 || /^\s*<(?:!doctype )?html/i.test(text)) {
      return await fail(
        'No pudimos leer la hoja. Compartila así: Compartir → Acceso general → "Cualquier persona con el enlace" → Lector.'
      )
    }
    const result = await importCsvInternal(text)
    const finalMsg = result.ok ? `${result.message} (${new Date().toLocaleString('es-AR')})` : result.message
    await db.settings.update({ where: { id: 'default' }, data: { lastSyncAt: new Date(), lastSyncMsg: finalMsg } })
    revalidatePath('/')
    return { ...result, meetings: await freshMeetings() }
  } catch {
    return await fail('Error de conexión al intentar leer la hoja. Revisá el enlace y tu conexión.')
  }
}

async function freshMeetings(): Promise<MeetingDTO[]> {
  const rows = await db.meeting.findMany({ orderBy: MEETING_ORDER })
  return rows.map(toMeetingDTO)
}

export async function importCsvText(text: string): Promise<SyncResult> {
  if (!text.trim()) {
    return { ok: false, imported: 0, errors: [], message: 'Pegá el contenido CSV para importar.' }
  }
  const result = await importCsvInternal(text)
  revalidatePath('/')
  return { ...result, meetings: await freshMeetings() }
}

async function importCsvInternal(text: string): Promise<SyncResult> {
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { ok: false, imported: 0, errors: [], message: 'La hoja está vacía.' }
  }

  // Detectar fila de encabezados entre las primeras 5 filas
  let cols: Partial<Record<FieldKey, number>> | null = null
  let dataStart = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (looksLikeHeader(rows[i])) {
      cols = detectColumns(rows[i])
      dataStart = i + 1
      break
    }
  }
  if (!cols) cols = POSITIONAL_COLS

  const parsed: Array<MeetingInput> = []
  const errors: string[] = []

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]
    const get = (f: FieldKey): string => {
      const idx = cols?.[f]
      return idx != null ? (row[idx] ?? '').trim() : ''
    }
    const company = get('company')
    const address = get('address')
    const dateRaw = get('date')
    const rowNum = i + 1

    if (!company && !address && !dateRaw) continue // fila vacía

    if (!dateRaw) {
      errors.push(`Fila ${rowNum}: falta la fecha${company ? ` (${company})` : ''}.`)
      continue
    }
    const date = parseSheetDate(dateRaw)
    if (!date) {
      errors.push(`Fila ${rowNum}: fecha no reconocida "${dateRaw}" (usá DD/MM/AAAA).`)
      continue
    }
    if (!company) {
      errors.push(`Fila ${rowNum}: falta el nombre de la empresa.`)
      continue
    }
    if (!address) {
      errors.push(`Fila ${rowNum}: falta la dirección (${company}).`)
      continue
    }
    parsed.push({
      date,
      time: parseSheetTime(get('time')) ?? '09:00',
      company,
      address,
      contact: get('contact') || null,
      phone: get('phone') || null,
      mapsUrl: get('maps') || null,
      notes: get('notes') || null,
    })
  }

  if (parsed.length === 0) {
    const msg = 'No se pudo importar ninguna reunión de la hoja.'
    return { ok: false, imported: 0, errors: errors.slice(0, 8), message: msg }
  }

  await db.$transaction([
    db.meeting.deleteMany({ where: { source: 'SHEETS' } }),
    db.meeting.createMany({ data: parsed.map((p) => ({ ...p, source: 'SHEETS' })) }),
  ])

  const extra = errors.length > 0 ? ` ${errors.length} fila(s) con problemas fueron omitidas.` : ''
  return {
    ok: true,
    imported: parsed.length,
    errors: errors.slice(0, 8),
    message: `Se importaron ${parsed.length} reunión/es desde la hoja.${extra}`,
  }
}

// ============ Planificador de ruta diaria ============

export async function planDay(date: string, startMode: StartMode): Promise<DayPlan> {
  const empty: DayPlan = {
    date,
    stops: [],
    doneStops: [],
    totalKm: 0,
    totalMin: 0,
    optimized: false,
    startLabel: null,
    startLat: null,
    startLng: null,
    unresolved: [],
    googleMapsUrl: null,
    waypointsLimitReached: false,
    geocodeCapped: false,
  }
  if (!DATE_RE.test(date)) return empty

  const all = await db.meeting.findMany({
    where: { date },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  })
  if (all.length === 0) return empty

  // Las visitas ya realizadas no se optimizan ni entran en la ruta:
  // se listan aparte, al final.
  const doneMeetings = all.filter((m) => m.done)
  const meetings = all.filter((m) => !m.done)
  if (meetings.length === 0) {
    return {
      ...empty,
      doneStops: doneMeetings.map((m) => toStop(m, null, null)),
    }
  }

  // 1) Resolver coordenadas: link de Maps → caché/Nominatim
  const unresolved: string[] = []
  let geocoded = 0
  let geocodeCapped = false
  for (const m of meetings) {
    if (m.lat != null && m.lng != null) continue
    let coords = extractCoordsFromMapsUrl(m.mapsUrl)
    if (!coords) {
      if (geocoded >= MAX_GEOCODES_PER_PLAN) {
        geocodeCapped = true
        unresolved.push(`${m.company} — ${m.address}`)
        continue
      }
      geocoded++
      coords = await geocodeAddress(m.address)
    }
    if (coords) {
      await db.meeting.update({ where: { id: m.id }, data: { lat: coords.lat, lng: coords.lng } })
      m.lat = coords.lat
      m.lng = coords.lng
    } else {
      unresolved.push(`${m.company} — ${m.address}`)
    }
  }

  const withCoords = meetings.filter((m) => m.lat != null && m.lng != null)
  const without = meetings.filter((m) => !(m.lat != null && m.lng != null))

  // 2) Punto de partida
  const settings = await getSettingsRow()
  let startLabel: string | null = null
  let startLat: number | null = null
  let startLng: number | null = null
  let anchorFirst = true

  if (startMode === 'saved' && settings.startLat != null && settings.startLng != null) {
    startLabel = settings.startAddress ?? 'Mi ubicación'
    startLat = settings.startLat
    startLng = settings.startLng
    anchorFirst = false
  }

  // 3) Orden óptimo
  let ordered: typeof withCoords = withCoords
  if (withCoords.length > 1) {
    const pts = withCoords.map((m) => ({ lat: m.lat as number, lng: m.lng as number }))
    const idx = optimizeOrder(pts, anchorFirst)
    ordered = idx.map((i) => withCoords[i])
  }

  // 4) Tramos (legs) y totales
  const orderedAll = [...ordered, ...without]
  const stops: RouteStop[] = []
  let prev: { lat: number; lng: number } | null =
    startLat != null && startLng != null ? { lat: startLat, lng: startLng } : null
  let totalKm = 0
  let totalMin = 0
  let firstWithCoordsDone = false

  for (const m of orderedAll) {
    let legKm: number | null = null
    let legMin: number | null = null
    if (m.lat != null && m.lng != null) {
      const point = { lat: m.lat, lng: m.lng }
      if (prev != null && (firstWithCoordsDone || (startLat != null && startLng != null))) {
        legKm = roadKm(prev, point)
        legMin = driveMinutes(legKm)
        totalKm += legKm
        totalMin += legMin
      }
      firstWithCoordsDone = true
      prev = point
    }
    stops.push({
      id: m.id,
      time: m.time,
      company: m.company,
      address: m.address,
      contact: m.contact,
      phone: m.phone,
      mapsUrl: m.mapsUrl,
      notes: m.notes,
      lat: m.lat,
      lng: m.lng,
      legKm,
      legMin,
      unresolved: m.lat == null || m.lng == null,
      done: false,
    })
  }

  // 5) URL de Google Maps con todas las paradas
  let googleMapsUrl: string | null = null
  let waypointsLimitReached = false
  const hasStart = startLat != null && startLng != null
  const located = stops.filter((s) => !s.unresolved)
  if (stops.length >= 1) {
    const fallback = stops.filter((s) => s.unresolved).map((s) => s.address)
    const points = [
      ...located.map((s) => ({ str: `${s.lat},${s.lng}`, ok: true })),
      ...fallback.map((str) => ({ str, ok: false })),
    ]
    if (points.length === 1) {
      const only = stops[0]
      if (only.unresolved) {
        googleMapsUrl = placeSearchUrl(only.address)
      } else if (hasStart) {
        googleMapsUrl = buildDirectionsUrl({
          origin: coordsStr({ lat: startLat as number, lng: startLng as number }),
          destination: coordsStr({ lat: only.lat as number, lng: only.lng as number }),
        })
      } else {
        googleMapsUrl = buildDirectionsUrl({
          destination: coordsStr({ lat: only.lat as number, lng: only.lng as number }),
        })
      }
    } else {
      // Si hay ubicación de partida guardada, el origen es externo y TODAS las
      // paradas salvo la última van como waypoints; si no, la primera parada es el origen.
      const destinationPt = points[points.length - 1].str
      const middle = hasStart ? points.slice(0, -1) : points.slice(1, -1)
      waypointsLimitReached = middle.length > MAX_WAYPOINTS
      googleMapsUrl = buildDirectionsUrl({
        origin: hasStart ? coordsStr({ lat: startLat as number, lng: startLng as number }) : points[0].str,
        destination: destinationPt,
        waypoints: middle.slice(0, MAX_WAYPOINTS).map((w) => w.str),
      })
    }
  }

  return {
    date,
    stops,
    doneStops: doneMeetings.map((m) => toStop(m, null, null)),
    totalKm,
    totalMin,
    optimized: withCoords.length > 1,
    startLabel,
    startLat,
    startLng,
    unresolved,
    googleMapsUrl,
    waypointsLimitReached,
    geocodeCapped,
  }
}

function toStop(m: Meeting, legKm: number | null, legMin: number | null): RouteStop {
  return {
    id: m.id,
    time: m.time,
    company: m.company,
    address: m.address,
    contact: m.contact,
    phone: m.phone,
    mapsUrl: m.mapsUrl,
    notes: m.notes,
    lat: m.lat,
    lng: m.lng,
    legKm,
    legMin,
    unresolved: m.lat == null || m.lng == null,
    done: true,
  }
}
