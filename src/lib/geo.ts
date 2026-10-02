// Optimización de rutas: Haversine + Nearest Neighbor + 2-opt (camino abierto)
// y construcción de URLs de Google Maps

export type LatLng = { lat: number; lng: number }

/** Factor para convertir distancia en línea recta a distancia aproximada en calle */
export const ROAD_FACTOR = 1.3
/** Velocidad urbana promedio para estimar tiempos (km/h) */
export const URBAN_KMH = 28
/** Límite de paradas intermedias de la URL de Google Maps */
export const MAX_WAYPOINTS = 9

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Distancia "real" aproximada (línea recta × factor de calle) */
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR
}

/** Tiempo estimado en auto (minutos) */
export function driveMinutes(km: number): number {
  return Math.max(2, Math.round((km / URBAN_KMH) * 60))
}

/**
 * Mejora el orden de visita con 2-opt para camino abierto (no vuelve al origen).
 * fixedStart: si el primer punto ya está fijado (p. ej. la primera reunión por horario).
 */
function twoOptPath(order: number[], pts: LatLng[], fixedStart: boolean): number[] {
  const n = order.length
  if (n < 4) return order
  const d = (i: number, j: number) => haversineKm(pts[order[i]], pts[order[j]])
  let improved = true
  let guard = 0
  while (improved && guard++ < 60) {
    improved = false
    const startI = fixedStart ? 1 : 0
    for (let i = startI; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        let delta = 0
        if (i > 0) delta += d(i - 1, j) - d(i - 1, i)
        if (j < n - 1) delta += d(i, j + 1) - d(j, j + 1)
        if (delta < -1e-9) {
          let lo = i
          let hi = j
          while (lo < hi) {
            const t = order[lo]
            order[lo] = order[hi]
            order[hi] = t
            lo++
            hi--
          }
          improved = true
        }
      }
    }
  }
  return order
}

/**
 * Ordena los índices de `pts` para minimizar la distancia recorrida.
 * anchorFirst=true deja el punto 0 fijo como primera parada.
 */
export function optimizeOrder(pts: LatLng[], anchorFirst: boolean): number[] {
  const n = pts.length
  if (n <= 2) return pts.map((_, i) => i)

  const remaining = new Set<number>()
  const from = anchorFirst ? 1 : 0
  for (let i = from; i < n; i++) remaining.add(i)
  const order: number[] = anchorFirst ? [0] : [0]
  if (!anchorFirst) remaining.delete(0)
  let cur = 0

  // Vecino más cercano
  while (remaining.size > 0) {
    let best = -1
    let bestD = Infinity
    for (const idx of remaining) {
      const dd = haversineKm(pts[cur], pts[idx])
      if (dd < bestD) {
        bestD = dd
        best = idx
      }
    }
    order.push(best)
    remaining.delete(best)
    cur = best
  }
  return twoOptPath(order, pts, anchorFirst)
}

// ---------- URLs de Google Maps ----------

export function coordsStr(p: LatLng): string {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
}

export function coordsSearchUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
}

export function placeSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** URL de dirección con paradas intermedias (todas como texto libre: coords o direcciones) */
export function buildDirectionsUrl(opts: {
  origin?: string | null
  destination: string
  waypoints?: string[]
}): string {
  const parts: string[] = ['https://www.google.com/maps/dir/?api=1']
  if (opts.origin) parts.push(`origin=${encodeURIComponent(opts.origin)}`)
  parts.push(`destination=${encodeURIComponent(opts.destination)}`)
  if (opts.waypoints && opts.waypoints.length > 0) {
    parts.push(`waypoints=${opts.waypoints.map((w) => encodeURIComponent(w)).join('%7C')}`)
  }
  parts.push('travelmode=driving')
  return parts.join('&')
}
