import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import type { Course, Section, Meeting, Room, Instructor, TimeBlock, Term, CourseTrend, CourseForecast } from "../api/types";
import { MeetingDialog } from "../components/meetings/MeetingDialog";
import { CourseEditDialog } from "../components/courses/CourseEditDialog";
import { CourseEnrollmentDialog } from "../components/courses/CourseEnrollmentDialog";
import { Sparkline } from "../components/analytics/Sparkline";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { formatTime, parseDaysOfWeek } from "../lib/utils";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSort } from "../hooks/useSort";
import { SortableHeader } from "@/components/ui/sortable-header";

const MODALITY_LABELS: Record<string, string> = {
  in_person: "In Person",
  online_sync: "Online Sync",
  online_async: "Online Async",
  hybrid: "Hybrid",
};

const SESSION_LABELS: Record<string, string> = {
  regular: "Regular",
  session_a: "Session A",
  session_b: "Session B",
  session_c: "Session C",
  session_d: "Session D",
};

function formatSessionDynamic(section: Section): string {
  if (section.term_session?.name) return section.term_session.name;
  return SESSION_LABELS[section.session] ?? section.session?.replace("_", " ") ?? "Regular";
}

function formatModality(modality: string): string {
  return MODALITY_LABELS[modality] ?? modality.replace("_", " ");
}

function formatSession(session: string): string {
  return SESSION_LABELS[session] ?? session.replace("_", " ");
}

export function CoursesPage() {
  const { selectedTerm, isReadOnly } = useOutletContext<{ selectedTerm: Term | null; isReadOnly: boolean }>();
  const queryClient = useQueryClient();
  const { pushUndo } = useUndoRedo();
  const [search, setSearch] = useState("");
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Course>>({ credits: 3 });
  const termSessions = selectedTerm?.sessions ?? [];
  const defaultSessionId = selectedTerm?.type === "summer" && termSessions.length > 0 ? termSessions[0].id : null;
  const [sectionForm, setSectionForm] = useState<Partial<Section>>({ enrollment_cap: 30, modality: "in_person", session: "regular", term_session_id: null });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Sync section form session default when term changes
  useEffect(() => {
    setSectionForm((prev) => ({ ...prev, term_session_id: defaultSessionId }));
  }, [defaultSessionId]);

  // Dialog state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [schedulingSection, setSchedulingSection] = useState<Section | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "batch" } | { type: "course"; id: number } | { type: "section"; id: number } | null>(null);

  const { data: courses = [], isLoading: loadingCourses, isError: coursesError } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  const { data: timeBlocks = [] } = useQuery({
    queryKey: ["timeblocks"],
    queryFn: () => api.get<TimeBlock[]>("/timeblocks"),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", selectedTerm?.id],
    queryFn: () => api.get<Meeting[]>(`/terms/${selectedTerm!.id}/meetings`),
    enabled: !!selectedTerm,
  });

  // Enrollment trends for sparklines
  const { data: trendsData } = useQuery({
    queryKey: ["analytics", "trends", selectedTerm?.id],
    queryFn: () =>
      api.get<{ courses: CourseTrend[] }>(
        `/analytics/enrollment-trends?term_id=${selectedTerm!.id}`
      ),
    enabled: !!selectedTerm,
  });

  const { data: forecastData } = useQuery({
    queryKey: ["analytics", "forecast", selectedTerm?.id],
    queryFn: () =>
      api.get<{ forecasts: CourseForecast[] }>(
        `/analytics/enrollment-forecast?term_id=${selectedTerm!.id}`
      ),
    enabled: !!selectedTerm,
  });

  const [trendCourse, setTrendCourse] = useState<Course | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

  const createCourseMutation = useMutation({
    mutationFn: (data: Partial<Course>) => api.post<Course>("/courses", data),
    onSuccess: (created, data) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setForm({ credits: 3 });
      setShowAdd(false);
      let currentId = created.id;
      pushUndo({
        label: `Create ${created.department_code} ${created.course_number}`,
        undoFn: async () => { await api.delete(`/courses/${currentId}`); },
        redoFn: async () => {
          const re = await api.post<Course>("/courses", data);
          currentId = re.id;
        },
        invalidateKeys: [["courses"], ["sections"], ["meetings"], ["validation"]],
      });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: Partial<Section>) => api.post<Section>("/sections", data),
    onSuccess: (created, data) => {
      invalidateAll();
      setSectionForm({ enrollment_cap: 30, modality: "in_person", session: "regular", term_session_id: defaultSessionId });
      let currentId = created.id;
      pushUndo({
        label: `Create section ${created.section_number}`,
        undoFn: async () => { await api.delete(`/sections/${currentId}`); },
        redoFn: async () => {
          const re = await api.post<Section>("/sections", data);
          currentId = re.id;
        },
        invalidateKeys: [["courses"], ["sections"], ["meetings"], ["validation"]],
      });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Section> }) =>
      api.put(`/sections/${id}`, data),
    onSettled: invalidateAll,
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (course: Course) => api.delete(`/courses/${course.id}`),
    onSuccess: (_data, course) => {
      invalidateAll();
      let currentId = course.id;
      pushUndo({
        label: `Delete ${course.department_code} ${course.course_number}`,
        undoFn: async () => {
          const re = await api.post<Course>("/courses", {
            department_code: course.department_code,
            course_number: course.course_number,
            title: course.title,
            credits: course.credits,
            counts_toward_load: course.counts_toward_load,
          });
          currentId = re.id;
        },
        redoFn: async () => { await api.delete(`/courses/${currentId}`); },
        invalidateKeys: [["courses"], ["sections"], ["meetings"], ["validation"]],
      });
    },
    onError: () => invalidateAll(),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (section: Section) => api.delete(`/sections/${section.id}`),
    onSuccess: (_data, section) => {
      invalidateAll();
      let currentId = section.id;
      pushUndo({
        label: `Delete section ${section.section_number}`,
        undoFn: async () => {
          const re = await api.post<Section>("/sections", {
            course_id: section.course_id,
            term_id: section.term_id,
            section_number: section.section_number,
            enrollment_cap: section.enrollment_cap,
            modality: section.modality,
            session: section.session,
            instructor_id: section.instructor_id,
            duration_weeks: section.duration_weeks,
          });
          currentId = re.id;
        },
        redoFn: async () => { await api.delete(`/sections/${currentId}`); },
        invalidateKeys: [["courses"], ["sections"], ["meetings"], ["validation"]],
      });
    },
    onError: () => invalidateAll(),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/courses/batch-delete", { ids }),
    onSettled: () => {
      invalidateAll();
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === courses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(courses.map((c) => c.id)));
  };

  function sectionMeetings(sectionId: number): Meeting[] {
    return meetings.filter((m) => m.section_id === sectionId);
  }

  function meetingSummary(m: Meeting): string {
    const days = parseDaysOfWeek(m.days_of_week).join("");
    const time = m.start_time && m.end_time
      ? `${formatTime(m.start_time)}–${formatTime(m.end_time)}`
      : "Time TBD";
    const room = m.room
      ? `${m.room.building?.abbreviation} ${m.room.room_number}`
      : m.room_id === null ? "Room TBD" : "Online";
    return days ? `${days} ${time}, ${room}` : `${time}, ${room}`;
  }

  /** Whether the term type supports session options */
  function termHasSessions(_termType: string): boolean {
    return true;
  }

  const filteredCourses = search
    ? courses.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.department_code.toLowerCase().includes(q) ||
          c.course_number.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
        );
      })
    : courses;

  const { sortState, toggleSort, sortItems } = useSort<"department_code" | "course_number" | "title" | "credits" | "sections">("department_code");

  const sortedCourses = sortItems(filteredCourses, (c) => {
    switch (sortState.key) {
      case "department_code": return c.department_code;
      case "course_number": return c.course_number;
      case "title": return c.title;
      case "credits": return c.credits;
      case "sections": return sections.filter((s) => s.course_id === c.id).length;
      default: return c.department_code;
    }
  });

  const activeInstructors = instructors.filter((i) => i.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Courses & Sections</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setDeleteTarget({ type: "batch" })}>
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            Add Course
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <input placeholder="Dept Code" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.department_code ?? ""} onChange={(e) => setForm({ ...form, department_code: e.target.value })} />
            <input placeholder="Course #" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.course_number ?? ""} onChange={(e) => setForm({ ...form, course_number: e.target.value })} />
            <input placeholder="Title" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="number" placeholder="Credits" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.credits ?? 3} onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 3 })} />
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={() => createCourseMutation.mutate(form)}>Save</Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.counts_toward_load ?? true}
                onChange={(e) => setForm({ ...form, counts_toward_load: e.target.checked })}
                className="rounded border-border"
              />
              Counts toward load
            </label>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={courses.length > 0 && selectedIds.size === courses.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 w-8"></th>
              <SortableHeader label="Dept" sortKey="department_code" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Course #" sortKey="course_number" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Title" sortKey="title" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Credits" sortKey="credits" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Sections" sortKey="sections" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <th className="px-4 py-3">Trend</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingCourses && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading courses...</span>
                  </div>
                </td>
              </tr>
            )}
            {coursesError && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <p className="text-sm text-destructive">Failed to load courses. Check that the backend is running.</p>
                </td>
              </tr>
            )}
            {!loadingCourses && !coursesError && courses.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No courses yet. Click "+ Add Course" to create one, or import from an XLSX file.
                </td>
              </tr>
            )}
            {sortedCourses.map((course) => {
              const courseSections = sections.filter((s) => s.course_id === course.id);
              const expanded = expandedCourse === course.id;
              return (
                <>
                  <tr key={course.id} className="border-b border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedCourse(expanded ? null : course.id)}>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(course.id)}
                        onChange={() => {}}
                        onClick={(e) => toggleSelect(course.id, e)}
                      />
                    </td>
                    <td className="px-4 py-2.5">{expanded ? "▼" : "▶"}</td>
                    <td className="px-4 py-2.5">{course.department_code}</td>
                    <td className="px-4 py-2.5">{course.course_number}</td>
                    <td className="px-4 py-2.5">{course.title}</td>
                    <td className="px-4 py-2.5">
                      {course.credits}
                      {!course.counts_toward_load && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">no load</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{courseSections.length}</td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const trend = trendsData?.courses?.find((c) => c.course_id === course.id);
                        if (!trend || trend.data_points.length < 2) return null;
                        const history = trend.data_points
                          .sort((a, b) => `${a.academic_year} ${a.semester}`.localeCompare(`${b.academic_year} ${b.semester}`))
                          .map((dp) => dp.total_enrolled);
                        return (
                          <button
                            className="cursor-pointer hover:opacity-70"
                            onClick={() => setTrendCourse(course)}
                            title="View enrollment trend"
                          >
                            <Sparkline data={history} />
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setEditingCourse(course)}>Edit</Button>
                        <Button variant="link" size="sm" className="h-auto px-0 text-destructive" onClick={() => setDeleteTarget({ type: "course", id: course.id })}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${course.id}-sections`}>
                      <td colSpan={9} className="px-8 py-3 bg-muted/20">
                        <div className="space-y-2">
                          {courseSections.map((s) => {
                            const sMeetings = sectionMeetings(s.id);
                            return (
                              <div key={s.id} className="flex items-center gap-3 text-xs py-1">
                                <span className="font-medium w-20">Sec {s.section_number}</span>
                                <span className="text-muted-foreground w-14">Cap: {s.enrollment_cap}</span>
                                <span className="text-muted-foreground w-24">{formatModality(s.modality)}</span>
                                {selectedTerm && termHasSessions(selectedTerm.type) && (
                                  <span className="text-muted-foreground w-20">{formatSessionDynamic(s)}</span>
                                )}
                                {selectedTerm?.type === "summer" && s.duration_weeks && (
                                  <span className="text-muted-foreground w-28 text-[10px]">
                                    {s.duration_weeks}w {s.start_date && s.end_date ? `${s.start_date}\u2013${s.end_date}` : ""}
                                  </span>
                                )}
                                <span className="text-muted-foreground w-32 truncate">{s.instructor?.name ?? "Instructor TBD"}</span>

                                {/* Meeting info or status */}
                                {sMeetings.length > 0 ? (
                                  <span className="text-green-700 dark:text-green-400 flex-1 truncate">
                                    {sMeetings.map((m) => meetingSummary(m)).join(" | ")}
                                  </span>
                                ) : s.modality === "online_async" && s.status !== "unscheduled" ? (
                                  <span className="text-green-600 dark:text-green-400 flex-1 capitalize">{s.status}</span>
                                ) : (
                                  <span className="text-yellow-600 dark:text-yellow-400 flex-1">Unscheduled</span>
                                )}

                                {/* Action buttons */}
                                {!isReadOnly && (
                                <div className="flex gap-2 shrink-0">
                                  {selectedTerm && s.modality === "online_async" && s.status === "unscheduled" && (
                                    <Button
                                      variant="link" size="sm" className="h-auto px-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSectionMutation.mutate({ id: s.id, data: { status: "scheduled" } });
                                      }}
                                    >
                                      Mark Scheduled
                                    </Button>
                                  )}
                                  {selectedTerm && s.modality === "online_async" && s.status !== "unscheduled" && (
                                    <Button
                                      variant="link" size="sm" className="h-auto px-0 text-yellow-600 dark:text-yellow-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSectionMutation.mutate({ id: s.id, data: { status: "unscheduled" } });
                                      }}
                                    >
                                      Unschedule
                                    </Button>
                                  )}
                                  {selectedTerm && (
                                    <Button
                                      variant="link" size="sm" className="h-auto px-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSchedulingSection(s);
                                        setEditingMeeting(sMeetings.length > 0 ? sMeetings[0] : null);
                                        setMeetingDialogOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                  <Button
                                    variant="link" size="sm" className="h-auto px-0 text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({ type: "section", id: s.id });
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add section form */}
                          {selectedTerm && !isReadOnly && (
                            <div className="mt-2 pt-2 border-t border-border space-y-2">
                              <div className="flex gap-2 items-center">
                                <input placeholder="Section #" className="border rounded px-2 py-1 text-xs w-20"
                                  value={sectionForm.section_number ?? ""}
                                  onChange={(e) => setSectionForm({ ...sectionForm, section_number: e.target.value })} />
                                <div className="relative">
                                  <input type="number" placeholder="Cap" className="border rounded px-2 py-1 text-xs w-16"
                                    value={sectionForm.enrollment_cap ?? 30}
                                    onChange={(e) => setSectionForm({ ...sectionForm, enrollment_cap: parseInt(e.target.value) || 30 })} />
                                  {(() => {
                                    const fc = forecastData?.forecasts?.find((f) => f.course_id === course.id);
                                    if (!fc || fc.confidence === "none") return null;
                                    const perSection = fc.suggested_sections > 0
                                      ? Math.round(fc.suggested_seats / fc.suggested_sections)
                                      : fc.suggested_seats;
                                    return (
                                      <button
                                        type="button"
                                        className="absolute -bottom-4 left-0 text-[9px] text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                                        onClick={() => setSectionForm({ ...sectionForm, enrollment_cap: perSection })}
                                        title={`Based on ${fc.confidence} confidence forecast (p25: ${fc.p25}, p75: ${fc.p75})`}
                                      >
                                        Suggested: {perSection}
                                      </button>
                                    );
                                  })()}
                                </div>
                                <select className="border rounded px-2 py-1 text-xs"
                                  value={sectionForm.modality ?? "in_person"}
                                  onChange={(e) => setSectionForm({ ...sectionForm, modality: e.target.value })}>
                                  <option value="in_person">In Person</option>
                                  <option value="online_sync">Online Sync</option>
                                  <option value="online_async">Online Async</option>
                                  <option value="hybrid">Hybrid</option>
                                </select>
                                {selectedTerm && termHasSessions(selectedTerm.type) && termSessions.length > 0 && (
                                  <select className="border rounded px-2 py-1 text-xs"
                                    value={sectionForm.term_session_id ?? ""}
                                    onChange={(e) => setSectionForm({ ...sectionForm, term_session_id: e.target.value ? Number(e.target.value) : null })}>
                                    <option value="">No Session</option>
                                    {termSessions.map((ts) => (
                                      <option key={ts.id} value={ts.id}>{ts.name}</option>
                                    ))}
                                  </select>
                                )}
                                {selectedTerm?.type === "summer" && (
                                  <input type="number" placeholder="Weeks" className="border rounded px-2 py-1 text-xs w-16" min="1"
                                    value={sectionForm.duration_weeks ?? ""}
                                    onChange={(e) => setSectionForm({ ...sectionForm, duration_weeks: e.target.value ? parseInt(e.target.value) : undefined })}
                                  />
                                )}
                                <select className="border rounded px-2 py-1 text-xs w-40"
                                  value={sectionForm.instructor_id ?? ""}
                                  onChange={(e) => setSectionForm({
                                    ...sectionForm,
                                    instructor_id: Number(e.target.value) || undefined,
                                  })}>
                                  <option value="">Instructor (TBD)</option>
                                  {activeInstructors.map((i) => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2 items-center">
                                <input type="number" step="0.5" min="0" placeholder="Lect Hrs" className="border rounded px-2 py-1 text-xs w-20"
                                  value={sectionForm.lecture_hours ?? ""}
                                  onChange={(e) => setSectionForm({ ...sectionForm, lecture_hours: e.target.value ? parseFloat(e.target.value) : undefined })} />
                                <input type="number" step="0.01" min="0" placeholder="Course Fee $" className="border rounded px-2 py-1 text-xs w-24"
                                  value={sectionForm.special_course_fee ?? ""}
                                  onChange={(e) => setSectionForm({ ...sectionForm, special_course_fee: e.target.value ? parseFloat(e.target.value) : undefined })} />
                                <input placeholder="Class Notes" className="border rounded px-2 py-1 text-xs flex-1"
                                  value={sectionForm.notes ?? ""}
                                  onChange={(e) => setSectionForm({ ...sectionForm, notes: e.target.value || undefined })} />
                                <Button size="sm" onClick={() => createSectionMutation.mutate({
                                  ...sectionForm, course_id: course.id, term_id: selectedTerm.id
                                })} disabled={!sectionForm.section_number || createSectionMutation.isPending}>
                                  <Plus className="h-3 w-3" />
                                  Add Section
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Course edit dialog */}
      {editingCourse && (
        <CourseEditDialog
          course={editingCourse}
          onClose={() => setEditingCourse(null)}
          onSaved={() => { setEditingCourse(null); invalidateAll(); }}
        />
      )}

      {/* Meeting/section edit dialog */}
      {meetingDialogOpen && selectedTerm && schedulingSection && (
        <MeetingDialog
          termId={selectedTerm.id}
          meeting={editingMeeting}
          section={schedulingSection}
          sections={editingMeeting ? sections : [schedulingSection]}
          rooms={rooms}
          instructors={instructors}
          timeBlocks={timeBlocks}
          termType={selectedTerm.type}
          term={selectedTerm}
          onClose={() => { setMeetingDialogOpen(false); setSchedulingSection(null); setEditingMeeting(null); }}
          onSaved={() => {
            setMeetingDialogOpen(false);
            setSchedulingSection(null);
            setEditingMeeting(null);
            invalidateAll();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={
          deleteTarget?.type === "batch"
            ? `Delete ${selectedIds.size} course(s)?`
            : deleteTarget?.type === "section"
            ? "Delete section?"
            : "Delete course?"
        }
        description={
          deleteTarget?.type === "batch"
            ? "This will permanently delete the selected courses and all their sections."
            : deleteTarget?.type === "section"
            ? "This will permanently delete this section and its meetings."
            : "This will permanently delete this course and all its sections."
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget?.type === "batch") {
            batchDeleteMutation.mutate([...selectedIds]);
          } else if (deleteTarget?.type === "course") {
            const course = courses.find((c) => c.id === deleteTarget.id);
            if (course) deleteCourseMutation.mutate(course);
          } else if (deleteTarget?.type === "section") {
            const section = sections.find((s) => s.id === deleteTarget.id);
            if (section) deleteSectionMutation.mutate(section);
          }
          setDeleteTarget(null);
        }}
      />

      {/* Enrollment trend dialog */}
      {trendCourse && selectedTerm && (
        <CourseEnrollmentDialog
          course={trendCourse}
          termId={selectedTerm.id}
          open={!!trendCourse}
          onOpenChange={(open) => { if (!open) setTrendCourse(null); }}
        />
      )}
    </div>
  );
}
