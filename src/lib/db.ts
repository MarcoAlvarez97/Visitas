import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Base de datos dual:
// - Desarrollo local: DATABASE_URL="file:./db/custom.db" (archivo SQLite)
// - Producción (Vercel + Turso): DATABASE_URL="libsql://xxx.turso.io" + DATABASE_AUTH_TOKEN="xxx"
// Ambos usan el mismo motor libSQL/SQLite a través del adaptador oficial de Prisma.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./db/custom.db'
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
