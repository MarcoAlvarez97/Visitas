"use client"

// Mapa de ruta con Leaflet (cargado solo en cliente) + marcadores numerados

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { escHtml } from "@/lib/format"

export type MapPoint = {
  lat: number
  lng: number
  label: string
  sub?: string
  kind: "start" | "stop"
  order?: number
}

function pinHtml(p: MapPoint): string {
  if (p.kind === "start") {
    return `<div class="rv-pin rv-pin-start"><span>★</span></div>`
  }
  return `<div class="rv-pin"><span>${p.order ?? ""}</span></div>`
}

export default function RouteMap({
  points,
  polyline,
}: {
  points: MapPoint[]
  polyline: [number, number][] | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      const L = (await import("leaflet")).default
      if (cancelled || !containerRef.current || points.length === 0) return

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
        })
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current)
      }
      const map = mapRef.current
      if (!map) return

      // Limpiar capas anteriores
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer)
      })

      // Marcadores
      for (const p of points) {
        const icon = L.divIcon({
          className: "",
          html: pinHtml(p),
          iconSize: [28, 28],
          iconAnchor: [14, 26],
        })
        L.marker([p.lat, p.lng], { icon, title: p.label })
          .addTo(map)
          .bindPopup(`<b>${escHtml(p.label)}</b><br/><span style="font-size:12px">${escHtml(p.sub ?? "")}</span>`)
      }

      // Línea de ruta
      if (polyline && polyline.length > 1) {
        L.polyline(polyline, {
          color: "#059669",
          weight: 3,
          opacity: 0.85,
          dashArray: "7 7",
        }).addTo(map)
      }

      // Ajustar vista
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      if (points.length === 1) {
        map.setView(bounds.getCenter(), 15)
      } else {
        map.fitBounds(bounds.pad(0.22))
      }
      setTimeout(() => map.invalidateSize(), 80)
    }

    render()
    return () => {
      cancelled = true
    }
  }, [points, polyline])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-[300px] w-full overflow-hidden rounded-lg border sm:h-[360px]"
      style={{ isolation: "isolate" }}
    />
  )
}
