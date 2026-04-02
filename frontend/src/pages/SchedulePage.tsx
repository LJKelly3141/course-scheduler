import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, Meeting, Room, Instructor, TimeBlock, Section, ValidationResult } from "../api/types";
import { ScheduleGrid } from "../components/schedule/ScheduleGrid";
import { MeetingDetailDialog } from "../components/schedule/MeetingDetailDialog";
import { InstructorScheduleDialog } from "../components/schedule/InstructorScheduleDialog";
import { CompareScheduleDialog } from "../components/schedule/CompareScheduleDialog";
import { ConflictSidebar, warningKey } from "../components/conflicts/ConflictSidebar";
import { MeetingDialog } from "../components/meetings/MeetingDialog";
import { MultiSelectFilter } from "../components/schedule/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { cn, parseDaysOfWeek, buildColorMap, getLevelHexColor, entityBgAlpha } from "../lib/utils";
import { useTheme } from "../hooks/useTheme";
import { useUndoRedo } from "../hooks/useUndoRedo";

type ViewMode = "room" | "instructor" | "level";

function meetingLabel(m: Meeting): string {
  const sec = m.section;
  const code = sec?.course?.department_code ?? "";
  const num = sec?.course?.course_number ?? "";
  const secNum = sec?.section_number ?? "";
  return code ? `${code} ${num}-${secNum}` : `Meeting #${m.id}`;
}

export function SchedulePage() {
  const { selectedTerm, isReadOnly } = useOutletContext<{ selectedTerm: Term | null; isReadOnly: boolean }>();
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const { pushUndo } = useUndoRedo();
  const [viewMode, setViewMode] = useState<ViewMode>("room");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedInstructors, setSelectedInstructors] = useState<Set<string>>(new Set());
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportLink, setExportLink] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
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

  const { data: dismissedKeys = [] } = useQuery({
    queryKey: ["dismissed-warnings", selectedTerm?.id],
    queryFn: () => api.get<string[]>(`/terms/${selectedTerm!.id}/dismissed-warnings`),
    enabled: !!selectedTerm,
  });
  const dismissedSet = new Set(dismissedKeys);

  const dismissMutation = useMutation({
    mutationFn: (key: string) =>
      api.post(`/terms/${selectedTerm!.id}/dismissed-warnings`, { warning_key: key }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dismissed-warnings"] }),
  });

  const undismissMutation = useMutation({
    mutationFn: (key: string) =>
      api.delete(`/terms/${selectedTerm!.id}/dismissed-warnings/${encodeURIComponent(key)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dismissed-warnings"] }),
  });

  const invalidateSchedule = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (meeting: Meeting) => api.delete(`/meetings/${meeting.id}`),
    onSuccess: (_data, meeting) => {
      invalidateSchedule();
      const label = `Delete ${meetingLabel(meeting)}`;
      let currentId = meeting.id;
      pushUndo({
        label,
        undoFn: async () => {
          const recreated = await api.post<Meeting>(`/terms/${selectedTerm!.id}/meetings`, {
            section_id: meeting.section_id,
            days_of_week: meeting.days_of_week,
            start_time: meeting.start_time,
            end_time: meeting.end_time,
            time_block_id: meeting.time_block_id,
            room_id: meeting.room_id,
            instructor_id: meeting.instructor_id,
          });
          currentId = recreated.id;
        },
        redoFn: async () => {
          await api.delete(`/meetings/${currentId}`);
        },
        invalidateKeys: [["meetings"], ["validation"], ["sections"]],
      });
    },
    onError: () => invalidateSchedule(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ meetingId, targetBlock, previousState }: {
      meetingId: number;
      targetBlock: TimeBlock;
      previousState: { time_block_id: number | null; days_of_week: string | null; start_time: string | null; end_time: string | null };
    }) =>
      api.put(`/meetings/${meetingId}`, {
        time_block_id: targetBlock.id,
        days_of_week: targetBlock.days_of_week,
        start_time: targetBlock.start_time,
        end_time: targetBlock.end_time,
      }),
    onSuccess: (_data, { meetingId, targetBlock, previousState }) => {
      invalidateSchedule();
      const meeting = meetings.find((m) => m.id === meetingId);
      const label = `Move ${meeting ? meetingLabel(meeting) : `Meeting #${meetingId}`}`;
      pushUndo({
        label,
        undoFn: async () => {
          await api.put(`/meetings/${meetingId}`, {
            time_block_id: previousState.time_block_id,
            days_of_week: previousState.days_of_week,
            start_time: previousState.start_time,
            end_time: previousState.end_time,
          });
        },
        redoFn: async () => {
          await api.put(`/meetings/${meetingId}`, {
            time_block_id: targetBlock.id,
            days_of_week: targetBlock.days_of_week,
            start_time: targetBlock.start_time,
            end_time: targetBlock.end_time,
          });
        },
        invalidateKeys: [["meetings"], ["validation"], ["sections"]],
      });
    },
    onError: () => invalidateSchedule(),
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground">Select a term to view the schedule.</p>;
  }

  // Derive filter options from data
  const deptOptions = Array.from(new Set(
    meetings.map((m) => m.section?.course?.department_code).filter(Boolean) as string[]
  )).sort().map((d) => ({ value: d, label: d }));

  const roomOptions = rooms.map((r) => ({
    value: String(r.id),
    label: `${r.building?.abbreviation ?? ""} ${r.room_number}`.trim(),
  }));

  const activeInstructors = instructors.filter((i) => i.is_active);
  const instructorOptions = activeInstructors.map((i) => ({
    value: String(i.id),
    label: i.name,
  }));

  const levelOptions = ["100", "200", "300", "400", "600", "700"].map((l) => ({
    value: l,
    label: `${l}-level`,
  }));

  // Filter meetings using multi-select filters (AND across categories, OR within)
  let filteredMeetings = meetings
    .filter((m) => selectedDepts.size === 0 || selectedDepts.has(m.section?.course?.department_code ?? ""))
    .filter((m) => selectedRooms.size === 0 || selectedRooms.has(String(m.room_id)))
    .filter((m) => selectedInstructors.size === 0 || selectedInstructors.has(String(m.instructor_id)))
    .filter((m) => {
      if (selectedLevels.size === 0) return true;
      const num = m.section?.course?.course_number;
      if (!num) return false;
      const level = String(Math.floor(parseInt(num) / 100) * 100);
      return selectedLevels.has(level);
    });

  // Exclude meetings with no time data (defensive for online-only)
  filteredMeetings = filteredMeetings.filter(
    (m) => m.start_time && m.days_of_week && m.days_of_week.length > 0
  );

  // Online async sections: modality is "online_async" (no meetings needed)
  let onlineAsyncSections = sections
    .filter((s) => s.modality === "online_async")
    .filter((s) => selectedDepts.size === 0 || selectedDepts.has(s.course?.department_code ?? ""))
    .filter((s) => selectedRooms.size === 0) // online sections have no room — hide when filtering by rooms
    .filter((s) => selectedInstructors.size === 0 || selectedInstructors.has(String(s.instructor_id)))
    .filter((s) => {
      if (selectedLevels.size === 0) return true;
      const num = s.course?.course_number;
      if (!num) return false;
      const level = String(Math.floor(parseInt(num) / 100) * 100);
      return selectedLevels.has(level);
    });

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

  const hardConflicts = validation?.hard_conflicts ?? [];
  const softWarnings = validation?.soft_warnings ?? [];
  const activeWarningCount = softWarnings.filter((w) => !dismissedSet.has(warningKey(w))).length;
  const issueCount = hardConflicts.length + activeWarningCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Schedule — {selectedTerm.name}</h2>
        {isReadOnly && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}
      </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCompareDialogOpen(true)}>
            Compare Schedule
          </Button>
          <Button variant="outline" onClick={() => setScheduleDialogOpen(true)}>
            Email Schedules
          </Button>
          <div className="relative">
            <Button variant="outline" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
              Export
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-50 py-1">
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={async () => {
                    setExportMenuOpen(false);
                    try {
                      const res = await api.getRaw(`/terms/${selectedTerm.id}/export/xlsx`);
                      if (!res.ok) throw new Error("Download failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `schedule-${selectedTerm.id}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setExportStatus("Downloaded.");
                      setExportLink(null);
                    } catch (e: unknown) {
                      setExportStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                      setExportLink(null);
                    }
                    setTimeout(() => setExportStatus(null), 4000);
                  }}
                >
                  Download XLSX
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={async () => {
                    setExportMenuOpen(false);
                    try {
                      const res = await api.getRaw(`/terms/${selectedTerm.id}/export/html`);
                      if (!res.ok) throw new Error("Download failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `schedule-${selectedTerm.id}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setExportStatus("Downloaded.");
                      setExportLink(null);
                    } catch (e: unknown) {
                      setExportStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                      setExportLink(null);
                    }
                    setTimeout(() => setExportStatus(null), 4000);
                  }}
                >
                  Download HTML
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={async () => {
                    setExportMenuOpen(false);
                    try {
                      const res = await api.post<{ filepath: string }>(`/terms/${selectedTerm.id}/export/html/save`);
                      setExportStatus(`Saved to ${res.filepath}`);
                      setExportLink(null);
                    } catch (e: unknown) {
                      setExportStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                      setExportLink(null);
                    }
                    setTimeout(() => setExportStatus(null), 6000);
                  }}
                >
                  Save to Local Directory
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={async () => {
                    setExportMenuOpen(false);
                    try {
                      const res = await api.post<{ pages_url: string; filename: string }>(`/terms/${selectedTerm.id}/export/html/github`);
                      setExportStatus("Published:");
                      setExportLink(res.pages_url);
                    } catch (e: unknown) {
                      setExportStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                      setExportLink(null);
                    }
                    setTimeout(() => { setExportStatus(null); setExportLink(null); }, 15000);
                  }}
                >
                  Push to GitHub Pages
                </button>
                <div className="border-t border-border my-1" />
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    setExportMenuOpen(false);
                    const base = window.location.protocol === "file:" ? "http://127.0.0.1:8000/api" : "/api";
                    window.open(`${base}/terms/${selectedTerm.id}/export/print?view=room`, "_blank");
                  }}
                >
                  Print — By Room
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    setExportMenuOpen(false);
                    const base = window.location.protocol === "file:" ? "http://127.0.0.1:8000/api" : "/api";
                    window.open(`${base}/terms/${selectedTerm.id}/export/print?view=instructor`, "_blank");
                  }}
                >
                  Print — By Instructor
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    setExportMenuOpen(false);
                    const base = window.location.protocol === "file:" ? "http://127.0.0.1:8000/api" : "/api";
                    window.open(`${base}/terms/${selectedTerm.id}/export/print?view=master`, "_blank");
                  }}
                >
                  Print — Master Grid
                </button>
              </div>
            )}
          </div>
          <Button onClick={() => { setEditingMeeting(null); setDialogOpen(true); }} disabled={isReadOnly}>
            <Plus className="h-4 w-4" />
            Add Meeting
          </Button>
        </div>
      </div>

      {exportStatus && (
        <div className="bg-accent/50 border border-border rounded-md px-3 py-2 text-sm">
          {exportStatus}
          {exportLink && (
            <>
              {" "}
              <a
                href={exportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:opacity-80"
              >
                {exportLink}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportLink);
                  setExportStatus("Link copied!");
                }}
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-border hover:bg-accent"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy Link
              </button>
            </>
          )}
        </div>
      )}

      {/* View mode tabs + multi-select filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["room", "instructor", "level"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium capitalize",
                viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
              )}
            >
              By {mode}
            </button>
          ))}
        </div>
        <HelpTooltip content="Switch between Room, Instructor, and Level views to organize the schedule differently" side="bottom" />
        </div>

        <MultiSelectFilter label="Department" options={deptOptions} selected={selectedDepts} onChange={setSelectedDepts} />
        <MultiSelectFilter label="Rooms" options={roomOptions} selected={selectedRooms} onChange={setSelectedRooms} />
        <MultiSelectFilter label="Instructors" options={instructorOptions} selected={selectedInstructors} onChange={setSelectedInstructors} />
        <MultiSelectFilter label="Levels" options={levelOptions} selected={selectedLevels} onChange={setSelectedLevels} />

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Conflicts
          {issueCount > 0 && (
            <Badge variant="destructive">
              {issueCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {viewMode === "room" && rooms.map((r) => {
          const c = roomColorMap.get(r.id);
          return (
            <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-slate-700 dark:text-slate-300" style={{ backgroundColor: `${c}${entityBgAlpha(resolvedTheme === "dark")}`, borderLeft: `3px solid ${c}` }}>
              {r.building?.abbreviation} {r.room_number}
            </span>
          );
        })}
        {viewMode === "instructor" && instructors.filter(i => i.is_active).map((i) => {
          const c = instructorColorMap.get(i.id);
          return (
            <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-slate-700 dark:text-slate-300" style={{ backgroundColor: `${c}${entityBgAlpha(resolvedTheme === "dark")}`, borderLeft: `3px solid ${c}` }}>
              {i.name}
            </span>
          );
        })}
        {viewMode === "level" && ["100", "200", "300", "400", "600", "700"].map((l) => {
          const c = getLevelHexColor(l);
          return (
            <span key={l} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-slate-700 dark:text-slate-300" style={{ backgroundColor: `${c}${entityBgAlpha(resolvedTheme === "dark")}`, borderLeft: `3px solid ${c}` }}>
              {l}-level
            </span>
          );
        })}
      </div>

      {loadingMeetings && (
        <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading schedule...</span>
          </div>
        </div>
      )}

      {!loadingMeetings && filteredMeetings.length === 0 && onlineAsyncSections.length > 0 ? null : (
      <div className={`flex gap-4 ${loadingMeetings ? "hidden" : ""}`}>
        <div className="flex-1 min-w-0">
          <ScheduleGrid
            meetings={filteredMeetings}
            timeBlocks={timeBlocks}
            colorFn={colorFn}
            onDetail={(m) => setDetailMeeting(m)}
            onEdit={isReadOnly ? undefined : (m) => { setEditingMeeting(m); setDialogOpen(true); }}
            onMove={isReadOnly ? undefined : (meetingId, targetBlock) => {
              const meeting = meetings.find((m) => m.id === meetingId);
              const previousState = {
                time_block_id: meeting?.time_block_id ?? null,
                days_of_week: meeting?.days_of_week ?? null,
                start_time: meeting?.start_time ?? null,
                end_time: meeting?.end_time ?? null,
              };
              moveMutation.mutate({ meetingId, targetBlock, previousState });
            }}
            isMoving={moveMutation.isPending}
          />
        </div>

        {sidebarOpen && (
          <ConflictSidebar
            conflicts={hardConflicts}
            warnings={softWarnings}
            dismissedKeys={dismissedSet}
            onDismiss={(key) => dismissMutation.mutate(key)}
            onUndismiss={(key) => undismissMutation.mutate(key)}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>
      )}

      {onlineAsyncSections.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-lg font-semibold mb-3">Online Asynchronous Sections</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
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
                  <tr
                    key={s.id}
                    className="border-b border-border/50 cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: `${rowColor}${entityBgAlpha(resolvedTheme === "dark")}`, borderLeft: `3px solid ${rowColor}` }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditingSection(s);
                      setEditingMeeting(null);
                      setDialogOpen(true);
                    }}
                  >
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

      {detailMeeting && (
        <MeetingDetailDialog
          meeting={detailMeeting}
          onClose={() => setDetailMeeting(null)}
          onEdit={(m) => {
            setDetailMeeting(null);
            setEditingMeeting(m);
            setDialogOpen(true);
          }}
          onDelete={() => {
            const m = detailMeeting!;
            setDetailMeeting(null);
            deleteMutation.mutate(m);
          }}
          readOnly={isReadOnly}
        />
      )}

      {scheduleDialogOpen && (
        <InstructorScheduleDialog
          termId={selectedTerm.id}
          instructors={instructors}
          onClose={() => setScheduleDialogOpen(false)}
        />
      )}

      {compareDialogOpen && (
        <CompareScheduleDialog
          termId={selectedTerm.id}
          termName={selectedTerm.name}
          onClose={() => setCompareDialogOpen(false)}
        />
      )}

      {dialogOpen && (
        <MeetingDialog
          termId={selectedTerm.id}
          meeting={editingMeeting}
          section={editingSection ?? (editingMeeting ? sections.find((s) => s.id === editingMeeting.section_id) ?? null : null)}
          sections={sections}
          rooms={rooms}
          instructors={instructors}
          timeBlocks={timeBlocks}
          termType={selectedTerm.type}
          term={selectedTerm}
          onClose={() => { setDialogOpen(false); setEditingMeeting(null); setEditingSection(null); }}
          onSaved={(info) => {
            setDialogOpen(false);
            const prevMeeting = editingMeeting;
            setEditingMeeting(null);
            setEditingSection(null);
            queryClient.invalidateQueries({ queryKey: ["meetings"] });
            queryClient.invalidateQueries({ queryKey: ["validation"] });
            queryClient.invalidateQueries({ queryKey: ["sections"] });

            if (info?.action === "create" && info.meeting) {
              const created = info.meeting;
              let currentId = created.id;
              pushUndo({
                label: `Create meeting`,
                undoFn: async () => {
                  await api.delete(`/meetings/${currentId}`);
                },
                redoFn: async () => {
                  const re = await api.post<Meeting>(`/terms/${selectedTerm!.id}/meetings`, {
                    section_id: created.section_id,
                    days_of_week: created.days_of_week,
                    start_time: created.start_time,
                    end_time: created.end_time,
                    time_block_id: created.time_block_id,
                    room_id: created.room_id,
                    instructor_id: created.instructor_id,
                  });
                  currentId = re.id;
                },
                invalidateKeys: [["meetings"], ["validation"], ["sections"]],
              });
            } else if (info?.action === "update" && info.meeting && prevMeeting) {
              const updated = info.meeting;
              const prev = prevMeeting;
              pushUndo({
                label: `Update ${meetingLabel(prev)}`,
                undoFn: async () => {
                  await api.put(`/meetings/${updated.id}`, {
                    section_id: prev.section_id,
                    days_of_week: prev.days_of_week,
                    start_time: prev.start_time,
                    end_time: prev.end_time,
                    time_block_id: prev.time_block_id,
                    room_id: prev.room_id,
                    instructor_id: prev.instructor_id,
                  });
                },
                redoFn: async () => {
                  await api.put(`/meetings/${updated.id}`, {
                    section_id: updated.section_id,
                    days_of_week: updated.days_of_week,
                    start_time: updated.start_time,
                    end_time: updated.end_time,
                    time_block_id: updated.time_block_id,
                    room_id: updated.room_id,
                    instructor_id: updated.instructor_id,
                  });
                },
                invalidateKeys: [["meetings"], ["validation"], ["sections"]],
              });
            }
          }}
        />
      )}
    </div>
  );
}
