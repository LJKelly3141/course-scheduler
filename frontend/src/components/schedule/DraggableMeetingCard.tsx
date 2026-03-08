import { useDraggable } from "@dnd-kit/core";
import type { Meeting } from "../../api/types";
import { cn, getLevelHexColor, timeToMinutes, formatTime, parseDaysOfWeek, entityBgAlpha } from "../../lib/utils";
import { useTheme } from "../../hooks/useTheme";

// Legacy fallback for old enum values
const SESSION_SHORT: Record<string, string> = {
  session_a: "Sess A",
  session_b: "Sess B",
  session_c: "Sess C",
  session_d: "Sess D",
};

interface Props {
  meeting: Meeting;
  day: string;
  bgColor?: string;
  activeDragMeetingId: number | null;
  onDetail: (meeting: Meeting) => void;
  onEdit?: (meeting: Meeting) => void;
  style: React.CSSProperties;
}

export function DraggableMeetingCard({
  meeting,
  day,
  bgColor,
  activeDragMeetingId,
  onDetail,
  onEdit,
  style,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDraggable = meeting.time_block_id != null;
  const isBeingDragged = activeDragMeetingId === meeting.id;

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `meeting-${meeting.id}-${day}`,
    data: { meeting, day },
    disabled: !isDraggable,
  });

  const courseNum = meeting.section?.course?.course_number ?? "";
  const durationMin = timeToMinutes(meeting.end_time) - timeToMinutes(meeting.start_time);
  const isCompact = durationMin <= 50;

  const accentColor = bgColor || getLevelHexColor(courseNum);

  const days = parseDaysOfWeek(meeting.days_of_week).join("");
  const timeRange = `${formatTime(meeting.start_time)}\u2013${formatTime(meeting.end_time)}`;
  const sessionLabel = meeting.section?.term_session?.name
    ?? (meeting.section?.session ? SESSION_SHORT[meeting.section.session] : undefined);

  const baseStyle: React.CSSProperties = {
    ...style,
    backgroundColor: `${accentColor}${entityBgAlpha(resolvedTheme === "dark")}`,
    borderLeft: `3px solid ${accentColor}`,
    pointerEvents: "auto",
  };

  const dragStyle = transform
    ? { ...baseStyle, transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : baseStyle;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={dragStyle}
      onClick={(e) => {
        e.stopPropagation();
        onDetail(meeting);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit?.(meeting);
      }}
      className={cn(
        "absolute rounded-md px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isBeingDragged && "opacity-40"
      )}
    >
      <div className="font-semibold truncate text-slate-800 dark:text-slate-200">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      <div className="truncate text-slate-500 dark:text-slate-400">{days} {timeRange}</div>
      {!isCompact && (
        <>
          <div className="truncate text-slate-500 dark:text-slate-400">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
          <div className="truncate text-slate-400 dark:text-slate-500">
            {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
          </div>
          {sessionLabel && (
            <div className="truncate text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{sessionLabel}</div>
          )}
        </>
      )}
    </div>
  );
}
