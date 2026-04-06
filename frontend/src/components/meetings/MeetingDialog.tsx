import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Meeting, Section, Room, Instructor, TimeBlock, Term } from "../../api/types";
import type { InstructorAvailability } from "../../api/types";
import { parseDaysOfWeek } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StyledSelect } from "@/components/ui/styled-select";

const DAY_LABELS: Record<string, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  Th: "Thursday",
  F: "Friday",
};

interface Props {
  termId: number;
  meeting: Meeting | null;
  section?: Section | null;
  sections: Section[];
  rooms: Room[];
  instructors: Instructor[];
  timeBlocks: TimeBlock[];
  termType?: string;
  term?: Term | null;
  onClose: () => void;
  onSaved: (info?: { meeting?: Meeting; previousMeeting?: Meeting | null; action: "create" | "update" }) => void;
}

export function MeetingDialog({ termId, meeting, section, sections, rooms, instructors, timeBlocks, termType, term, onClose, onSaved }: Props) {
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

  // Fetch settings to check if availability warnings are disabled
  const { data: settingsList } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ key: string; value: string }[]>("/settings"),
  });
  const warningsDisabled = settingsList?.find(
    (s) => s.key === "disable_availability_warnings"
  )?.value === "true";

  // Fetch per-term availability for the selected meeting instructor
  const { data: availability } = useQuery({
    queryKey: ["instructor-availability", instructorId, termId],
    queryFn: () =>
      api.get<InstructorAvailability[]>(
        `/instructors/${instructorId}/availability?term_id=${termId}`
      ),
    enabled: !!instructorId && !warningsDisabled,
  });

  // Compute availability warnings based on selected time slot
  const availabilityWarnings = useMemo(() => {
    if (!availability || !daysOfWeek.length || !startTime || !endTime) return [];
    const warnings: string[] = [];
    const instructor = instructors.find((i) => i.id === instructorId);
    const name = instructor?.name ?? "Instructor";

    for (const block of availability) {
      if (!daysOfWeek.includes(block.day_of_week)) continue;
      // Time overlap check: meeting [startTime, endTime) vs block [start_time, end_time)
      const bStart = block.start_time.slice(0, 5);
      const bEnd = block.end_time.slice(0, 5);
      if (startTime < bEnd && endTime > bStart) {
        if (block.type === "unavailable") {
          warnings.push(
            `${name} is unavailable ${block.day_of_week} ${bStart}\u2013${bEnd}`
          );
        } else if (block.type === "prefer_avoid") {
          warnings.push(
            `${name} prefers to avoid ${block.day_of_week} ${bStart}\u2013${bEnd}`
          );
        }
      }
    }
    return warnings;
  }, [availability, daysOfWeek, startTime, endTime, instructorId, instructors]);

  const currentSection = section ?? sections.find((s) => s.id === sectionId) ?? null;
  const [sectionNumber, setSectionNumber] = useState(currentSection?.section_number ?? "");
  const [enrollmentCap, setEnrollmentCap] = useState(currentSection?.enrollment_cap ?? 30);
  const [modality, setModality] = useState(currentSection?.modality ?? "in_person");
  const [session, setSession] = useState(currentSection?.session ?? "regular");
  const [termSessionId, setTermSessionId] = useState<number | null>(currentSection?.term_session_id ?? null);
  const termSessions = term?.sessions ?? [];
  const [sectionInstructorId, setSectionInstructorId] = useState<number | null>(currentSection?.instructor_id ?? null);
  const [durationWeeks, setDurationWeeks] = useState<number | null>(currentSection?.duration_weeks ?? null);
  const [lectureHours, setLectureHours] = useState<number | null>(currentSection?.lecture_hours ?? null);
  const [specialCourseFee, setSpecialCourseFee] = useState<number | null>(currentSection?.special_course_fee ?? null);
  const [sectionNotes, setSectionNotes] = useState(currentSection?.notes ?? "");

  const isOnline = modality === "online_sync" || modality === "online_async";
  const isAsync = modality === "online_async";
  const isSummer = termType === "summer";
  const showSessions = true;
  const isEditing = !!meeting || !!section;

  // Client-side date preview for summer sessions
  const selectedTermSession = useMemo(() => {
    if (!termSessionId || !termSessions.length) return null;
    return termSessions.find((s) => s.id === termSessionId) ?? null;
  }, [termSessionId, termSessions]);

  const sessionStartDate = selectedTermSession?.start_date ?? null;
  const sessionEndDate = selectedTermSession?.end_date ?? null;

  const computedEndDate = useMemo(() => {
    if (sessionEndDate) return sessionEndDate;
    if (!sessionStartDate || !durationWeeks || durationWeeks < 1) return null;
    const start = new Date(sessionStartDate + "T00:00:00");
    const rawEnd = new Date(start.getTime() + (durationWeeks - 1) * 7 * 86400000);
    const dayOfWeek = rawEnd.getDay(); // 0=Sun ... 5=Fri
    const daysUntilFri = (5 - dayOfWeek + 7) % 7;
    const endDate = new Date(rawEnd.getTime() + daysUntilFri * 86400000);
    return endDate.toISOString().slice(0, 10);
  }, [sessionStartDate, sessionEndDate, durationWeeks]);

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
      if (isEditing && currentSection) {
        const sectionUpdate: Record<string, unknown> = {};
        if (sectionNumber !== currentSection.section_number) sectionUpdate.section_number = sectionNumber;
        if (enrollmentCap !== currentSection.enrollment_cap) sectionUpdate.enrollment_cap = enrollmentCap;
        if (modality !== currentSection.modality) sectionUpdate.modality = modality;
        if (session !== (currentSection.session ?? "regular")) sectionUpdate.session = session;
        if (termSessionId !== currentSection.term_session_id) sectionUpdate.term_session_id = termSessionId;
        if (sectionInstructorId !== currentSection.instructor_id) sectionUpdate.instructor_id = sectionInstructorId;
        if (durationWeeks !== currentSection.duration_weeks) sectionUpdate.duration_weeks = durationWeeks;
        if (lectureHours !== currentSection.lecture_hours) sectionUpdate.lecture_hours = lectureHours;
        if (specialCourseFee !== currentSection.special_course_fee) sectionUpdate.special_course_fee = specialCourseFee;
        if (sectionNotes !== (currentSection.notes ?? "")) sectionUpdate.notes = sectionNotes || null;

        if (Object.keys(sectionUpdate).length > 0) {
          await api.put(`/sections/${currentSection.id}`, sectionUpdate);
        }
      }

      if (!isAsync) {
        if (meeting) {
          const updated = await api.put<Meeting>(`/meetings/${meeting.id}`, meetingBody);
          onSaved({ meeting: updated, previousMeeting: meeting, action: "update" });
          return;
        } else {
          const created = await api.post<Meeting>(`/terms/${termId}/meetings`, meetingBody);
          onSaved({ meeting: created, action: "create" });
          return;
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {meeting ? "Edit Section & Meeting" : section ? "Edit Section" : "Add Meeting"}
          </DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2" role="alert">
            {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}

        <div className="space-y-3">
          {isEditing && currentSection && (
            <div className="space-y-3 pb-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mtg-section-number" className="block text-sm font-medium mb-1">Section Number</label>
                  <input id="mtg-section-number" className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    aria-required="true"
                    value={sectionNumber} onChange={(e) => setSectionNumber(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="mtg-enrollment-cap" className="block text-sm font-medium mb-1">Enrollment Cap</label>
                  <input id="mtg-enrollment-cap" type="number" className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    aria-required="true"
                    value={enrollmentCap} onChange={(e) => setEnrollmentCap(parseInt(e.target.value) || 30)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mtg-modality" className="block text-sm font-medium mb-1">Modality</label>
                  <StyledSelect id="mtg-modality"
                    aria-required="true"
                    value={modality} onChange={(e) => setModality(e.target.value)}>
                    <option value="in_person">In Person</option>
                    <option value="online_sync">Online Sync</option>
                    <option value="online_async">Online Async</option>
                    <option value="hybrid">Hybrid</option>
                  </StyledSelect>
                </div>
                {showSessions && termSessions.length > 0 && (
                  <div>
                    <label htmlFor="mtg-term-session" className="block text-sm font-medium mb-1">Session</label>
                    <StyledSelect id="mtg-term-session"
                      value={termSessionId ?? ""} onChange={(e) => setTermSessionId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">No Session</option>
                      {termSessions.map((ts) => (
                        <option key={ts.id} value={ts.id}>{ts.name}</option>
                      ))}
                    </StyledSelect>
                  </div>
                )}
              </div>

              {isSummer && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="mtg-duration-weeks" className="block text-sm font-medium mb-1">Duration (weeks)</label>
                    <input id="mtg-duration-weeks" type="number" min="1" max="16"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm"
                      value={durationWeeks ?? ""}
                      onChange={(e) => setDurationWeeks(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date Range</label>
                    <p className="text-sm text-muted-foreground py-2">
                      {sessionStartDate && computedEndDate
                        ? `${sessionStartDate} to ${computedEndDate}`
                        : sessionStartDate
                        ? "Set duration to compute end date"
                        : "Session start date not configured"}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="mtg-section-instructor" className="block text-sm font-medium mb-1">Section Instructor</label>
                <StyledSelect id="mtg-section-instructor"
                  value={sectionInstructorId ?? ""} onChange={(e) => setSectionInstructorId(Number(e.target.value) || null)}>
                  <option value="">TBD</option>
                  {instructors.filter(i => i.is_active).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.modality_constraint})</option>
                  ))}
                </StyledSelect>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mtg-lecture-hours" className="block text-sm font-medium mb-1">Lecture Hours</label>
                  <input id="mtg-lecture-hours" type="number" step="0.5" min="0"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    value={lectureHours ?? ""}
                    onChange={(e) => setLectureHours(e.target.value ? parseFloat(e.target.value) : null)} />
                </div>
                <div>
                  <label htmlFor="mtg-special-course-fee" className="block text-sm font-medium mb-1">Special Course Fee</label>
                  <input id="mtg-special-course-fee" type="number" step="0.01" min="0"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder="$"
                    value={specialCourseFee ?? ""}
                    onChange={(e) => setSpecialCourseFee(e.target.value ? parseFloat(e.target.value) : null)} />
                </div>
              </div>

              <div>
                <label htmlFor="mtg-class-notes" className="block text-sm font-medium mb-1">Class Notes</label>
                <input id="mtg-class-notes" className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  placeholder="Optional notes for the dean's office"
                  value={sectionNotes}
                  onChange={(e) => setSectionNotes(e.target.value)} />
              </div>
            </div>
          )}

          {!isAsync && (
            <>
              {isEditing && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meeting</p>
              )}

              {!isEditing && (
                <div>
                  <label htmlFor="mtg-section-select" className="block text-sm font-medium mb-1">Section</label>
                  <StyledSelect id="mtg-section-select"
                    aria-required="true"
                    value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
                    <option value={0}>Select section...</option>
                    {(meeting ? sections : unscheduledSections).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.course?.department_code} {s.course?.course_number}-{s.section_number} ({s.modality.replace("_", " ")})
                      </option>
                    ))}
                  </StyledSelect>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label htmlFor="mtg-custom-time" className="text-sm font-medium">Custom Time</label>
                <input id="mtg-custom-time" type="checkbox" checked={customTime} onChange={(e) => setCustomTime(e.target.checked)} />
              </div>

              {!customTime ? (
                <div>
                  <label htmlFor="mtg-time-block" className="block text-sm font-medium mb-1">Time Block</label>
                  <StyledSelect id="mtg-time-block"
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
                  </StyledSelect>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" id="mtg-days-label">Days</label>
                    <div className="flex gap-1" role="group" aria-labelledby="mtg-days-label">
                      {(["M", "T", "W", "Th", "F"] as const).map((d) => (
                        <button key={d}
                          type="button"
                          aria-label={DAY_LABELS[d]}
                          aria-pressed={daysOfWeek.includes(d)}
                          onClick={() => setDaysOfWeek(daysOfWeek.includes(d) ? daysOfWeek.filter((x) => x !== d) : [...daysOfWeek, d])}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            daysOfWeek.includes(d) ? "bg-primary text-white" : "bg-muted"
                          }`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="mtg-start-time" className="block text-sm font-medium mb-1">Start</label>
                      <input id="mtg-start-time" type="time" className="w-full border border-border rounded px-2 py-1.5 text-sm"
                        value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="mtg-end-time" className="block text-sm font-medium mb-1">End</label>
                      <input id="mtg-end-time" type="time" className="w-full border border-border rounded px-2 py-1.5 text-sm"
                        value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="mtg-room" className="block text-sm font-medium mb-1">Room</label>
                <StyledSelect id="mtg-room"
                  value={roomId ?? ""} onChange={(e) => setRoomId(Number(e.target.value) || null)}>
                  <option value="">TBD</option>
                  <option value="none">No room (online)</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.building?.abbreviation} {r.room_number} (cap: {r.capacity})
                    </option>
                  ))}
                </StyledSelect>
              </div>

              <div>
                <label htmlFor="mtg-instructor" className="block text-sm font-medium mb-1">Meeting Instructor</label>
                <StyledSelect id="mtg-instructor"
                  value={instructorId ?? ""} onChange={(e) => setInstructorId(Number(e.target.value) || null)}>
                  <option value="">TBD</option>
                  {instructors.filter(i => i.is_active).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.modality_constraint})</option>
                  ))}
                </StyledSelect>
              </div>
              {availabilityWarnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2 space-y-1">
                  {availabilityWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {isAsync && isEditing && (
            <p className="text-sm text-muted-foreground">
              This is an online asynchronous section. No meeting time or room is needed.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
