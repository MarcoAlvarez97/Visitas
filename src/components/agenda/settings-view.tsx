"use client"

// Vista Ajustes: conexión con Google Sheets, importación CSV,
// ubicación de partida y zona de datos peligrosa.

import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  CircleAlert,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Crosshair,
  Smartphone,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteAllMeetings,
  getSettings,
  importCsvText,
  saveSheetsUrl,
  saveStartLocation,
  syncSheets,
} from "@/lib/actions"
import { formatDateTimeEs } from "@/lib/format"
import type { MeetingDTO, SettingsDTO } from "@/lib/types"
import PhoneQrDialog from "@/components/agenda/phone-qr-dialog"

export default function SettingsView({
  settings,
  meetings,
  onSettingsChange,
  onMeetingsChange,
  onMeetingsCleared,
  onGoToAgenda,
}: {
  settings: SettingsDTO
  meetings: MeetingDTO[]
  onSettingsChange: (s: SettingsDTO) => void
  onMeetingsChange: (ms: MeetingDTO[]) => void
  onMeetingsCleared: () => void
  onGoToAgenda: () => void
}) {
  const [url, setUrl] = useState(settings.sheetsUrl ?? "")
  const [syncing, setSyncing] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const [csv, setCsv] = useState("")
  const [importing, setImporting] = useState(false)
  const [startAddress, setStartAddress] = useState(settings.startAddress ?? "")
  const [savingStart, setSavingStart] = useState(false)
  const [locating, setLocating] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const csvFileRef = useRef<HTMLInputElement>(null)

  async function handleSaveUrl() {
    setSavingUrl(true)
    const s = await saveSheetsUrl(url)
    setSavingUrl(false)
    onSettingsChange(s)
    if (url.trim() && !url.trim().includes("docs.google.com/spreadsheets/")) {
      toast.warning("El enlace no parece de Google Sheets. Revisalo antes de sincronizar.")
    } else {
      toast.success("Enlace guardado.")
    }
  }

  async function handleSync() {
    setSyncing(true)
    const res = await syncSheets()
    const s = await getSettings()
    setSyncing(false)
    onSettingsChange(s)
    if (res.meetings) onMeetingsChange(res.meetings)
    if (res.ok) {
      toast.success(res.message)
      if (res.errors.length > 0) {
        toast.warning(`Algunas filas se omitieron: ${res.errors[0]}`)
      }
    } else {
      toast.error(res.message)
      res.errors.forEach((e) => toast.warning(e))
    }
  }

  async function handleImportCsv() {
    if (!csv.trim()) return toast.error("Pegá el contenido CSV o cargá un archivo.")
    setImporting(true)
    const res = await importCsvText(csv)
    setImporting(false)
    if (res.ok) {
      toast.success(res.message)
      if (res.meetings) onMeetingsChange(res.meetings)
      setCsv("")
      onGoToAgenda()
    } else {
      toast.error(res.message)
      res.errors.slice(0, 3).forEach((e) => toast.warning(e))
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ""))
    reader.readAsText(file)
    e.target.value = ""
  }

  async function handleSaveStart() {
    setSavingStart(true)
    const res = await saveStartLocation({ address: startAddress })
    setSavingStart(false)
    if (res.ok && res.settings) {
      onSettingsChange(res.settings)
      toast.success("Ubicación de partida guardada.")
    } else {
      toast.error(res.error ?? "No se pudo guardar la ubicación.")
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await saveStartLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        if (res.ok && res.settings) {
          onSettingsChange(res.settings)
          setStartAddress(res.settings.startAddress ?? "")
          toast.success("Usaremos tu ubicación actual como punto de partida.")
        } else {
          toast.error(res.error ?? "No se pudo guardar tu ubicación.")
        }
      },
      () => {
        setLocating(false)
        toast.error("No pudimos obtener tu ubicación. Revisá los permisos del navegador.")
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  async function handleWipe() {
    await deleteAllMeetings()
    onMeetingsCleared()
    setConfirmWipe(false)
    toast.success("Se eliminaron todas las reuniones.")
  }

  return (
    <div className="space-y-4">
      {/* Google Sheets (opcional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-5 text-emerald-700 dark:text-emerald-400" /> Google Sheets
            <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              Opcional
            </Badge>
          </CardTitle>
          <CardDescription>
            No es necesaria: tus datos ya se guardan en la nube de la app. Solo si además llevás una hoja de
            cálculo, conectala para importar esas reuniones con un toque.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="sheets-url">Enlace de la hoja</Label>
            <Input
              id="sheets-url"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSaveUrl} disabled={savingUrl} className="gap-1.5">
              {savingUrl ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar enlace
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sincronizar ahora
            </Button>
          </div>
          {settings.lastSyncAt && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Última sincronización: {formatDateTimeEs(settings.lastSyncAt)}
              {settings.lastSyncMsg ? ` — ${settings.lastSyncMsg}` : ""}
            </p>
          )}
          <Accordion type="single" collapsible>
            <AccordionItem value="help-sheets">
              <AccordionTrigger className="text-sm">¿Cómo conecto mi hoja?</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>En tu hoja de cálculo, tocá <strong>Compartir</strong>.</li>
                  <li>En Acceso general, elegí <strong>“Cualquier persona con el enlace”</strong> con rol <strong>Lector</strong>.</li>
                  <li>Copiá el enlace y pegalo acá arriba. Guardá y tocá <strong>Sincronizar ahora</strong>.</li>
                </ol>
                <p>
                  Detectamos automáticamente las columnas <strong>fecha, hora, empresa, dirección, contacto,
                  teléfono, link de Maps y notas</strong> (aunque tengan otros nombres parecidos). En cada
                  sincronización se reemplazan las reuniones importadas de la hoja; las que cargaste a mano no se
                  tocan.
                </p>
                <div className="rounded-md bg-muted p-2 font-mono text-xs">
                  fecha,hora,empresa,dirección,contacto,teléfono,maps,notas
                  <br />
                  05/10/2026,09:30,Distribuidora El Sol,&quot;Av. Córdoba 1234, CABA&quot;,Juan
                  Pérez,1155556677,,traer catálogo
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Importar CSV */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-5 text-emerald-700 dark:text-emerald-400" /> Importar CSV
          </CardTitle>
          <CardDescription>
            ¿No podés compartir la hoja? Pegá el contenido CSV o subí un archivo exportado de Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"fecha,hora,empresa,dirección,contacto,teléfono,maps,notas\n05/10/2026,09:30,ACME SA,\"Av. Córdoba 1234, CABA\",Juan Pérez,1155556677,,"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => csvFileRef.current?.click()} className="gap-1.5">
              <FileSpreadsheet className="size-4" /> Cargar archivo .csv
            </Button>
            <Button onClick={handleImportCsv} disabled={importing} className="gap-1.5">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Importar
            </Button>
            <input ref={csvFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
          </div>
        </CardContent>
      </Card>

      {/* Ubicación de partida */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-5 text-emerald-700 dark:text-emerald-400" /> Ubicación de partida
          </CardTitle>
          <CardDescription>
            Desde dónde salís a las visitas (tu oficina, tu casa…). La usamos para ordenar mejor las paradas del día.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.startAddress && (
            <p className="flex items-center gap-1.5 rounded-md bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
              <MapPin className="size-4 shrink-0" /> Actual: {settings.startAddress}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="start-address">Dirección de partida</Label>
            <Input
              id="start-address"
              placeholder="Ej: Av. Santa Fe 1234, CABA"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveStart} disabled={savingStart} className="gap-1.5">
              {savingStart ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
            </Button>
            <Button variant="outline" onClick={handleUseMyLocation} disabled={locating} className="gap-1.5">
              {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Usar mi ubicación actual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ver desde el teléfono (sincronización multi-dispositivo) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-5 text-emerald-700 dark:text-emerald-400" /> Usar desde el teléfono
          </CardTitle>
          <CardDescription>
            Los datos están guardados en la nube de la app, no en tu dispositivo: cargá desde la PC y
            abrí el mismo enlace desde el celular para ver lo mismo, sin configurar nada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>La app se actualiza sola al abrirla o volver a ella (y cada 20 segundos).</li>
            <li>Lo que agregues o edites desde cualquier dispositivo aparece en el otro al instante.</li>
            <li>En el celular, usá “Agregar a pantalla de inicio” para que quede como una app.</li>
          </ul>
          <Button onClick={() => setQrOpen(true)} className="gap-1.5">
            <Smartphone className="size-4" /> Ver código QR para abrir en el celular
          </Button>
        </CardContent>
      </Card>

      {/* Zona peligrosa */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <CircleAlert className="size-5" /> Datos
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <CloudUpload className="mt-0.5 size-4 shrink-0" />
            Actualmente hay {meetings.length} reunión/es guardadas en la nube de la app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmWipe(true)} className="gap-1.5">
            <Trash2 className="size-4" /> Eliminar todas las reuniones
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todas las reuniones?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran todas las reuniones (importadas y manuales). Esta acción no se puede deshacer. Tus hojas de
              Google Sheets no se modifican.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleWipe}>Eliminar todo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PhoneQrDialog open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  )
}
