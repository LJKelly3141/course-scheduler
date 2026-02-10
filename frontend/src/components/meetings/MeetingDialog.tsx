import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Meeting, Section, Room, Instructor, TimeBlock, ValidationResult } from "../../api/types";
import { parseDaysOfWeek } from "../../lib/utils";

interface Props {
  termId: number;
  meeting: Meeting | null;
  sections: Section[];
  rooms: Room[];
  instructors: Instructor[];
  timeBlocks: TimeBlock[];
  onClose: () => void;
  onSaved: () => void;
}

export function MeetingDialog({ termId, meeting, sections, rooms, instructors, timeBlocks, onClose, onSaved }: Props) {
  const [sectionId, setSectionId] = useState(meeting?.section_id ?? 0);
  const [timeBlockId, setTimeBlockId] = useState<number | null>(meeting?.time_block_id ?? null);
  const [roomId, setRoomId] = useState<number | null>(meeting?.room_id ?? null);
  const [instructorId, setInstructorId] = useState<number | null>(meeting?.instructor_id ?? null);
  const [customTime, setCustomTime] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState(meeting ? parseDaysOfWeek(meeting.days_of_week) : []);
  const [startTime, setStartTime] = useState(meeting?.start_time ?? "");
  const [endTime, setEndTime] = useState(meeting?.end_time ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // When a time block is selected, populate days and times
  useEffect(() => {
    if (timeBlockId && !customTime) {
      const block = timeBlocks.find((b) => b.id === timeBlockId);
      if (block) {
        setDaysOfWeek(parseDaysOfWeek(block.days_of_week));
        setStartTime(typeof block.start_time === "string" ? block.start_time : "");
        setEndTime(typeof block.end_time === "string" ? block.end_time : "");
      }
    }
  }, [timeBlockId, customTime, timeBlocks]);

  const handleSave = async () => {
    setErrors([]);
    if (!sectionId) { setErrors(["Section is required"]); return; }
    if (daysOfWeek.length === 0) { setErrors(["Days are required"]); return; }
    if (!startTime || !endTime) { setErrors(["Start and end time are required"]); return; }

    const body = {
      section_id: sectionId,
      days_of_week: JSON.stringify(daysOfWeek),
      start_time: startTime,
      end_time: endTime,
      time_block_id: customTime ? null : timeBlockId,
      room_id: roomId,
      instructor_id: instructorId,
    };

    setSaving(true);
    try {
      if (meeting) {
        await api.put(`/meetings/${meeting.id}`, body);
      } else {
        await api.post(`/terms/${termId}/meetings`, body);
      }
      onSaved();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Save failed"]);
    }
    setSaving(false);
  };

  const unscheduledSections = sections.filter(
    (s) => s.status === "unscheduled" || s.id === meeting?.section_id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{meeting ? "Edit Meeting" : "Add Meeting"}</h3>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Section</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
              <option value={0}>Select section...</option>
              {(meeting ? sections : unscheduledSections).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course?.department_code} {s.course?.course_number}-{s.section_number} ({s.modality})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Custom Time</label>
            <input type="checkbox" checked={customTime} onChange={(e) => setCustomTime(e.target.checked)} />
          </div>

          {!customTime ? (
            <div>
              <label className="block text-sm font-medium mb-1">Time Block</label>
              <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                value={timeBlockId ?? ""} onChange={(e) => setTimeBlockId(Number(e.target.value) || null)}>
                <option value="">Select time block...</option>
                <optgroup label="MWF">
                  {timeBlocks.filter((b) => b.pattern === "mwf").map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </optgroup>
                <optgroup label="TTh">
                  {timeBlocks.filter((b) => b.pattern === "tth").map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Evening">
                  {timeBlocks.filter((b) => b.pattern === "evening").map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Days</label>
                <div className="flex gap-1">
                  {["M", "T", "W", "Th", "F"].map((d) => (
                    <button key={d}
                      onClick={() => setDaysOfWeek(daysOfWeek.includes(d) ? daysOfWeek.filter((x) => x !== d) : [...daysOfWeek, d])}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        daysOfWeek.includes(d) ? "bg-primary text-white" : "bg-muted"
                      }`}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <input type="time" className="w-full border border-border rounded px-2 py-1.5 text-sm"
                    value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End</label>
                  <input type="time" className="w-full border border-border rounded px-2 py-1.5 text-sm"
                    value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Room</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={roomId ?? ""} onChange={(e) => setRoomId(Number(e.target.value) || null)}>
              <option value="">No room (online)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.building?.abbreviation} {r.room_number} (cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Instructor</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={instructorId ?? ""} onChange={(e) => setInstructorId(Number(e.target.value) || null)}>
              <option value="">TBD</option>
              {instructors.filter(i => i.is_active).map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.modality_constraint})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : meeting ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
