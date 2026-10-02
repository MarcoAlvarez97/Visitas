// Helpers de servidor: DTOs y acceso a tablas (sin ser server actions)

import { db } from '@/lib/db'
import type { Meeting, Settings } from '@prisma/client'
import type { MeetingDTO, SettingsDTO } from '@/lib/types'

export function toMeetingDTO(m: Meeting): MeetingDTO {
  return {
    id: m.id,
    date: m.date,
    time: m.time,
    company: m.company,
    address: m.address,
    contact: m.contact,
    phone: m.phone,
    mapsUrl: m.mapsUrl,
    notes: m.notes,
    lat: m.lat,
    lng: m.lng,
    done: m.done,
    doneAt: m.doneAt ? m.doneAt.toISOString() : null,
    source: m.source,
  }
}

export function toSettingsDTO(s: Settings): SettingsDTO {
  return {
    sheetsUrl: s.sheetsUrl,
    startAddress: s.startAddress,
    startLat: s.startLat,
    startLng: s.startLng,
    lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
    lastSyncMsg: s.lastSyncMsg,
  }
}

/** Obtiene (o crea) la única fila de configuración */
export async function getSettingsRow(): Promise<Settings> {
  const existing = await db.settings.findUnique({ where: { id: 'default' } })
  if (existing) return existing
  return db.settings.create({ data: { id: 'default' } })
}

/** Ordena reuniones por fecha, hora y creación */
export const MEETING_ORDER = [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }] as const
