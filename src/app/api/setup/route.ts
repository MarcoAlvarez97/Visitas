import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Setup con un clic: crea las tablas en la base de datos (si no existen) y
// deja la fila de configuración lista. Pensado para el primer deploy en
// Vercel + Turso, así no hace falta correr comandos en la computadora.
//
// Uso: abrir https://TU-APP.vercel.app/api/setup una sola vez después del deploy.
// Es idempotente: se puede llamar las veces que haga falta sin romper nada.

export const dynamic = "force-dynamic";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "mapsUrl" TEXT,
    "notes" TEXT,
    "lat" REAL,
    "lng" REAL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Meeting_date_idx" ON "Meeting"("date")`,
  `CREATE TABLE IF NOT EXISTS "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetsUrl" TEXT,
    "startAddress" TEXT,
    "startLat" REAL,
    "startLng" REAL,
    "lastSyncAt" DATETIME,
    "lastSyncMsg" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "GeocodeCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GeocodeCache_address_key" ON "GeocodeCache"("address")`,
  `INSERT OR IGNORE INTO "Settings" ("id") VALUES ('default')`,
];

async function setupHandler() {
  try {
    for (const sql of STATEMENTS) {
      await db.$executeRawUnsafe(sql);
    }
    const [meetings, settings] = await Promise.all([
      db.meeting.count(),
      db.settings.count(),
    ]);
    return NextResponse.json({
      ok: true,
      message: "Base de datos lista. Ya podés usar RutaVisitas.",
      meetings,
      settings,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { ok: false, error: `No se pudo preparar la base de datos: ${msg}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return setupHandler();
}

export async function POST() {
  return setupHandler();
}
