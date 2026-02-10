import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Meeting, TimeBlock } from "../../api/types";
import { parseDaysOfWeek } from "../../lib/utils";
import { useState } from "react";
import { DraggableMeetingCard } from "./DraggableMeetingCard";
import { DroppableCell } from "./DroppableCell";
import { MeetingDragOverlay } from "./MeetingDragOverlay";

interface Props {
  meetings: Meeting[];
  timeBlocks: TimeBlock[];
  conflictMeetingIds: Set<number>;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: number) => void;
  onMove?: (meetingId: number, targetBlock: TimeBlock) => void;
  isMoving?: boolean;
}

const DAY_LABELS = ["M", "T", "W", "Th", "F"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function ScheduleGrid({
  meetings,
  timeBlocks,
  conflictMeetingIds,
  onEdit,
  onDelete,
  onMove,
  isMoving,
}: Props) {
  const [popoverId, setPopoverId] = useState<number | null>(null);
  const [activeDragMeeting, setActiveDragMeeting] = useState<Meeting | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Sort time blocks by start time
  const sortedBlocks = [...timeBlocks].sort((a, b) => {
    const ta = typeof a.start_time === "string" ? a.start_time : "";
    const tb = typeof b.start_time === "string" ? b.start_time : "";
    return ta.localeCompare(tb);
  });

  // Group blocks by pattern for display
  const mwfBlocks = sortedBlocks.filter((b) => b.pattern === "mwf");
  const tthBlocks = sortedBlocks.filter((b) => b.pattern === "tth");
  const eveningBlocks = sortedBlocks.filter((b) => b.pattern === "evening");

  // Create unified time rows - use all blocks
  const allBlocks = [...mwfBlocks, ...tthBlocks, ...eveningBlocks];

  // Find meetings for a given day and time block
  const getMeetingsForCell = (day: string, block: TimeBlock): Meeting[] => {
    const blockDays = parseDaysOfWeek(block.days_of_week);
    if (!blockDays.includes(day)) return [];

    return meetings.filter((m) => {
      const meetingDays = parseDaysOfWeek(m.days_of_week);
      if (!meetingDays.includes(day)) return false;

      // Match by time block ID or by time overlap
      if (m.time_block_id === block.id) return true;

      const mStart = typeof m.start_time === "string" ? m.start_time : "";
      const mEnd = typeof m.end_time === "string" ? m.end_time : "";
      const bStart = typeof block.start_time === "string" ? block.start_time : "";
      const bEnd = typeof block.end_time === "string" ? block.end_time : "";

      return mStart < bEnd && mEnd > bStart;
    });
  };

  function handleDragStart(event: DragStartEvent) {
    const { meeting } = event.active.data.current as { meeting: Meeting };
    setActiveDragMeeting(meeting);
    setPopoverId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragMeeting(null);

    if (!over || !onMove) return;

    const { meeting, sourceBlock } = active.data.current as {
      meeting: Meeting;
      sourceBlock: TimeBlock;
    };
    const { block: targetBlock } = over.data.current as { block: TimeBlock };

    if (targetBlock.id !== sourceBlock.id) {
      onMove(meeting.id, targetBlock);
    }
  }

  function handleDragCancel() {
    setActiveDragMeeting(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="bg-white rounded-lg border border-border overflow-x-auto">
        {isMoving && (
          <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium border-b border-border">
            Moving meeting...
          </div>
        )}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-2 py-2 text-left w-28 sticky left-0 bg-muted/50">Time</th>
              {DAY_LABELS.map((day, i) => (
                <th key={day} className="px-2 py-2 text-center min-w-[140px]">{DAY_FULL[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allBlocks.map((block) => (
              <tr key={block.id} className="border-b border-border">
                <td className="px-2 py-1 text-muted-foreground sticky left-0 bg-white text-[11px] whitespace-nowrap">
                  {block.label}
                </td>
                {DAY_LABELS.map((day) => {
                  const cellMeetings = getMeetingsForCell(day, block);
                  return (
                    <DroppableCell
                      key={day}
                      block={block}
                      day={day}
                      isDragging={activeDragMeeting != null}
                    >
                      {cellMeetings.map((m) => (
                        <DraggableMeetingCard
                          key={m.id}
                          meeting={m}
                          block={block}
                          day={day}
                          hasConflict={conflictMeetingIds.has(m.id)}
                          activeDragMeetingId={activeDragMeeting?.id ?? null}
                          popoverOpen={popoverId === m.id}
                          onTogglePopover={() => setPopoverId(popoverId === m.id ? null : m.id)}
                          onEdit={(meeting) => { setPopoverId(null); onEdit(meeting); }}
                          onDelete={(id) => { setPopoverId(null); onDelete(id); }}
                        />
                      ))}
                    </DroppableCell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragMeeting ? <MeetingDragOverlay meeting={activeDragMeeting} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
