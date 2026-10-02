// Geocodificación server-side con Nominatim (OpenStreetMap) + caché en DB
// Respeta el límite de ~1 req/seg con throttling.

import { db } from '@/lib/db'

const UA = 'RutaVisitas/1.0 (agenda de visitas a clientes)'

let lastCall = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, 1100 - (now - lastCall))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  await throttle()
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as Array<{ lat: string; lon: string }>
    const first = json?.[0]
    if (!first) return null
    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

/** Geocodifica una dirección usando la caché primero. Devuelve null si falla. */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const clean = address.trim().replace(/\s+/g, ' ')
  if (!clean) return null

  const cached = await db.geocodeCache.findUnique({ where: { address: clean } })
  if (cached) return { lat: cached.lat, lng: cached.lng }

  // 1º intento: con ", Argentina" (el uso principal es local); 2º: dirección cruda
  let coords = await nominatimSearch(`${clean}, Argentina`)
  if (!coords) coords = await nominatimSearch(clean)
  if (!coords) return null

  await db.geocodeCache
    .create({ data: { address: clean, lat: coords.lat, lng: coords.lng } })
    .catch(() => {})
  return coords
}

/** Geocodificación inversa: coordenadas → dirección legible */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  await throttle()
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=es&lat=${lat}&lon=${lng}`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { display_name?: string }
    return json?.display_name ?? null
  } catch {
    return null
  }
}
