import type { Meeting } from "../../api/types";
import { formatTime, parseDaysOfWeek } from "../../lib/utils";

const DAY_NAMES: Record<string, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  Th: "Thursday",
  F: "Friday",
  S: "Saturday",
  U: "Sunday",
};

interface Props {
  meeting: Meeting;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: number) => void;
}

export function MeetingDetailDialog({ meeting, onClose, onEdit, onDelete }: Props) {
  const section = meeting.section;
  const course = section?.course;
  const instructor = meeting.instructor;
  const room = meeting.room;
  const timeBlock = meeting.time_block;

  const days = parseDaysOfWeek(meeting.days_of_week);
  const dayNames = days.map((d) => DAY_NAMES[d] ?? d).join(", ");

  const courseNum = course?.course_number ?? "";
  const level = courseNum ? `${Math.floor(parseInt(courseNum) / 100) * 100}-level` : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 border-b border-border px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {course?.department_code} {courseNum}-{section?.section_number}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">{course?.title ?? "Untitled Course"}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3 text-sm">
          <DetailRow label="Instructor" value={instructor?.name ?? "TBD"} />
          <DetailRow
            label="Room"
            value={
              room
                ? `${room.building?.abbreviation} ${room.room_number} (cap: ${room.capacity})`
                : "Online"
            }
          />
          <DetailRow label="Days" value={dayNames || "—"} />
          <DetailRow
            label="Time"
            value={
              meeting.start_time && meeting.end_time
                ? `${formatTime(meeting.start_time)} – ${formatTime(meeting.end_time)}`
                : "—"
            }
          />
          <DetailRow label="Time Block" value={timeBlock?.label ?? "Custom"} />
          <DetailRow label="Credits" value={course?.credits != null ? String(course.credits) : "—"} />
          <DetailRow label="Level" value={level} />
          <DetailRow label="Enrollment Cap" value={section?.enrollment_cap != null ? String(section.enrollment_cap) : "—"} />
          <DetailRow label="Modality" value={section?.modality ?? "—"} />
          <DetailRow label="Status" value={section?.status ?? "—"} />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-slate-50">
          <button
            onClick={() => {
              if (confirm("Delete this meeting?")) {
                onDelete(meeting.id);
              }
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-border rounded-md hover:bg-accent"
            >
              Close
            </button>
            <button
              onClick={() => onEdit(meeting)}
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-medium"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-32 flex-shrink-0 text-slate-500 font-medium">{label}</span>
      <span className="text-slate-900 capitalize">{value}</span>
    </div>
  );
}
