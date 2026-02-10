import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, Meeting, Room, Instructor, TimeBlock, Section, ValidationResult } from "../api/types";
import { ScheduleGrid } from "../components/schedule/ScheduleGrid";
import { ConflictSidebar } from "../components/conflicts/ConflictSidebar";
import { MeetingDialog } from "../components/meetings/MeetingDialog";
import { cn, parseDaysOfWeek } from "../lib/utils";

type ViewMode = "room" | "instructor" | "level";

export function SchedulePage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("room");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/meetings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["validation"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ meetingId, targetBlock }: { meetingId: number; targetBlock: TimeBlock }) =>
      api.put(`/meetings/${meetingId}`, {
        time_block_id: targetBlock.id,
        days_of_week: targetBlock.days_of_week,
        start_time: targetBlock.start_time,
        end_time: targetBlock.end_time,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["validation"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground">Select a term to view the schedule.</p>;
  }

  // Filter meetings based on view mode
  let filteredMeetings = meetings;
  if (viewMode === "room" && selectedRoomId) {
    filteredMeetings = meetings.filter((m) => m.room_id === selectedRoomId);
  } else if (viewMode === "instructor" && selectedInstructorId) {
    filteredMeetings = meetings.filter((m) => m.instructor_id === selectedInstructorId);
  } else if (viewMode === "level" && selectedLevel !== "all") {
    filteredMeetings = meetings.filter((m) => {
      const num = m.section?.course?.course_number;
      if (!num) return false;
      const level = Math.floor(parseInt(num) / 100) * 100;
      return String(level) === selectedLevel;
    });
  }

  // Auto-select first room/instructor
  if (viewMode === "room" && !selectedRoomId && rooms.length > 0) {
    setSelectedRoomId(rooms[0].id);
  }
  if (viewMode === "instructor" && !selectedInstructorId && instructors.length > 0) {
    setSelectedInstructorId(instructors[0].id);
  }

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
            value={selectedRoomId ?? ""}
            onChange={(e) => setSelectedRoomId(Number(e.target.value))}
          >
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
            value={selectedInstructorId ?? ""}
            onChange={(e) => setSelectedInstructorId(Number(e.target.value))}
          >
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

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <ScheduleGrid
            meetings={filteredMeetings}
            timeBlocks={timeBlocks}
            conflictMeetingIds={conflictMeetingIds}
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
