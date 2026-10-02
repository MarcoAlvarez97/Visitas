# 🚗 RutaVisitas — Guía de despliegue en Vercel

App para organizar reuniones con clientes y calcular la mejor ruta de visitas del día.
Guarda todo en la nube: cargás desde la **PC** y lo ves al instante en el **teléfono**.

---

## ✅ Antes de empezar: lo que necesitás

| Cuenta | Para qué | Costo |
|--------|----------|-------|
| [GitHub](https://github.com) | Guardar el código | Gratis |
| [Vercel](https://vercel.com) | Publicar la app | Gratis |
| [Turso](https://app.turso.net) | Base de datos en la nube | Gratis (sobra para uso normal) |

Las tres se crean con el mismo usuario de GitHub, en 2 minutos.

> **¿Por qué hace falta Turso?** Vercel no guarda archivos: cada visita a la app puede
> ejecutarse en un servidor distinto. El archivo SQLite sirve para tu PC, pero en la
> nube necesitamos una base dedicada. Turso es exactamente el mismo motor (SQLite/libSQL),
> así que **el código no cambia**: solo se configurán 2 variables de entorno.

---

## Paso 1 — Subir el código a GitHub

1. Descargá `rutavisitas-vercel.zip` y **descomprimilo**.
2. Entrá a [github.com/new](https://github.com/new):
   - **Repository name**: `rutavisitas`
   - Dejalo **Public** o **Private** (Vercel funciona con ambos)
   - Click en **Create repository**
3. En la pantalla que aparece, click en **"uploading an existing file"**.
4. Arrastrá **todo el contenido** de la carpeta descomprimida (los archivos y carpetas
   de adentro, no la carpeta contenedora).
5. Click en **Commit changes** y esperá que termine la subida.

> 💡 El zip ya viene limpio: no incluye `node_modules`, bases de datos ni archivos temporales.

---

## Paso 2 — Crear la base de datos en Turso

1. Entrá a [app.turso.net](https://app.turso.net) → **Sign in with GitHub**.
2. Click en **Create Database**:
   - **Name**: `rutavisitas`
   - **Location**: elegí la más cercana a tu zona (por ejemplo `EWR` Washington o `GRU` San Pablo).
3. Creada la base, vas a ver la **URL** con este formato:
   ```
   libsql://rutavisitas-tuusuario.turso.io
   ```
   Copiala (botón junto a la URL).
4. En la misma pantalla (o en la pestaña **Tokens**), click en **Generate Token**
   y copiá el token (una cadena larga de letras y números).

---

## Paso 3 — Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Sign in with GitHub**.
2. Click en **Add New... → Project** → buscá el repo `rutavisitas` → **Import**.
3. **Framework Preset**: detecta *Next.js* solo. **No toques** build settings.
4. Antes de apretar Deploy, abrí la sección **Environment Variables** y cargá:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `libsql://rutavisitas-tuusuario.turso.io` |
   | `DATABASE_AUTH_TOKEN` | `el-token-que-copiaste` |

   *(Alternativa: podés pegar el token dentro de la URL —
   `libsql://...turso.io?authToken=TU_TOKEN` — y omitir la segunda variable. Las dos formas funcionan.)*

   ⚠️ Sin comillas, sin espacios antes/después del valor.

5. Click en **Deploy** y esperá 1–3 minutos.
6. Al terminar, Vercel te da la dirección de tu app:
   `https://rutavisitas-tuusuario.vercel.app`

---

## Paso 4 — Preparar las tablas (una sola vez, 10 segundos)

1. Abrí en el navegador:
   ```
   https://tu-app.vercel.app/api/setup
   ```
2. Tiene que responder algo como:
   ```json
   {"ok":true,"message":"Base de datos lista. Ya podés usar RutaVisitas.","meetings":0,"settings":1}
   ```
3. **Listo.** Abrí la app principal y empezá a cargar tus visitas.

> `/api/setup` crea las tablas si no existen y no toca nada si ya están.
> Se puede llamar las veces que quieras sin riesgo. Si preferís, después del
> primer setup podés borrar la carpeta `src/app/api/setup` y hacer push.

---

## Paso 5 — Usarlo desde el teléfono

1. Desde la **PC**, abrí tu app y tocá el botón 📱 del encabezado: aparece un **QR**.
2. Con el teléfono, escaneá el QR (cámara) y abrí el enlace.
3. En el menú del navegador del celular elegí **"Agregar a pantalla de inicio"**:
   queda instalada como una app más, con su ícono propio.
4. Todo lo que cargues desde la PC aparece solo en el teléfono (y viceversa):
   al abrir la app se sincroniza, y mientras está abierta se actualiza cada 20 segundos.

---

## 📥 Cargar tus visitas

- **A mano**: botón **+ Reunión** (fecha, hora, empresa, dirección, contacto, teléfono, link de Maps y notas).
- **Desde Excel/Sheets**: guardá tu planilla como CSV → **Ajustes → Importar CSV** (pegás el texto o subís el archivo).
  Columnas esperadas: `fecha, hora, empresa, dirección, contacto, teléfono, maps, notas`.
- **Google Sheets (opcional)**: si ya tenés una hoja, compartila como
  "Cualquier persona con el enlace → Lector" → **Ajustes → Google Sheets → pegar enlace → Sincronizar ahora**.
  No es obligatorio: con el CSV o la carga manual alcanza.

---

## 🔄 Actualizar la app más adelante

Editás cualquier archivo en GitHub (o subís una versión nueva del zip) →
Vercel **redespliega automáticamente** en ~2 minutos. No hay que tocar nada más.

---

## 🆘 Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| La app abre pero da error 500 al cargar datos | Faltan variables de entorno, o hay un espacio extra en el valor | Revisá `DATABASE_URL` y `DATABASE_AUTH_TOKEN` en Vercel → Settings → Environment Variables, y hacé **Redeploy** |
| `/api/setup` responde `{"ok":false}` | Token de Turso mal copiado o vencido | Generá un token nuevo en Turso y actualizá la variable |
| El deploy falla | Error de build | Vercel → Deployments → click en el deploy fallido → **Build Logs** te dice la línea exacta |
| No aparece la reunión que cargué desde la PC | Abriste URLs distintas (ej. un deploy de preview y el dominio principal) | Usá **siempre la misma URL** en PC y teléfono |
| La dirección no se ubica en el mapa | El geocodificador público (Nominatim) es lento la primera vez | Esperá unos segundos y recargá; el resultado queda cacheado |
| Quiero ver las tablas de la base | Panel de Turso | Tu base → **Shell / Edit table**: los datos están en las tablas `Meeting`, `Settings`, `GeocodeCache` |

---

## 🧰 Para desarrolladores (opcional)

```bash
bun install                 # o npm install
cp .env.example .env        # modo local con archivo SQLite
bun run db:push             # crea las tablas en el archivo local
bun run dev                 # http://localhost:3000
bun run lint                # chequeo de calidad
```

**Stack**: Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma (driver adapter libSQL) ·
Turso/libSQL · Leaflet + OpenStreetMap · geocodificación Nominatim · PWA instalable.

**Estructura principal**:
```
src/
  app/
    page.tsx              # app completa (ruta única)
    api/data/route.ts     # GET sincronización multi-dispositivo
    api/route.ts          # CRUD de reuniones
    api/setup/route.ts    # crea tablas (primer deploy)
  components/agenda/      # agenda, ruta, ajustes, mapa, formularios
  lib/
    actions.ts            # server actions (guardar, borrar, sincronizar)
    geo.ts                # optimizador de ruta (nearest-neighbor + 2-opt)
    geocode.ts            # geocodificación con caché
    db.ts                 # conexión Prisma ↔ libSQL (local y nube)
```
