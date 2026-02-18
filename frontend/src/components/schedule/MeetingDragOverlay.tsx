import type { Meeting } from "../../api/types";
import { getLevelHexColor } from "../../lib/utils";

interface Props {
  meeting: Meeting;
  bgColor?: string;
}

export function MeetingDragOverlay({ meeting, bgColor }: Props) {
  const courseNum = meeting.section?.course?.course_number ?? "";
  const accentColor = bgColor || getLevelHexColor(courseNum);

  return (
    <div
      style={{
        backgroundColor: `${accentColor}18`,
        borderLeft: `3px solid ${accentColor}`,
      }}
      className="rounded-md px-1.5 py-1 text-[11px] leading-tight w-[130px] shadow-lg scale-105 opacity-95"
    >
      <div className="font-semibold text-slate-800">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      <div className="text-slate-500">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
      <div className="text-slate-400">
        {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
      </div>
    </div>
  );
}
