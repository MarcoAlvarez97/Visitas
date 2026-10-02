import AgendaApp from "@/components/agenda/agenda-app";
import { db } from "@/lib/db";
import { toMeetingDTO, toSettingsDTO, getSettingsRow, MEETING_ORDER } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meetings, settings] = await Promise.all([
    db.meeting.findMany({ orderBy: MEETING_ORDER }),
    getSettingsRow(),
  ]);

  return (
    <AgendaApp
      initialMeetings={meetings.map(toMeetingDTO)}
      initialSettings={toSettingsDTO(settings)}
    />
  );
}
