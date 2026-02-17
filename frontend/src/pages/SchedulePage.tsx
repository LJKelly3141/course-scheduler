import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, Meeting, Room, Instructor, TimeBlock, Section, ValidationResult } from "../api/types";
import { ScheduleGrid } from "../components/schedule/ScheduleGrid";
import { ConflictSidebar } from "../components/conflicts/ConflictSidebar";
import { MeetingDialog } from "../components/meetings/MeetingDialog";
import { cn, parseDaysOfWeek, buildColorMap, getLevelHexColor } from "../lib/utils";

type ViewMode = "room" | "instructor" | "level";

export function SchedulePage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("room");
  const [selectedRoomId, setSelectedRoomId] = useState<number | "all">("all");
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | "all">("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", selectedTerm?.id],
    queryFn: () => api.get<Meeting[]>(`/terms/${selectedTerm!.id}/meetings`),
    enabled: !!selectedTerm,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: timeBlocks = [] } = useQuery({
    queryKey: ["timeblocks"],
    queryFn: () => api.get<TimeBlock[]>("/timeblocks"),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: validation } = useQuery({
    queryKey: ["validation", selectedTerm?.id],
    queryFn: () => api.get<ValidationResult>(`/terms/${selectedTerm!.id}/validate`),
    enabled: !!selectedTerm,
  });

  const invalidateSchedule = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/meetings/${id}`),
    onSettled: invalidateSchedule,
  });

  const moveMutation = useMutation({
    mutationFn: ({ meetingId, targetBlock }: { meetingId: number; targetBlock: TimeBlock }) =>
      api.put(`/meetings/${meetingId}`, {
        time_block_id: targetBlock.id,
        days_of_week: targetBlock.days_of_week,
        start_time: targetBlock.start_time,
        end_time: targetBlock.end_time,
      }),
    onSettled: invalidateSchedule,
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground">Select a term to view the schedule.</p>;
  }

  // Filter meetings based on view mode
  let filteredMeetings = meetings;
  if (viewMode === "room" && selectedRoomId !== "all") {
    filteredMeetings = meetings.filter((m) => m.room_id === selectedRoomId);
  } else if (viewMode === "instructor" && selectedInstructorId !== "all") {
    filteredMeetings = meetings.filter((m) => m.instructor_id === selectedInstructorId);
  } else if (viewMode === "level" && selectedLevel !== "all") {
    filteredMeetings = meetings.filter((m) => {
      const num = m.section?.course?.course_number;
      if (!num) return false;
      const level = Math.floor(parseInt(num) / 100) * 100;
      return String(level) === selectedLevel;
    });
  }

  // Exclude meetings with no time data (defensive for online-only)
  filteredMeetings = filteredMeetings.filter(
    (m) => m.start_time && m.days_of_week && m.days_of_week.length > 0
  );

  // Online async sections: modality is "online" and no meetings with time data
  const sectionIdsWithMeetings = new Set(meetings.map((m) => m.section_id));

  let onlineAsyncSections = sections.filter(
    (s) => s.modality === "online" && !sectionIdsWithMeetings.has(s.id)
  );

  // Apply the same view-mode filter to the online table
  if (viewMode === "room" && selectedRoomId !== "all") {
    // Online sections have no room — hide when filtering by a specific room
    onlineAsyncSections = [];
  } else if (viewMode === "instructor" && selectedInstructorId !== "all") {
    onlineAsyncSections = onlineAsyncSections.filter(
      (s) => s.instructor_id === selectedInstructorId
    );
  } else if (viewMode === "level" && selectedLevel !== "all") {
    onlineAsyncSections = onlineAsyncSections.filter((s) => {
      const num = s.course?.course_number;
      if (!num) return false;
      const level = Math.floor(parseInt(num) / 100) * 100;
      return String(level) === selectedLevel;
    });
  }

  // Build color maps for rooms and instructors
  const roomColorMap = buildColorMap(rooms.map((r) => r.id));
  const instructorColorMap = buildColorMap(instructors.filter((i) => i.is_active).map((i) => i.id));

  const colorFn = (m: Meeting): string => {
    if (viewMode === "room") {
      return m.room_id ? (roomColorMap.get(m.room_id) ?? "#9ca3af") : "#9ca3af";
    }
    if (viewMode === "instructor") {
      return m.instructor_id ? (instructorColorMap.get(m.instructor_id) ?? "#9ca3af") : "#9ca3af";
    }
    // level mode
    const courseNum = m.section?.course?.course_number ?? "";
    return getLevelHexColor(courseNum);
  };

  const allConflicts = [
    ...(validation?.hard_conflicts ?? []),
    ...(validation?.soft_warnings ?? []),
  ];

  const conflictMeetingIds = new Set(allConflicts.flatMap((c) => c.meeting_ids));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Schedule — {selectedTerm.name}</h2>
        <button
          onClick={() => { setEditingMeeting(null); setDialogOpen(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          + Add Meeting
        </button>
      </div>

      {/* View mode tabs + selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["room", "instructor", "level"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium capitalize",
                viewMode === mode ? "bg-primary text-primary-foreground" : "bg-white hover:bg-accent"
              )}
            >
              By {mode}
            </button>
          ))}
        </div>

        {viewMode === "room" && (
          <select
            className="border border-border rounded-md px-2 py-1.5 text-sm"
            value={selectedRoomId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedRoomId(v === "all" ? "all" : Number(v));
            }}
          >
            <option value="all">All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.building?.abbreviation} {r.room_number} (cap: {r.capacity})
              </option>
            ))}
          </select>
        )}

        {viewMode === "instructor" && (
          <select
            className="border border-border rounded-md px-2 py-1.5 text-sm"
            value={selectedInstructorId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedInstructorId(v === "all" ? "all" : Number(v));
            }}
          >
            <option value="all">All Instructors</option>
            {instructors.filter(i => i.is_active).map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        )}

        {viewMode === "level" && (
          <select
            className="border border-border rounded-md px-2 py-1.5 text-sm"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="all">All Levels</option>
            {["100", "200", "300", "400", "600", "700"].map((l) => (
              <option key={l} value={l}>{l}-level</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Conflicts
          {allConflicts.length > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-destructive rounded-full text-xs font-medium">
              {allConflicts.length}
            </span>
          )}
        </button>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {viewMode === "room" && rooms.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: roomColorMap.get(r.id) }} />
            {r.building?.abbreviation} {r.room_number}
          </span>
        ))}
        {viewMode === "instructor" && instructors.filter(i => i.is_active).map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: instructorColorMap.get(i.id) }} />
            {i.name}
          </span>
        ))}
        {viewMode === "level" && ["100", "200", "300", "400", "600", "700"].map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: getLevelHexColor(l) }} />
            {l}-level
          </span>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <ScheduleGrid
            meetings={filteredMeetings}
            timeBlocks={timeBlocks}
            conflictMeetingIds={conflictMeetingIds}
            colorFn={colorFn}
            onEdit={(m) => { setEditingMeeting(m); setDialogOpen(true); }}
            onDelete={(id) => { if (confirm("Delete this meeting?")) deleteMutation.mutate(id); }}
            onMove={(meetingId, targetBlock) => moveMutation.mutate({ meetingId, targetBlock })}
            isMoving={moveMutation.isPending}
          />
        </div>

        {sidebarOpen && (
          <ConflictSidebar
            conflicts={validation?.hard_conflicts ?? []}
            warnings={validation?.soft_warnings ?? []}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {onlineAsyncSections.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-4">
          <h3 className="text-lg font-semibold mb-3">Online Asynchronous Sections</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 w-6"></th>
                <th className="py-2 pr-4">Course</th>
                <th className="py-2 pr-4">Section</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Level</th>
                <th className="py-2 pr-4">Instructor</th>
                <th className="py-2 pr-4">Credits</th>
                <th className="py-2 pr-4">Enrollment Cap</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {onlineAsyncSections.map((s) => {
                const courseNum = s.course?.course_number ?? "";
                const level = Math.floor(parseInt(courseNum) / 100) * 100;
                let rowColor = "#9ca3af";
                if (viewMode === "instructor" && s.instructor_id) {
                  rowColor = instructorColorMap.get(s.instructor_id) ?? "#9ca3af";
                } else if (viewMode === "level") {
                  rowColor = getLevelHexColor(courseNum);
                } else if (viewMode === "room") {
                  rowColor = getLevelHexColor(courseNum);
                }

                return (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ backgroundColor: rowColor }}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      {s.course?.department_code} {courseNum}
                    </td>
                    <td className="py-2 pr-4">{s.section_number}</td>
                    <td className="py-2 pr-4">{s.course?.title}</td>
                    <td className="py-2 pr-4">{level || "—"}-level</td>
                    <td className="py-2 pr-4">{s.instructor?.name ?? "TBD"}</td>
                    <td className="py-2 pr-4">{s.course?.credits}</td>
                    <td className="py-2 pr-4">{s.enrollment_cap ?? "—"}</td>
                    <td className="py-2 capitalize">{s.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <MeetingDialog
          termId={selectedTerm.id}
          meeting={editingMeeting}
          sections={sections}
          rooms={rooms}
          instructors={instructors}
          timeBlocks={timeBlocks}
          onClose={() => { setDialogOpen(false); setEditingMeeting(null); }}
          onSaved={() => {
            setDialogOpen(false);
            setEditingMeeting(null);
            queryClient.invalidateQueries({ queryKey: ["meetings"] });
            queryClient.invalidateQueries({ queryKey: ["validation"] });
            queryClient.invalidateQueries({ queryKey: ["sections"] });
          }}
        />
      )}
    </div>
  );
}
