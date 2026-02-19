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
import {
  parseDaysOfWeek,
  timeToMinutes,
  meetingPosition,
  findNearestBlock,
  formatHourLabel,
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_HEIGHT_PX,
  TOTAL_SLOTS,
  GRID_START_MINUTES,
  SLOT_MINUTES,
} from "../../lib/utils";
import { useState } from "react";
import { DraggableMeetingCard } from "./DraggableMeetingCard";
import { DroppableCell } from "./DroppableCell";
import { MeetingDragOverlay } from "./MeetingDragOverlay";

interface Props {
  meetings: Meeting[];
  timeBlocks: TimeBlock[];
  colorFn?: (meeting: Meeting) => string;
  onDetail: (meeting: Meeting) => void;
  onEdit: (meeting: Meeting) => void;
  onMove?: (meetingId: number, targetBlock: TimeBlock) => void;
  isMoving?: boolean;
}

const DAY_LABELS = ["M", "T", "W", "Th", "F"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface OverlapInfo {
  column: number;
  totalColumns: number;
}

/** Greedy interval partitioning: assign meetings to columns so overlapping ones sit side-by-side */
function computeOverlapColumns(dayMeetings: Meeting[]): Map<number, OverlapInfo> {
  const sorted = [...dayMeetings].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  // columns[i] = end time (in minutes) of the last meeting in column i
  const columns: number[] = [];
  const assignments = new Map<number, OverlapInfo>();

  for (const m of sorted) {
    const start = timeToMinutes(m.start_time);
    // Find first column where the meeting fits (no overlap)
    let col = -1;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= start) {
        col = c;
        break;
      }
    }
    if (col === -1) {
      col = columns.length;
      columns.push(0);
    }
    columns[col] = timeToMinutes(m.end_time);
    assignments.set(m.id, { column: col, totalColumns: 0 });
  }

  // Now determine max overlap depth for each meeting by checking how many columns were active
  // Simple approach: totalColumns = max columns used at any point during this meeting's span
  for (const m of sorted) {
    const mStart = timeToMinutes(m.start_time);
    const mEnd = timeToMinutes(m.end_time);
    let maxCols = 1;
    for (const other of sorted) {
      if (other.id === m.id) continue;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = timeToMinutes(other.end_time);
      if (oStart < mEnd && oEnd > mStart) {
        // overlaps with m
        const info = assignments.get(other.id)!;
        maxCols = Math.max(maxCols, info.column + 1);
      }
    }
    const myInfo = assignments.get(m.id)!;
    maxCols = Math.max(maxCols, myInfo.column + 1);
    myInfo.totalColumns = maxCols;
  }

  // Normalize totalColumns: for each group of overlapping meetings, set totalColumns to the max
  for (const m of sorted) {
    const mStart = timeToMinutes(m.start_time);
    const mEnd = timeToMinutes(m.end_time);
    const myInfo = assignments.get(m.id)!;
    for (const other of sorted) {
      if (other.id === m.id) continue;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = timeToMinutes(other.end_time);
      if (oStart < mEnd && oEnd > mStart) {
        const otherInfo = assignments.get(other.id)!;
        const maxTotal = Math.max(myInfo.totalColumns, otherInfo.totalColumns);
        myInfo.totalColumns = maxTotal;
        otherInfo.totalColumns = maxTotal;
      }
    }
  }

  return assignments;
}

export function ScheduleGrid({
  meetings,
  timeBlocks,
  colorFn,
  onDetail,
  onEdit,
  onMove,
  isMoving,
}: Props) {
  const [activeDragMeeting, setActiveDragMeeting] = useState<Meeting | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Get meetings for a specific day (skip meetings with no time assigned)
  function getMeetingsForDay(day: string): Meeting[] {
    return meetings.filter((m) => {
      if (!m.days_of_week || !m.start_time || !m.end_time) return false;
      const days = parseDaysOfWeek(m.days_of_week);
      return days.includes(day);
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const { meeting } = event.active.data.current as { meeting: Meeting };
    setActiveDragMeeting(meeting);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragMeeting(null);

    if (!over || !onMove) return;

    const { meeting } = active.data.current as { meeting: Meeting };
    const { day, slotIndex } = over.data.current as { day: string; slotIndex: number };

    const dropMinute = GRID_START_MINUTES + slotIndex * SLOT_MINUTES;
    const targetBlock = findNearestBlock(day, dropMinute, timeBlocks);

    if (!targetBlock) return;
    if (targetBlock.id !== meeting.time_block_id) {
      onMove(meeting.id, targetBlock);
    }
  }

  function handleDragCancel() {
    setActiveDragMeeting(null);
  }

  // Hours for labels
  const hours: number[] = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    hours.push(h);
  }

  const gridHeight = TOTAL_SLOTS * SLOT_HEIGHT_PX;

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(5, 1fr)",
            gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT_PX}px)`,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-20 bg-muted/50 border-b border-border px-2 py-2 text-xs font-medium text-left"
            style={{ gridColumn: 1, gridRow: 1 }}
          >
            Time
          </div>
          {DAY_LABELS.map((day, i) => (
            <div
              key={day}
              className="sticky top-0 z-20 bg-muted/50 border-b border-border px-2 py-2 text-xs font-medium text-center"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {DAY_FULL[i]}
            </div>
          ))}

          {/* Hour labels in column 1 */}
          {hours.map((hour) => {
            const slotIndex = (hour - GRID_START_HOUR) * 4;
            return (
              <div
                key={hour}
                className="text-[11px] text-muted-foreground text-right pr-2 sticky left-0 bg-white z-10 border-t border-t-border"
                style={{
                  gridColumn: 1,
                  gridRow: `${slotIndex + 2} / span 4`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  paddingTop: "2px",
                }}
              >
                {formatHourLabel(hour)}
              </div>
            );
          })}

          {/* Droppable background cells: 52 slots × 5 days = 260 cells */}
          {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) =>
            DAY_LABELS.map((day, dayIdx) => (
              <DroppableCell
                key={`${day}-${slotIdx}`}
                day={day}
                slotIndex={slotIdx}
                isDragging={activeDragMeeting != null}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: slotIdx + 2,
                }}
              />
            ))
          )}

          {/* Day column overlays with absolutely-positioned meeting cards */}
          {DAY_LABELS.map((day, dayIdx) => {
            const dayMeetings = getMeetingsForDay(day);
            const overlapMap = computeOverlapColumns(dayMeetings);

            return (
              <div
                key={`overlay-${day}`}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: `2 / span ${TOTAL_SLOTS}`,
                  position: "relative",
                  pointerEvents: "none",
                }}
              >
                {dayMeetings.map((m) => {
                  const { topPx, heightPx } = meetingPosition(m.start_time, m.end_time);
                  const overlap = overlapMap.get(m.id) ?? { column: 0, totalColumns: 1 };
                  const widthPct = 100 / overlap.totalColumns;
                  const leftPct = overlap.column * widthPct;

                  return (
                    <DraggableMeetingCard
                      key={m.id}
                      meeting={m}
                      day={day}
                      bgColor={colorFn?.(m)}
                      activeDragMeetingId={activeDragMeeting?.id ?? null}
                      onDetail={onDetail}
                      onEdit={onEdit}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragMeeting ? <MeetingDragOverlay meeting={activeDragMeeting} bgColor={colorFn?.(activeDragMeeting)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
