"use client"

// Formulario para crear/editar una reunión con cliente

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createMeeting, updateMeeting, deleteMeeting } from "@/lib/actions"
import { todayStr } from "@/lib/format"
import type { MeetingDTO } from "@/lib/types"

export type MeetingFormValues = {
  date: string
  time: string
  company: string
  address: string
  contact: string
  phone: string
  mapsUrl: string
  notes: string
}

const EMPTY: MeetingFormValues = {
  date: todayStr(),
  time: "09:00",
  company: "",
  address: "",
  contact: "",
  phone: "",
  mapsUrl: "",
  notes: "",
}

export default function MeetingFormDialog({
  open,
  editing,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  editing: MeetingDTO | null
  defaultDate?: string
  onClose: () => void
  onSaved: (m: MeetingDTO) => void
  onDeleted: (id: string) => void
}) {
  const [values, setValues] = useState<MeetingFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset del formulario cada vez que se abre (patrón: ajustar estado durante render)
  const openKey = open ? `${editing?.id ?? "new"}|${defaultDate ?? ""}` : null
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null)
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    if (open) {
      setValues(
        editing
          ? {
              date: editing.date,
              time: editing.time,
              company: editing.company,
              address: editing.address,
              contact: editing.contact ?? "",
              phone: editing.phone ?? "",
              mapsUrl: editing.mapsUrl ?? "",
              notes: editing.notes ?? "",
            }
          : { ...EMPTY, date: defaultDate ?? todayStr() }
      )
    }
  }

  const set = (key: keyof MeetingFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  async function handleSave() {
    if (!values.company.trim()) return toast.error("Ingresá el nombre de la empresa.")
    if (!values.address.trim()) return toast.error("Ingresá la dirección.")
    if (!values.date) return toast.error("Elegí la fecha de la reunión.")
    setSaving(true)
    const payload = {
      date: values.date,
      time: values.time || "09:00",
      company: values.company,
      address: values.address,
      contact: values.contact || null,
      phone: values.phone || null,
      mapsUrl: values.mapsUrl || null,
      notes: values.notes || null,
    }
    const res = editing ? await updateMeeting(editing.id, payload) : await createMeeting(payload)
    setSaving(false)
    if (!res.ok || !res.meeting) {
      toast.error(res.error ?? "No se pudo guardar la reunión.")
      return
    }
    onSaved(res.meeting)
    toast.success(editing ? "Reunión actualizada." : "Reunión agregada a la agenda.")
    onClose()
  }

  async function handleDelete() {
    if (!editing) return
    setSaving(true)
    await deleteMeeting(editing.id)
    setSaving(false)
    setConfirmDelete(false)
    toast.success("Reunión eliminada.")
    onClose()
    onDeleted(editing.id)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar reunión" : "Nueva reunión"}</DialogTitle>
            <DialogDescription>
              Completá los datos de la visita. La dirección y el link de Maps ayudan a calcular la mejor ruta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="mf-date">Fecha *</Label>
                <Input id="mf-date" type="date" value={values.date} onChange={set("date")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mf-time">Hora *</Label>
                <Input id="mf-time" type="time" value={values.time} onChange={set("time")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mf-company">Empresa *</Label>
              <Input id="mf-company" placeholder="Ej: Distribuidora El Sol S.A." value={values.company} onChange={set("company")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mf-address">Dirección *</Label>
              <Input
                id="mf-address"
                placeholder="Ej: Av. Córdoba 1234, CABA"
                value={values.address}
                onChange={set("address")}
              />
              <p className="text-xs text-muted-foreground">Calle, número y ciudad ayudan a ubicar mejor la visita en el mapa.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="mf-contact">Persona de contacto</Label>
                <Input id="mf-contact" placeholder="Ej: Juan Pérez" value={values.contact} onChange={set("contact")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mf-phone">Teléfono</Label>
                <Input id="mf-phone" type="tel" placeholder="Ej: 11 5555 6677" value={values.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mf-maps">Link de Google Maps (opcional)</Label>
              <Input
                id="mf-maps"
                type="url"
                placeholder="https://maps.google.com/..."
                value={values.mapsUrl}
                onChange={set("mapsUrl")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mf-notes">Notas</Label>
              <Textarea
                id="mf-notes"
                placeholder="Ej: traer catálogo y factura, pedir por Juan…"
                value={values.notes}
                onChange={set("notes")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {editing && (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                <Trash2 className="size-4" /> Eliminar
              </Button>
            )}
            <div className="flex flex-1 justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta reunión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a borrar la visita a &quot;{editing?.company}&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
