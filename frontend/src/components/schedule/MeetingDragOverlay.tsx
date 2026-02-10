import type { Meeting } from "../../api/types";
import { cn, getLevelColor } from "../../lib/utils";

interface Props {
  meeting: Meeting;
}

export function MeetingDragOverlay({ meeting }: Props) {
  const courseNum = meeting.section?.course?.course_number ?? "";

  return (
    <div
      className={cn(
        "rounded px-1.5 py-1 text-white text-[11px] leading-tight w-[130px]",
        "shadow-lg scale-105 opacity-90",
        getLevelColor(courseNum)
      )}
    >
      <div className="font-semibold">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      <div className="opacity-90">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
      <div className="opacity-80">
        {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
      </div>
    </div>
  );
}
