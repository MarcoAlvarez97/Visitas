// Tipos compartidos entre servidor y cliente

export type MeetingDTO = {
  id: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  company: string
  address: string
  contact: string | null
  phone: string | null
  mapsUrl: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  done: boolean // visita ya realizada
  doneAt: string | null // ISO
  source: string // "MANUAL" | "SHEETS"
}

export type MeetingInput = {
  date: string
  time: string
  company: string
  address: string
  contact?: string | null
  phone?: string | null
  mapsUrl?: string | null
  notes?: string | null
}

export type SettingsDTO = {
  sheetsUrl: string | null
  startAddress: string | null
  startLat: number | null
  startLng: number | null
  lastSyncAt: string | null
  lastSyncMsg: string | null
}

export type StartMode = 'saved' | 'first'

export type RouteStop = {
  id: string
  time: string
  company: string
  address: string
  contact: string | null
  phone: string | null
  mapsUrl: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  legKm: number | null // distancia desde la parada anterior
  legMin: number | null // tiempo estimado en auto desde la parada anterior
  unresolved: boolean // no se pudo ubicar en el mapa
  done: boolean // visita ya realizada
}

export type DayPlan = {
  date: string
  stops: RouteStop[] // paradas pendientes (optimizadas)
  doneStops: RouteStop[] // visitas ya realizadas del día (fuera de la ruta)
  totalKm: number
  totalMin: number
  optimized: boolean
  startLabel: string | null
  startLat: number | null
  startLng: number | null
  unresolved: string[] // "Empresa — dirección"
  googleMapsUrl: string | null
  waypointsLimitReached: boolean
  geocodeCapped: boolean
}

export type SyncResult = {
  ok: boolean
  imported: number
  errors: string[]
  message: string
  meetings?: MeetingDTO[] // lista actualizada tras la sincronización
}

export type ActionResult = {
  ok: boolean
  error?: string
}
