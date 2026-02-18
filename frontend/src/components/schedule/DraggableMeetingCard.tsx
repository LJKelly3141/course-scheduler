import { useDraggable } from "@dnd-kit/core";
import type { Meeting } from "../../api/types";
import { cn, getLevelHexColor, timeToMinutes } from "../../lib/utils";

interface Props {
  meeting: Meeting;
  day: string;
  bgColor?: string;
  activeDragMeetingId: number | null;
  onDetail: (meeting: Meeting) => void;
  onEdit: (meeting: Meeting) => void;
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

  const baseStyle: React.CSSProperties = {
    ...style,
    backgroundColor: `${accentColor}14`,
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
        onEdit(meeting);
      }}
      className={cn(
        "absolute rounded-md px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isBeingDragged && "opacity-40"
      )}
    >
      <div className="font-semibold truncate text-slate-800">
        {meeting.section?.course?.department_code} {courseNum}-{meeting.section?.section_number}
      </div>
      {isCompact ? (
        <div className="truncate text-slate-500">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
      ) : (
        <>
          <div className="truncate text-slate-500">{meeting.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
          <div className="truncate text-slate-400">
            {meeting.room ? `${meeting.room.building?.abbreviation} ${meeting.room.room_number}` : "Online"}
          </div>
        </>
      )}
    </div>
  );
}
