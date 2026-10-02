// Pantalla que se muestra cuando la base de datos no está configurada en el
// deploy (por ejemplo, faltan las variables de entorno en Vercel). Explica los
// pasos exactos para conectar Turso y volver a desplegar, en lugar de mostrar
// un error técnico.

export default function SetupRequired({
  missingEnv,
  detail,
}: {
  missingEnv: boolean
  detail?: string
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/60 to-background px-4 py-10 dark:from-emerald-950/20">
      <main className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Falta conectar la base de datos</h1>
            <p className="text-sm text-muted-foreground">
              {missingEnv
                ? "Tu app está publicada, pero no le cargaste las variables de entorno en Vercel."
                : "La app está publicada, pero no pudimos conectar con la base de datos."}
            </p>
          </div>
        </div>

        {missingEnv ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Creá tu base gratis en{" "}
              <a className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400" href="https://app.turso.net" target="_blank" rel="noreferrer">
                app.turso.net
              </a>{" "}
              y copiá la <b>URL</b> (libsql://…) y el <b>token</b>.
            </li>
            <li>
              En Vercel abrí tu proyecto → <b>Settings → Environment Variables</b> y agregá:
              <div className="mt-1 rounded-md bg-muted p-2 font-mono text-xs leading-relaxed">
                DATABASE_URL = libsql://tu-base.turso.io
                <br />
                DATABASE_AUTH_TOKEN = tu-token
              </div>
            </li>
            <li>
              <b>Importante:</b> después de guardar, andá a <b>Deployments → ⋯ → Redeploy</b>.
              Las variables solo se aplican a despliegues nuevos.
            </li>
            <li>
              Cuando termine, abrí <span className="font-mono text-xs">/api/setup</span> una vez para
              crear las tablas, y listo.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Revisá que <span className="font-mono text-xs">DATABASE_URL</span> y{" "}
              <span className="font-mono text-xs">DATABASE_AUTH_TOKEN</span> estén bien copiadas en{" "}
              <b>Settings → Environment Variables</b> (sin comillas ni espacios).
            </li>
            <li>
              Verificá que la base exista en{" "}
              <a className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400" href="https://app.turso.net" target="_blank" rel="noreferrer">
                app.turso.net
              </a>{" "}
              y generá un token nuevo si hace falta.
            </li>
            <li>Hacé <b>Deployments → ⋯ → Redeploy</b> para aplicar los cambios.</li>
            <li>
              Si recién conectaste la base, abrí{" "}
              <a className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400" href="/api/setup">
                /api/setup
              </a>{" "}
              una vez para crear las tablas.
            </li>
          </ol>
        )}

        {detail ? (
          <p className="mt-4 break-words rounded-md bg-muted p-2 font-mono text-[11px] text-muted-foreground">
            {detail}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Guía completa en el <b>README.md</b> del proyecto.
        </p>
      </main>
    </div>
  )
}
