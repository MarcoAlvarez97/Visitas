import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Base de datos dual:
// - Desarrollo local: DATABASE_URL="file:./db/custom.db" (archivo SQLite)
// - Producción (Vercel + Turso): DATABASE_URL="libsql://xxx.turso.io" + DATABASE_AUTH_TOKEN="xxx"
// Ambos usan el mismo motor libSQL/SQLite a través del adaptador oficial de Prisma.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Algunos paneles copian la URL con parámetros extra (ej. channel_binding)
// que @libsql/client no soporta. Los limpiamos para que la conexión siempre
// funcione con la misma variable de entorno.
function sanitizeUrl(raw: string): string {
  if (!raw.startsWith('libsql://') && !raw.startsWith('wss://') && !raw.startsWith('https://')) {
    return raw // file: u otras URLs locales se dejan igual
  }
  try {
    const u = new URL(raw)
    for (const p of [...u.searchParams.keys()]) {
      if (p !== 'authToken' && p !== 'tls') u.searchParams.delete(p)
    }
    return u.toString()
  } catch {
    return raw
  }
}

function createDb(): PrismaClient {
  const url = sanitizeUrl(process.env.DATABASE_URL ?? 'file:./db/custom.db')
  const authToken = process.env.DATABASE_AUTH_TOKEN // solo necesario para Turso

  // En Prisma 6.19 el adaptador recibe la configuración de @libsql/client
  // y crea el cliente internamente.
  const adapter = new PrismaLibSQL({ url, authToken })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
