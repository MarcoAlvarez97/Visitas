"use client"

// Diálogo con código QR: escaneando desde el teléfono se abre la misma app
// (misma URL, mismos datos guardados en la nube del servidor).

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Loader2, Smartphone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function PhoneQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Genera el QR cada vez que se abre el diálogo (la URL puede variar).
  // Los setState van dentro de callbacks asíncronos (patrón suscripción).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const current = window.location.origin
    QRCode.toDataURL(current, {
      width: 512,
      margin: 2,
      color: { dark: "#065f46", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (cancelled) return
        setUrl(current)
        setError(null)
        setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (cancelled) return
        setUrl(current)
        setQrDataUrl(null)
        setError("No se pudo generar el código QR.")
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-5 text-emerald-700 dark:text-emerald-400" /> Abrir en el teléfono
          </DialogTitle>
          <DialogDescription>
            Escaneá este código con la cámara del teléfono para abrir la app en tu celular y ver
            exactamente los mismos datos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="flex size-56 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Código QR para abrir RutaVisitas en el teléfono" className="size-full" />
            ) : error ? (
              <p className="px-4 text-center text-sm text-destructive">{error}</p>
            ) : (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            )}
          </div>
          {url && (
            <p className="max-w-full truncate rounded-md bg-muted px-3 py-1.5 font-mono text-xs" title={url}>
              {url}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Todo lo que cargues queda guardado en la nube de la app: cargá desde la PC y tocá desde el
            teléfono, siempre con el mismo enlace. También podés usar la opción{" "}
            <strong>&quot;Agregar a pantalla de inicio&quot;</strong> del navegador del celular para que quede
            como una app.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
