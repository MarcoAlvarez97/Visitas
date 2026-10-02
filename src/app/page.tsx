import AgendaApp from "@/components/agenda/agenda-app";
import SetupRequired from "@/components/agenda/setup-required";
import { db } from "@/lib/db";
import { toMeetingDTO, toSettingsDTO, getSettingsRow, MEETING_ORDER } from "@/lib/server-data";
import type { MeetingDTO, SettingsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Sin base de datos configurada o con error de conexión: mostramos una
  // pantalla con los pasos para arreglarlo en vez de un error técnico.
  let initial: { meetings: MeetingDTO[]; settings: SettingsDTO } | null = null;
  let errorDetail: string | undefined;

  try {
    const [meetings, settings] = await Promise.all([
      db.meeting.findMany({ orderBy: MEETING_ORDER }),
      getSettingsRow(),
    ]);
    initial = {
      meetings: meetings.map(toMeetingDTO),
      settings: toSettingsDTO(settings),
    };
  } catch (error) {
    errorDetail = error instanceof Error ? error.message.slice(0, 200) : undefined;
  }

  if (!initial) {
    return (
      <SetupRequired
        missingEnv={!process.env.DATABASE_URL}
        detail={errorDetail}
      />
    );
  }

  return (
    <AgendaApp
      initialMeetings={initial.meetings}
      initialSettings={initial.settings}
    />
  );
}
