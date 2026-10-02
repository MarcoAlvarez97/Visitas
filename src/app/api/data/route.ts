// GET /api/data — estado completo (reuniones + ajustes) para sincronizar
// dispositivos: la app lo consulta al enfocar la ventana y periódicamente,
// de modo que lo cargado desde la PC aparezca solo en el teléfono.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toMeetingDTO, toSettingsDTO, getSettingsRow, MEETING_ORDER } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [meetings, settings] = await Promise.all([
      db.meeting.findMany({ orderBy: MEETING_ORDER }),
      getSettingsRow(),
    ]);
    return NextResponse.json({
      ok: true,
      meetings: meetings.map(toMeetingDTO),
      settings: toSettingsDTO(settings),
    });
  } catch (err) {
    console.error("GET /api/data error:", err);
    return NextResponse.json({ ok: false, error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
