"use client"

// Vista Ruta del día: optimiza el orden de las visitas, muestra el mapa
// y permite abrir la ruta completa en Google Maps.

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  CalendarDays,
  CircleCheck,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Route as RouteIcon,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import RouteMap, { type MapPoint } from "@/components/agenda/route-map"
import { planDay } from "@/lib/actions"
import {
  addDaysStr,
  formatDayTitle,
  formatDayShort,
  formatKm,
  formatMin,
  isPast,
  todayStr,
  waLink,
  telLink,
} from "@/lib/format"
import { coordsSearchUrl, placeSearchUrl } from "@/lib/geo"
import type { DayPlan, MeetingDTO, SettingsDTO, StartMode } from "@/lib/types"

export default function RouteView({
  meetings,
  settings,
  selectedDate,
  onOpenSettings,
  onToggleDone,
}: {
  meetings: MeetingDTO[]
  settings: SettingsDTO
  selectedDate: string | null
  onOpenSettings: () => void
  onToggleDone: (id: string, done: boolean) => void
}) {
  const datesWithMeetings = useMemo(() => {
    const set = new Set<string>(meetings.map((m) => m.date))
    set.add(todayStr())
    set.add(addDaysStr(todayStr(), 1))
    return [...set].sort()
  }, [meetings])

  const firstUpcoming = useMemo(() => {
    const today = todayStr()
    const upcoming = [...new Set(meetings.map((m) => m.date))].filter((d) => d >= today).sort()
    return upcoming[0] ?? todayStr()
  }, [meetings])

  const [date, setDate] = useState<string>(selectedDate ?? firstUpcoming)
  const [startMode, setStartMode] = useState<StartMode>(settings.startLat != null ? "saved" : "first")
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [loading, setLoading] = useState(true)

  // Sincronizar la fecha elegida desde la Agenda (patrón: ajustar estado durante render)
  const [lastExternalDate, setLastExternalDate] = useState<string | null>(selectedDate)
  if (selectedDate !== lastExternalDate) {
    setLastExternalDate(selectedDate)
    if (selectedDate) {
      setDate(selectedDate)
      setLoading(true)
    }
  }

  function chooseDate(d: string) {
    if (d === date) return
    setLoading(true)
    setDate(d)
  }

  function chooseStartMode(v: StartMode) {
    if (v === startMode) return
    setLoading(true)
    setStartMode(v)
  }

  useEffect(() => {
    let live = true
    planDay(date, startMode)
      .then((p) => {
        if (live) {
          setPlan(p)
          setLoading(false)
        }
      })
      .catch(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [date, startMode, meetings])

  const mapPoints: MapPoint[] = useMemo(() => {
    if (!plan) return []
    const pts: MapPoint[] = []
    if (plan.startLat != null && plan.startLng != null) {
      pts.push({ lat: plan.startLat, lng: plan.startLng, label: "Salida", sub: plan.startLabel ?? "", kind: "start" })
    }
    plan.stops.forEach((s, i) => {
      if (s.lat != null && s.lng != null) {
        pts.push({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.company}`, sub: s.address, kind: "stop", order: i + 1 })
      }
    })
    return pts
  }, [plan])

  const polyline: [number, number][] | null = useMemo(() => {
    if (!plan || mapPoints.length < 2) return null
    return mapPoints.map((p) => [p.lat, p.lng])
  }, [plan, mapPoints])

  const dayMeetings = meetings.filter((m) => m.date === date)

  return (
    <div className="space-y-4">
      {/* Selector de día */}
      <div>
        <Label className="mb-1.5 block text-muted-foreground">Elegí el día</Label>
        <div className="rv-scroll flex gap-1.5 overflow-x-auto pb-1">
          {datesWithMeetings.map((d) => {
            const dayAll = meetings.filter((m) => m.date === d)
            const dayDone = dayAll.filter((m) => m.done).length
            const dayPending = dayAll.length - dayDone
            const active = d === date
            return (
              <Button
                key={d}
                size="sm"
                variant={active ? "default" : "outline"}
                className={`h-10 shrink-0 flex-col items-start gap-0 rounded-lg px-3 ${active ? "" : ""}`}
                onClick={() => chooseDate(d)}
              >
                <span className="text-xs font-semibold leading-tight">
                  {d === todayStr() ? "Hoy" : d === addDaysStr(todayStr(), 1) ? "Mañana" : formatDayTitle(d).split(" ").slice(0, 2).join(" ")}
                </span>
                <span className={`text-[10px] leading-tight ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {dayAll.length === 0
                    ? "sin visitas"
                    : dayPending === dayAll.length
                      ? `${formatDayShort(d)} · ${dayAll.length} visita${dayAll.length > 1 ? "s" : ""}`
                      : `${formatDayShort(d)} · ${dayPending} de ${dayAll.length} pendiente${dayPending === 1 ? "" : "s"}`}
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Parámetros y resumen */}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end justify-between gap-3 px-4">
          <div className="grid gap-1.5">
            <Label htmlFor="start-mode" className="text-xs text-muted-foreground">
              Salida de la ruta
            </Label>
            <Select value={startMode} onValueChange={(v) => chooseStartMode(v as StartMode)}>
              <SelectTrigger id="start-mode" className="w-[240px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved" disabled={settings.startLat == null}>
                  ★ Mi ubicación guardada
                </SelectItem>
                <SelectItem value="first">Primera reunión del día</SelectItem>
              </SelectContent>
            </Select>
            {settings.startLat == null && (
              <button onClick={onOpenSettings} className="text-left text-xs text-emerald-700 hover:underline dark:text-emerald-400">
                Configurá tu ubicación de partida en Ajustes →
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Calculando mejor ruta…
              </span>
            ) : (
              plan && plan.stops.length > 0 && (
                <>
                  <Badge variant="secondary" className="gap-1 py-1.5">
                    <MapPin className="size-3.5" /> {plan.stops.length} parada{plan.stops.length > 1 ? "s" : ""}
                  </Badge>
                  {plan.totalKm > 0 && (
                    <Badge variant="secondary" className="gap-1 py-1.5">
                      <RouteIcon className="size-3.5" /> ≈ {formatKm(plan.totalKm)}
                    </Badge>
                  )}
                  {plan.totalMin > 0 && (
                    <Badge variant="secondary" className="gap-1 py-1.5">
                      ≈ {formatMin(plan.totalMin)} en auto
                    </Badge>
                  )}
                  {plan.optimized && (
                    <Badge className="gap-1 bg-emerald-600 py-1.5 text-white hover:bg-emerald-600">
                      <Navigation className="size-3.5" /> Ruta optimizada
                    </Badge>
                  )}
                </>
              )
            )}
            {!loading && plan && plan.doneStops.length > 0 && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-600/40 py-1.5 text-emerald-700 dark:text-emerald-400"
              >
                <CircleCheck className="size-3.5" /> {plan.doneStops.length} realizada{plan.doneStops.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Avisos */}
      {!loading && plan && plan.stops.length > 0 && (
        <>
          {plan.unresolved.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {plan.unresolved.length} dirección{plan.unresolved.length > 1 ? "es" : ""} sin ubicar en el mapa
                </p>
                <p className="mt-0.5 text-xs">
                  {plan.unresolved.join(" · ")}. Quedan al final de la lista. Podés agregar el link de Google Maps o
                  completar la dirección para ubicarlas.
                </p>
              </div>
            </div>
          )}
          {plan.waypointsLimitReached && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs">
                Hay más de 11 paradas: Google Maps admite hasta 9 intermedias por enlace, se incluyen las primeras.
              </p>
            </div>
          )}
          {plan.geocodeCapped && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs">
                Hay muchas direcciones nuevas por ubicar. Tocá &quot;Cambiar salida&quot; o volvé a entrar en esta
                pantalla en unos segundos para ubicar el resto.
              </p>
            </div>
          )}
        </>
      )}

      {/* Mapa */}
      {!loading && mapPoints.length > 0 && (
        <Card className="py-3">
          <CardContent className="px-3">
            <RouteMap points={mapPoints} polyline={polyline} />
          </CardContent>
        </Card>
      )}

      {/* Lista de paradas */}
      {loading ? (
        <Card className="py-10">
          <CardContent className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Ubicando direcciones y calculando la mejor ruta…</span>
          </CardContent>
        </Card>
      ) : plan && (plan.stops.length > 0 || plan.doneStops.length > 0) ? (
        <div className="space-y-2">
          {!loading && plan.stops.length === 0 && plan.doneStops.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-3 text-emerald-800 dark:text-emerald-300">
              <CircleCheck className="size-5 shrink-0" />
              <p className="text-sm font-medium">¡Completaste todas las visitas del día!</p>
            </div>
          )}
          {plan.startLabel && plan.stops.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                ★
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Salida: {plan.startLabel}</p>
                <p className="text-xs text-muted-foreground">Punto de partida de la ruta optimizada</p>
              </div>
            </div>
          )}
          {plan.stops.map((s, i) => (
            <div key={s.id}>
              {i > 0 && s.legKm != null && (
                <div className="flex items-center justify-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                  <ArrowDown className="size-3.5" />
                  {formatKm(s.legKm)} · {formatMin(s.legMin ?? 0)} en auto
                  <ArrowDown className="size-3.5" />
                </div>
              )}
              <Card className={`py-3 ${s.unresolved ? "border-dashed" : ""}`}>
                <CardContent className="flex gap-3 px-3">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        s.unresolved ? "bg-muted-foreground" : "bg-emerald-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{s.time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight">{s.company}</h3>
                    <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {s.address}
                    </p>
                    {(s.contact || s.phone) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                        {s.contact && (
                          <span className="flex items-center gap-1.5">
                            <User className="size-3.5 shrink-0" /> {s.contact}
                          </span>
                        )}
                        {s.phone && <span className="flex items-center gap-1.5">{s.phone}</span>}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-emerald-600/40 text-xs text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
                        onClick={() => onToggleDone(s.id, true)}
                      >
                        <CircleCheck className="size-3.5" /> Visita realizada
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <a
                          href={
                            s.mapsUrl
                              ? s.mapsUrl
                              : s.lat != null && s.lng != null
                                ? coordsSearchUrl({ lat: s.lat, lng: s.lng })
                                : placeSearchUrl(s.address)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-3.5" /> Cómo llegar
                        </a>
                      </Button>
                      {telLink(s.phone) && (
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                          <a href={telLink(s.phone) as string}>Llamar</a>
                        </Button>
                      )}
                      {waLink(s.phone) && (
                        <Button
                          asChild
                          size="sm"
                          className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        >
                          <a href={waLink(s.phone) as string} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                    {s.unresolved && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-3.5" /> No se pudo ubicar en el mapa
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}

          {/* Visitas ya realizadas del día */}
          {plan.doneStops.length > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                Ya realizadas ({plan.doneStops.length})
              </h3>
              <div className="space-y-2">
                {plan.doneStops.map((s) => (
                  <Card key={s.id} className="border-emerald-600/30 bg-emerald-600/5 py-2.5 dark:bg-emerald-500/10">
                    <CardContent className="flex items-center gap-3 px-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <CircleCheck className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-muted-foreground line-through decoration-emerald-600/60">
                          {s.company}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.time} hs · {s.address}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0 gap-1.5 text-xs"
                        onClick={() => onToggleDone(s.id, false)}
                        aria-label={`Marcar ${s.company} como pendiente`}
                      >
                        <RotateCcw className="size-3.5" /> Deshacer
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="py-10">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-600/10">
              <CalendarDays className="size-7 text-emerald-700 dark:text-emerald-400" />
            </div>
            {dayMeetings.length === 0 && meetings.length > 0 ? (
              <>
                <p className="font-medium">No hay visitas este día</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Elegí otro día del listado de arriba, o mirá la agenda para ver cuándo tenés reuniones.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Tu agenda está vacía</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Conectá tu hoja de Google Sheets o agregá reuniones a mano para calcular rutas.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* CTA Google Maps */}
      {!loading && plan?.googleMapsUrl && (
        <Button asChild size="lg" className="w-full gap-2 text-base">
          <a href={plan.googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="size-5" /> Abrir ruta en Google Maps
          </a>
        </Button>
      )}

      {!loading && plan && plan.stops.length > 1 && plan.optimized && (
        <p className="flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Home className="mt-0.5 size-3.5 shrink-0" />
          Las distancias son estimadas (en auto, por calle). Las horas de cada reunión son de referencia: ajustalas
          según tu nueva ruta.
        </p>
      )}
    </div>
  )
}
