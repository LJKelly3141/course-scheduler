import type { Meeting, TimeBlock } from "../../api/types";
import { cn, parseDaysOfWeek, formatTime, getLevelColor } from "../../lib/utils";
import { useState } from "react";

interface Props {
  meetings: Meeting[];
  timeBlocks: TimeBlock[];
  conflictMeetingIds: Set<number>;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: number) => void;
}

const DAY_LABELS = ["M", "T", "W", "Th", "F"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function ScheduleGrid({ meetings, timeBlocks, conflictMeetingIds, onEdit, onDelete }: Props) {
  const [popoverId, setPopoverId] = useState<number | null>(null);

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

  return (
    <div className="bg-white rounded-lg border border-border overflow-x-auto">
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
                  <td key={day} className="px-1 py-1 align-top relative min-h-[48px]">
                    {cellMeetings.map((m) => {
                      const courseNum = m.section?.course?.course_number ?? "";
                      const hasConflict = conflictMeetingIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => setPopoverId(popoverId === m.id ? null : m.id)}
                          className={cn(
                            "rounded px-1.5 py-1 mb-0.5 cursor-pointer text-white text-[11px] leading-tight",
                            getLevelColor(courseNum),
                            hasConflict && "ring-2 ring-red-500"
                          )}
                        >
                          <div className="font-semibold">
                            {m.section?.course?.department_code} {courseNum}-{m.section?.section_number}
                          </div>
                          <div className="opacity-90">{m.instructor?.name?.split(" ").pop() ?? "TBD"}</div>
                          <div className="opacity-80">{m.room ? `${m.room.building?.abbreviation} ${m.room.room_number}` : "Online"}</div>

                          {popoverId === m.id && (
                            <div
                              className="absolute z-50 bg-white text-foreground border border-border rounded-lg shadow-lg p-3 w-56 left-0 top-full mt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="font-semibold text-sm mb-1">
                                {m.section?.course?.department_code} {m.section?.course?.course_number}-{m.section?.section_number}
                              </p>
                              <p className="text-muted-foreground">{m.section?.course?.title}</p>
                              <p className="mt-1">Instructor: {m.instructor?.name ?? "TBD"}</p>
                              <p>Room: {m.room ? `${m.room.building?.abbreviation} ${m.room.room_number}` : "Online"}</p>
                              <p>Time: {formatTime(m.start_time)} - {formatTime(m.end_time)}</p>
                              <p>Days: {parseDaysOfWeek(m.days_of_week).join(", ")}</p>
                              {hasConflict && <p className="text-destructive font-medium mt-1">Has conflicts!</p>}
                              <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                                <button onClick={() => { setPopoverId(null); onEdit(m); }}
                                  className="text-primary text-xs hover:underline">Edit</button>
                                <button onClick={() => { setPopoverId(null); onDelete(m.id); }}
                                  className="text-destructive text-xs hover:underline">Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
