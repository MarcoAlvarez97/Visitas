"use client"

// Mapa de ruta con Leaflet (cargado solo en cliente)
// Mejoras:
// - Tiles CARTO Voyager (aspecto idéntico a Google Maps, gratis y sin API key)
// - Trazado REAL por las calles vía OSRM (ruteo vehicular público, sin key)
//   con fallback automático a la línea recta punteada si falla la red
// - Pines estilo Google Maps (gota roja numerada / gota azul de inicio)

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

// Pines tipo Google Maps (gota) con estilos inline: no depende de globals.css
function pinHtml(p: MapPoint): string {
  const isStart = p.kind === "start"
  const bg = isStart ? "#1A73E8" : "#EA4335"
  const text = isStart ? "★" : `${p.order ?? ""}`
  const fontSize = isStart ? 15 : 13
  return (
    `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
    `background:${bg};border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.4);` +
    `display:flex;align-items:center;justify-content:center;">` +
    `<span style="transform:rotate(45deg);color:#ffffff;font-weight:700;font-size:${fontSize}px;` +
    `line-height:1;font-family:Roboto,Arial,sans-serif;display:block;text-align:center;">${text}</span></div>`
  )
}

// Pide a OSRM la geometría real de la ruta siguiendo calles.
// Devuelve [lat,lng][] o null si algo falla (offline, timeout, sin ruta).
async function fetchRoadGeometry(
  coords: [number, number][],
): Promise<[number, number][] | null> {
  try {
    if (coords.length < 2) return null
    const pts = coords.map(([lat, lng]) => `${lng},${lat}`).join(";")
    const url = `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as {
      code?: string
      routes?: { geometry?: { coordinates?: [number, number][] } }[]
    }
    if (data?.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) return null
    const raw = data.routes[0].geometry.coordinates
    if (raw.length < 2) return null
    return raw.map(([lng, lat]) => [lat, lng] as [number, number])
  } catch {
    return null
  }
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
  // Caché de geometrías ya calculadas (evita re-consultar OSRM)
  const geoCacheRef = useRef<Map<string, [number, number][]>>(new Map())

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
        // Tiles estilo Google Maps (CARTO Voyager, con soporte retina)
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          subdomains: "abcd",
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(mapRef.current)
      }
      const map = mapRef.current
      if (!map) return

      // Limpiar capas anteriores
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer)
      })

      // Marcadores estilo Google Maps
      for (const p of points) {
        const icon = L.divIcon({
          className: "",
          html: pinHtml(p),
          iconSize: [30, 30],
          iconAnchor: [15, 36],
        })
        L.marker([p.lat, p.lng], { icon, title: p.label })
          .addTo(map)
          .bindPopup(
            `<b style="font-family:Roboto,Arial,sans-serif;font-size:14px">${escHtml(p.label)}</b>` +
              `<br/><span style="font-size:12px">${escHtml(p.sub ?? "")}</span>`,
          )
      }

      // Ajustar vista de inmediato (no espera el ruteo)
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      if (points.length === 1) {
        map.setView(bounds.getCenter(), 15)
      } else {
        map.fitBounds(bounds.pad(0.22))
      }
      setTimeout(() => map.invalidateSize(), 80)

      if (points.length < 2) return

      // 1) Placeholder instantáneo: línea recta punteada (la de siempre)
      let placeholder: import("leaflet").Polyline | null = null
      if (polyline && polyline.length > 1) {
        placeholder = L.polyline(polyline, {
          color: "#5f6368",
          weight: 3,
          opacity: 0.6,
          dashArray: "6 8",
        }).addTo(map)
      }

      // 2) Trazado real por calles (OSRM), con caché y fallback
      const key = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";")
      let geo = geoCacheRef.current.get(key) ?? null
      if (!geo) {
        geo = await fetchRoadGeometry(points.map((p) => [p.lat, p.lng] as [number, number]))
        if (cancelled) return
        if (geo) geoCacheRef.current.set(key, geo)
      }
      if (cancelled || !mapRef.current) return

      if (geo) {
        if (placeholder) map.removeLayer(placeholder)
        // Borde blanco (casing) + línea azul Google Maps encima
        L.polyline(geo, {
          color: "#ffffff",
          weight: 9,
          opacity: 0.75,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map)
        L.polyline(geo, {
          color: "#1A73E8",
          weight: 5,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map)
      }
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
