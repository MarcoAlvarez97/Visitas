"use client"

// Vista Agenda: reuniones agrupadas por fecha con filtros y acciones rápidas

import { useMemo, useState } from "react"
import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  ExternalLink,
  FileSpreadsheet,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  RotateCcw,
  Route,
  StickyNote,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDayTitle, formatDayShort, isPast, todayStr, waLink, telLink } from "@/lib/format"
import { coordsSearchUrl, placeSearchUrl } from "@/lib/geo"
import type { MeetingDTO } from "@/lib/types"

type Filter = "proximas" | "hoy" | "pasadas" | "realizadas" | "todas"

function mapsLinkFor(m: MeetingDTO): string {
  if (m.mapsUrl) return m.mapsUrl
  if (m.lat != null && m.lng != null) return coordsSearchUrl({ lat: m.lat, lng: m.lng })
  return placeSearchUrl(m.address)
}

function MeetingCard({
  m,
  onEdit,
  onToggleDone,
}: {
  m: MeetingDTO
  onEdit: (m: MeetingDTO) => void
  onToggleDone: (id: string, done: boolean) => void
}) {
  const wa = waLink(m.phone)
  const tel = telLink(m.phone)
  return (
    <Card className={`py-3 transition-colors ${m.done ? "border-emerald-600/30 bg-emerald-600/5 dark:bg-emerald-500/10" : ""}`}>
      <CardContent className="flex gap-3 px-3">
        {/* Hora */}
        <div
          className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-lg py-2 text-center ${
            m.done
              ? "bg-emerald-600 text-white"
              : "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          }`}
        >
          {m.done ? (
            <>
              <CircleCheck className="size-5" aria-hidden />
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide">Hecha</span>
            </>
          ) : (
            <>
              <span className="text-base font-bold leading-none">{m.time}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-70">hs</span>
            </>
          )}
        </div>

        {/* Datos */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`truncate font-semibold leading-tight ${
                m.done ? "text-muted-foreground line-through decoration-emerald-600/60" : ""
              }`}
            >
              {m.company}
            </h3>
            {m.done && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-emerald-600/40 text-[10px] text-emerald-700 dark:text-emerald-400"
              >
                <CircleCheck className="size-3" /> Realizada
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mt-1.5 -mr-1.5 size-8 shrink-0" aria-label="Más acciones">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(m)}>
                  <Pencil className="size-4" /> Editar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <a
            href={mapsLinkFor(m)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{m.address}</span>
          </a>

          {(m.contact || m.phone) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {m.contact && (
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5 shrink-0" /> {m.contact}
                </span>
              )}
              {m.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" /> {m.phone}
                </span>
              )}
            </div>
          )}

          {m.notes && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
              <StickyNote className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-2">{m.notes}</span>
            </p>
          )}

          {/* Acciones rápidas */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={m.done ? "outline" : "default"}
              className={`h-8 gap-1.5 text-xs ${
                m.done
                  ? "border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              onClick={() => onToggleDone(m.id, !m.done)}
            >
              {m.done ? <RotateCcw className="size-3.5" /> : <CircleCheck className="size-3.5" />}
              {m.done ? "Marcar pendiente" : "Visita realizada"}
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <a href={mapsLinkFor(m)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" /> Ver en Maps
              </a>
            </Button>
            {tel && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <a href={tel}>
                  <Phone className="size-3.5" /> Llamar
                </a>
              </Button>
            )}
            {wa && (
              <Button
                asChild
                size="sm"
                className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AgendaView({
  meetings,
  onEdit,
  onNew,
  onSeeRoute,
  onToggleDone,
}: {
  meetings: MeetingDTO[]
  onEdit: (m: MeetingDTO) => void
  onNew: () => void
  onSeeRoute: (date: string) => void
  onToggleDone: (id: string, done: boolean) => void
}) {
  const [filter, setFilter] = useState<Filter>("proximas")
  const today = todayStr()

  const groups = useMemo(() => {
    const sorted = [...meetings].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      // dentro del mismo día: pendientes primero, luego por hora
      if (a.done !== b.done) return a.done ? 1 : -1
      return a.time === b.time ? 0 : a.time < b.time ? -1 : 1
    })
    const byDate = new Map<string, MeetingDTO[]>()
    for (const m of sorted) {
      const arr = byDate.get(m.date) ?? []
      arr.push(m)
      byDate.set(m.date, arr)
    }
    let entries = [...byDate.entries()]
    if (filter === "proximas") entries = entries.filter(([d]) => d >= today)
    if (filter === "hoy") entries = entries.filter(([d]) => d === today)
    if (filter === "pasadas") entries = entries.filter(([d]) => d < today)
    if (filter === "realizadas") {
      entries = entries
        .map(([d, list]) => [d, list.filter((m) => m.done)] as [string, MeetingDTO[]])
        .filter(([, list]) => list.length > 0)
    }
    // "Hoy" primero, luego cronológico (en Realizadas, más reciente primero)
    entries.sort(([a], [b]) => {
      if (filter === "realizadas") return a > b ? -1 : 1
      if (a === today) return -1
      if (b === today) return 1
      return a < b ? -1 : 1
    })
    return entries
  }, [meetings, filter, today])

  const doneCount = meetings.filter((m) => m.done).length
  const filters: { key: Filter; label: string }[] = [
    { key: "proximas", label: "Próximas" },
    { key: "hoy", label: "Hoy" },
    { key: "pasadas", label: "Pasadas" },
    { key: "realizadas", label: doneCount > 0 ? `Realizadas (${doneCount})` : "Realizadas" },
    { key: "todas", label: "Todas" },
  ]

  return (
    <div className="space-y-4">
      {/* Filtros + nueva reunión */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="rv-scroll flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="h-9 rounded-full"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={onNew}>
          <CalendarPlus className="size-4" /> Nueva reunión
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="py-10">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-600/10">
              <CalendarDays className="size-7 text-emerald-700 dark:text-emerald-400" />
            </div>
            {meetings.length === 0 ? (
              <>
                <p className="font-medium">Todavía no hay reuniones en tu agenda</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Agregá una reunión a mano o conectá tu hoja de Google Sheets desde la pestaña Ajustes para
                  importar todas tus visitas de una vez.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <Button onClick={onNew} className="gap-1.5">
                    <CalendarPlus className="size-4" /> Agregar reunión
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay reuniones para este filtro.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        groups.map(([date, list]) => {
          const past = isPast(date)
          const isToday = date === today
          const doneInDay = list.filter((m) => m.done).length
          return (
            <section key={date} aria-label={formatDayTitle(date)}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {formatDayTitle(date)}
                  <span className="ml-2 font-normal normal-case text-muted-foreground/70">
                    {formatDayShort(date)}
                  </span>
                </h2>
                {isToday && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Hoy</Badge>}
                {past && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Pasada
                  </Badge>
                )}
                <Badge variant="secondary">{list.length} visita{list.length > 1 ? "s" : ""}</Badge>
                {doneInDay > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-600/40 text-emerald-700 dark:text-emerald-400"
                  >
                    <CircleCheck className="size-3" /> {doneInDay}/{list.length} realizada{doneInDay > 1 ? "s" : ""}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  onClick={() => onSeeRoute(date)}
                >
                  <Route className="size-4" /> Ver ruta
                </Button>
              </div>
              <div className="space-y-2">
                {list.map((m) => (
                  <MeetingCard key={m.id} m={m} onEdit={onEdit} onToggleDone={onToggleDone} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {meetings.some((m) => m.source === "SHEETS") && (
        <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="size-3.5" /> Las reuniones importadas de Google Sheets se reemplazan en cada sincronización.
        </p>
      )}
    </div>
  )
}
