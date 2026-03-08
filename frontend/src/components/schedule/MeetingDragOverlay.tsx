import type { Meeting } from "../../api/types";
import { getLevelHexColor, formatTime, parseDaysOfWeek } from "../../lib/utils";

const SESSION_SHORT: Record<string, string> = {
  session_a: "Sess A",
  session_b: "Sess B",
  session_c: "Sess C",
  session_d: "Sess D",
};

interface Props {
  meeting: Meeting;
  bgColor?: string;
}

export function MeetingDragOverlay({ meeting, bgColor }: Props) {
  const courseNum = meeting.section?.course?.course_number ?? "";
  const accentColor = bgColor || getLevelHexColor(courseNum);

  const days = parseDaysOfWeek(meeting.days_of_week).join("");
  const timeRange = `${formatTime(meeting.start_time)}\u2013${formatTime(meeting.end_time)}`;
  const sessionLabel = meeting.section?.term_session?.name
    ?? (meeting.section?.session ? SESSION_SHORT[meeting.section.session] : undefined);

  return (
    <div
      style={{
        backgroundColor: `${accentColor}18`,
        borderLeft: `3px solid ${accentColor}`,
      }}
      className="rounded-md px-1.5 py-1 text-[11px] leading-tight w-[130px] shadow-lg scale-105 opacity-95"
    >
      <div className="font-semibold text-slate-800 dark:text-slate-200">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      <div className="text-slate-500 dark:text-slate-400">{days} {timeRange}</div>
      <div className="text-slate-500 dark:text-slate-400">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
      <div className="text-slate-400 dark:text-slate-500">
        {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
      </div>
      {sessionLabel && (
        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{sessionLabel}</div>
      )}
    </div>
  );
}
