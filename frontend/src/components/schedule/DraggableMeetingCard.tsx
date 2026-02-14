import { useDraggable } from "@dnd-kit/core";
import type { Meeting } from "../../api/types";
import { cn, parseDaysOfWeek, formatTime, getLevelColor, timeToMinutes } from "../../lib/utils";

interface Props {
  meeting: Meeting;
  day: string;
  hasConflict: boolean;
  activeDragMeetingId: number | null;
  popoverOpen: boolean;
  onTogglePopover: () => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: number) => void;
  style: React.CSSProperties;
}

export function DraggableMeetingCard({
  meeting,
  day,
  hasConflict,
  activeDragMeetingId,
  popoverOpen,
  onTogglePopover,
  onEdit,
  onDelete,
  style,
}: Props) {
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

  const dragStyle = transform
    ? { ...style, transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : style;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ ...dragStyle, pointerEvents: "auto" }}
      onClick={onTogglePopover}
      className={cn(
        "absolute rounded px-1.5 py-0.5 text-white text-[11px] leading-tight overflow-hidden",
        getLevelColor(courseNum),
        hasConflict && "ring-2 ring-red-500",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isBeingDragged && "opacity-40"
      )}
    >
      <div className="font-semibold truncate">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      {isCompact ? (
        <div className="opacity-90 truncate">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
      ) : (
        <>
          <div className="opacity-90 truncate">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
          <div className="opacity-80 truncate">
            {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
          </div>
        </>
      )}

      {popoverOpen && (
        <div
          className="absolute z-[100] bg-white text-foreground border border-border rounded-lg shadow-lg p-3 w-56 left-0 top-full mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold text-sm mb-1">
            {meeting.section?.course?.department_code} {meeting.section?.course?.course_number}-{meeting.section?.section_number}
          </p>
          <p className="text-muted-foreground">{meeting.section?.course?.title}</p>
          <p className="mt-1">Instructor: {meeting.instructor?.name ?? "TBD"}</p>
          <p>Room: {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}</p>
          <p>Time: {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</p>
          <p>Days: {parseDaysOfWeek(meeting.days_of_week).join(", ")}</p>
          {!isDraggable && <p className="text-muted-foreground text-[10px] mt-1">Custom time — use Edit to reschedule</p>}
          {hasConflict && <p className="text-destructive font-medium mt-1">Has conflicts!</p>}
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <button onClick={() => onEdit(meeting)} className="text-primary text-xs hover:underline">Edit</button>
            <button onClick={() => onDelete(meeting.id)} className="text-destructive text-xs hover:underline">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
