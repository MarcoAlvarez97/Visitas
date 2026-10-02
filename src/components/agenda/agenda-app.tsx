"use client"

// Shell principal de RutaVisitas: navegación entre Agenda / Ruta / Ajustes,
// estado global de reuniones y configuración, diálogos y sincronización
// multi-dispositivo (los datos viven en el servidor: PC y teléfono ven lo mismo).

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  CalendarDays,
  CloudOff,
  Map,
  Moon,
  Route as RouteIcon,
  Settings,
  Smartphone,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { setMeetingDone } from "@/lib/actions"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import AgendaView from "@/components/agenda/agenda-view"
import RouteView from "@/components/agenda/route-view"
import SettingsView from "@/components/agenda/settings-view"
import MeetingFormDialog from "@/components/agenda/meeting-form-dialog"
import PhoneQrDialog from "@/components/agenda/phone-qr-dialog"
import type { MeetingDTO, SettingsDTO } from "@/lib/types"

type View = "agenda" | "ruta" | "ajustes"

const NAV: { key: View; label: string; icon: typeof CalendarDays }[] = [
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "ruta", label: "Ruta del día", icon: Map },
  { key: "ajustes", label: "Ajustes", icon: Settings },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label="Cambiar tema claro/oscuro"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  )
}

const POLL_MS = 20000

function formatClock(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(d)
  } catch {
    return ""
  }
}

export default function AgendaApp({
  initialMeetings,
  initialSettings,
}: {
  initialMeetings: MeetingDTO[]
  initialSettings: SettingsDTO
}) {
  const [view, setView] = useState<View>("agenda")
  const [meetings, setMeetings] = useState<MeetingDTO[]>(initialMeetings)
  const [settings, setSettings] = useState<SettingsDTO>(initialSettings)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MeetingDTO | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)
  const [qrOpen, setQrOpen] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const fingerprint = useRef(JSON.stringify([initialMeetings, initialSettings]))

  // Sincronización multi-dispositivo: consulta el estado del servidor al volver
  // a la app (focus/visibility) y cada 20 s mientras está visible, así lo cargado
  // desde la PC aparece solo en el teléfono (y viceversa).
  const refreshFromServer = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/data", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        ok: boolean
        meetings: MeetingDTO[]
        settings: SettingsDTO
      }
      if (!data.ok) throw new Error("bad payload")
      const fp = JSON.stringify([data.meetings, data.settings])
      if (fp !== fingerprint.current) {
        fingerprint.current = fp
        setMeetings(data.meetings)
        setSettings(data.settings)
      }
      setLastSyncedAt(new Date())
      setSyncError(false)
    } catch {
      setSyncError(true)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refreshFromServer()
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("focus", tick)
    window.addEventListener("pageshow", tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("focus", tick)
      window.removeEventListener("pageshow", tick)
    }
  }, [refreshFromServer])

  const handleSaved = useCallback((m: MeetingDTO) => {
    setMeetings((prev) => {
      const next = (() => {
        const idx = prev.findIndex((x) => x.id === m.id)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = m
          return copy
        }
        return [...prev, m]
      })()
      fingerprint.current = JSON.stringify([next, settings])
      return next
    })
    setLastSyncedAt(new Date())
  }, [settings])

  const handleDeleted = useCallback(
    (id: string) => {
      setMeetings((prev) => {
        const next = prev.filter((x) => x.id !== id)
        fingerprint.current = JSON.stringify([next, settings])
        return next
      })
      setLastSyncedAt(new Date())
    },
    [settings]
  )

  // Marca/desmarca una visita como realizada (queda guardado en la nube y
  // se sincroniza con los otros dispositivos vía polling)
  const handleToggleDone = useCallback(
    async (id: string, done: boolean) => {
      const res = await setMeetingDone(id, done)
      if (res.ok && res.meeting) {
        const updated = res.meeting
        setMeetings((prev) => {
          const next = prev.map((x) => (x.id === id ? updated : x))
          fingerprint.current = JSON.stringify([next, settings])
          return next
        })
        setLastSyncedAt(new Date())
        toast.success(done ? "Visita marcada como realizada." : "Visita marcada como pendiente.")
      } else {
        toast.error(res.error ?? "No se pudo actualizar la visita.")
      }
    },
    [settings]
  )

  const openEdit = useCallback((m: MeetingDTO) => {
    setEditing(m)
    setDefaultDate(undefined)
    setFormOpen(true)
  }, [])

  const openNew = useCallback((date?: string) => {
    setEditing(null)
    setDefaultDate(date)
    setFormOpen(true)
  }, [])

  const seeRoute = useCallback((date: string) => {
    setSelectedDate(date)
    setView("ruta")
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/60 to-background dark:from-emerald-950/20">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <RouteIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">RutaVisitas</h1>
            <p
              className={`flex items-center gap-1 truncate text-xs ${
                syncError ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
              aria-live="polite"
            >
              {syncError ? (
                <CloudOff className="size-3 shrink-0" />
              ) : (
                <span
                  className={`size-1.5 shrink-0 rounded-full bg-emerald-500 ${syncing ? "animate-pulse" : ""}`}
                  aria-hidden
                />
              )}
              {syncError
                ? "Sin conexión · reintentando…"
                : `Guardado en la nube${lastSyncedAt ? ` · actualizado ${formatClock(lastSyncedAt)}` : ""}`}
            </p>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Abrir en el teléfono (código QR)"
                  onClick={() => setQrOpen(true)}
                >
                  <Smartphone className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Usar desde el teléfono</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ThemeToggle />
          <Button
            variant={view === "ajustes" ? "default" : "ghost"}
            size="icon"
            className="size-9"
            aria-label="Ajustes"
            onClick={() => setView("ajustes")}
          >
            <Settings className="size-4" />
          </Button>
        </div>
        {/* Tabs de escritorio */}
        <nav className="mx-auto hidden w-full max-w-3xl px-4 pb-2 md:block" aria-label="Secciones">
          <div className="flex w-fit gap-1 rounded-full bg-muted p-1">
            {NAV.map((n) => (
              <Button
                key={n.key}
                size="sm"
                variant={view === n.key ? "default" : "ghost"}
                className="h-8 gap-1.5 rounded-full"
                onClick={() => setView(n.key)}
              >
                <n.icon className="size-4" /> {n.label}
              </Button>
            ))}
          </div>
        </nav>
      </header>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 md:pb-10">
        {view === "agenda" && (
          <AgendaView
            meetings={meetings}
            onEdit={openEdit}
            onNew={() => openNew()}
            onSeeRoute={seeRoute}
            onToggleDone={handleToggleDone}
          />
        )}
        {view === "ruta" && (
          <RouteView
            meetings={meetings}
            settings={settings}
            selectedDate={selectedDate}
            onOpenSettings={() => setView("ajustes")}
            onToggleDone={handleToggleDone}
          />
        )}
        {view === "ajustes" && (
          <SettingsView
            settings={settings}
            meetings={meetings}
            onSettingsChange={setSettings}
            onMeetingsChange={setMeetings}
            onMeetingsCleared={() => {
              setMeetings([])
              setView("agenda")
            }}
            onGoToAgenda={() => setView("agenda")}
          />
        )}
      </main>

      {/* Pie discreto (sticky) */}
      <footer className="mt-auto hidden pb-4 text-center text-xs text-muted-foreground md:block">
        RutaVisitas · tus visitas ordenadas, tu ruta optimizada
      </footer>

      {/* Navegación inferior móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
        aria-label="Secciones"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              aria-current={view === n.key ? "page" : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                view === n.key ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              <n.icon className="size-5" />
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Botón flotante nueva reunión (móvil) */}
      {view === "agenda" && (
        <Button
          onClick={() => openNew()}
          size="lg"
          className="fixed bottom-20 right-4 z-30 gap-1.5 rounded-full shadow-lg md:hidden"
          aria-label="Nueva reunión"
        >
          + Reunión
        </Button>
      )}

      <MeetingFormDialog
        open={formOpen}
        editing={editing}
        defaultDate={defaultDate}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />

      <PhoneQrDialog open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  )
}
