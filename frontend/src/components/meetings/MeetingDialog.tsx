import { useState, useEffect } from "react";
import { api } from "../../api/client";
import type { Meeting, Section, Room, Instructor, TimeBlock } from "../../api/types";
import { parseDaysOfWeek } from "../../lib/utils";

interface Props {
  termId: number;
  meeting: Meeting | null;
  section?: Section | null;
  sections: Section[];
  rooms: Room[];
  instructors: Instructor[];
  timeBlocks: TimeBlock[];
  termType?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function MeetingDialog({ termId, meeting, section, sections, rooms, instructors, timeBlocks, termType, onClose, onSaved }: Props) {
  const [sectionId, setSectionId] = useState(meeting?.section_id ?? section?.id ?? 0);
  const [timeBlockId, setTimeBlockId] = useState<number | null>(meeting?.time_block_id ?? null);
  const [roomId, setRoomId] = useState<number | null>(meeting?.room_id ?? null);
  const [instructorId, setInstructorId] = useState<number | null>(meeting?.instructor_id ?? null);
  const [customTime, setCustomTime] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState(meeting ? parseDaysOfWeek(meeting.days_of_week) : []);
  const [startTime, setStartTime] = useState(meeting?.start_time ?? "");
  const [endTime, setEndTime] = useState(meeting?.end_time ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Section fields
  const currentSection = section ?? sections.find((s) => s.id === sectionId) ?? null;
  const [sectionNumber, setSectionNumber] = useState(currentSection?.section_number ?? "");
  const [enrollmentCap, setEnrollmentCap] = useState(currentSection?.enrollment_cap ?? 30);
  const [modality, setModality] = useState(currentSection?.modality ?? "in_person");
  const [session, setSession] = useState(currentSection?.session ?? "regular");
  const [sectionInstructorId, setSectionInstructorId] = useState<number | null>(currentSection?.instructor_id ?? null);

  const isOnline = modality === "online_sync" || modality === "online_async";
  const isAsync = modality === "online_async";
  const showSessions = termType === "fall" || termType === "spring";
  const isEditing = !!meeting || !!section;

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

  // When time block is cleared, clear days and times
  useEffect(() => {
    if (!timeBlockId && !customTime) {
      setDaysOfWeek([]);
      setStartTime("");
      setEndTime("");
    }
  }, [timeBlockId, customTime]);

  const handleSave = async () => {
    setErrors([]);
    if (!sectionId) { setErrors(["Section is required"]); return; }

    if (customTime && daysOfWeek.length > 0 && (!startTime || !endTime)) {
      setErrors(["If days are selected, start and end time are required"]);
      return;
    }
    if (customTime && (startTime || endTime) && daysOfWeek.length === 0) {
      setErrors(["If times are set, at least one day must be selected"]);
      return;
    }

    const hasDays = daysOfWeek.length > 0;
    const meetingBody = {
      section_id: sectionId,
      days_of_week: hasDays ? JSON.stringify(daysOfWeek) : null,
      start_time: startTime || null,
      end_time: endTime || null,
      time_block_id: customTime ? null : timeBlockId,
      room_id: roomId,
      instructor_id: instructorId,
    };

    setSaving(true);
    try {
      // Save section changes if editing an existing section
      if (isEditing && currentSection) {
        const sectionUpdate: Record<string, unknown> = {};
        if (sectionNumber !== currentSection.section_number) sectionUpdate.section_number = sectionNumber;
        if (enrollmentCap !== currentSection.enrollment_cap) sectionUpdate.enrollment_cap = enrollmentCap;
        if (modality !== currentSection.modality) sectionUpdate.modality = modality;
        if (session !== (currentSection.session ?? "regular")) sectionUpdate.session = session;
        if (sectionInstructorId !== currentSection.instructor_id) sectionUpdate.instructor_id = sectionInstructorId;

        if (Object.keys(sectionUpdate).length > 0) {
          await api.put(`/sections/${currentSection.id}`, sectionUpdate);
        }
      }

      // Save meeting (skip for async online with no meeting)
      if (!isAsync) {
        if (meeting) {
          await api.put(`/meetings/${meeting.id}`, meetingBody);
        } else {
          await api.post(`/terms/${termId}/meetings`, meetingBody);
        }
      }

      onSaved();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Save failed"]);
    }
    setSaving(false);
  };

  const unscheduledSections = sections.filter(
    (s) => s.status === "unscheduled" || s.id === meeting?.section_id || s.id === section?.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">
          {meeting ? "Edit Section & Meeting" : section ? "Edit Section" : "Add Meeting"}
        </h3>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}

        <div className="space-y-3">
          {/* --- Section fields --- */}
          {isEditing && currentSection && (
            <div className="space-y-3 pb-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Section Number</label>
                  <input className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={sectionNumber} onChange={(e) => setSectionNumber(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Enrollment Cap</label>
                  <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={enrollmentCap} onChange={(e) => setEnrollmentCap(parseInt(e.target.value) || 30)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Modality</label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={modality} onChange={(e) => setModality(e.target.value)}>
                    <option value="in_person">In Person</option>
                    <option value="online_sync">Online Sync</option>
                    <option value="online_async">Online Async</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                {showSessions && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Session</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                      value={session} onChange={(e) => setSession(e.target.value)}>
                      <option value="regular">Regular</option>
                      <option value="session_a">Session A</option>
                      <option value="session_b">Session B</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Section Instructor</label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  value={sectionInstructorId ?? ""} onChange={(e) => setSectionInstructorId(Number(e.target.value) || null)}>
                  <option value="">TBD</option>
                  {instructors.filter(i => i.is_active).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.modality_constraint})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* --- Meeting fields --- */}
          {!isAsync && (
            <>
              {isEditing && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meeting</p>
              )}

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
                    <option value={0}>Select section...</option>
                    {(meeting ? sections : unscheduledSections).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.course?.department_code} {s.course?.course_number}-{s.section_number} ({s.modality.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Custom Time</label>
                <input type="checkbox" checked={customTime} onChange={(e) => setCustomTime(e.target.checked)} />
              </div>

              {!customTime ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Time Block</label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={timeBlockId ?? ""} onChange={(e) => setTimeBlockId(Number(e.target.value) || null)}>
                    <option value="">TBD</option>
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
                    <optgroup label="Other">
                      <option value="none">No meeting time</option>
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
                  <option value="">TBD</option>
                  <option value="none">No room (online)</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.building?.abbreviation} {r.room_number} (cap: {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Meeting Instructor</label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  value={instructorId ?? ""} onChange={(e) => setInstructorId(Number(e.target.value) || null)}>
                  <option value="">TBD</option>
                  {instructors.filter(i => i.is_active).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.modality_constraint})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isAsync && isEditing && (
            <p className="text-sm text-muted-foreground">
              This is an online asynchronous section. No meeting time or room is needed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
