import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import type { Course, Section, Meeting, Room, Instructor, TimeBlock, Term } from "../api/types";
import { MeetingDialog } from "../components/meetings/MeetingDialog";
import { formatTime, parseDaysOfWeek } from "../lib/utils";

export function CoursesPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Course>>({ credits: 3 });
  const [sectionForm, setSectionForm] = useState<Partial<Section>>({ enrollment_cap: 30, modality: "in_person" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [schedulingSection, setSchedulingSection] = useState<Section | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const { data: courses = [] } = useQuery({
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

  const createCourseMutation = useMutation({
    mutationFn: (data: Partial<Course>) => api.post("/courses", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["courses"] }); setForm({ credits: 3 }); setShowAdd(false); },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: Partial<Section>) => api.post("/sections", data),
    onSuccess: () => {
      invalidateAll();
      setSectionForm({ enrollment_cap: 30, modality: "in_person" });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Section> }) =>
      api.put(`/sections/${id}`, data),
    onSettled: invalidateAll,
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/courses/${id}`),
    onSettled: invalidateAll,
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sections/${id}`),
    onSettled: invalidateAll,
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

  /** Get meetings for a section */
  function sectionMeetings(sectionId: number): Meeting[] {
    return meetings.filter((m) => m.section_id === sectionId);
  }

  /** Format meeting summary: "MWF 9:00–9:50 AM, NH 301" */
  function meetingSummary(m: Meeting): string {
    const days = parseDaysOfWeek(m.days_of_week).join("");
    const time = `${formatTime(m.start_time)}–${formatTime(m.end_time)}`;
    const room = m.room
      ? `${m.room.building?.abbreviation} ${m.room.room_number}`
      : "Online";
    return `${days} ${time}, ${room}`;
  }

  const activeInstructors = instructors.filter((i) => i.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Courses & Sections</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} course(s) and their sections?`))
                  batchDeleteMutation.mutate([...selectedIds]);
              }}
              className="bg-destructive text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
            + Add Course
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg border border-border p-4 space-y-3">
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
          <button onClick={() => createCourseMutation.mutate(form)}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm">Save</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-border overflow-hidden">
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
              <th className="px-4 py-3">Dept</th>
              <th className="px-4 py-3">Course #</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">Sections</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
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
                    <td className="px-4 py-2.5">{course.credits}</td>
                    <td className="px-4 py-2.5">{courseSections.length}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deleteCourseMutation.mutate(course.id); }}
                        className="text-destructive text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${course.id}-sections`}>
                      <td colSpan={8} className="px-8 py-3 bg-muted/20">
                        <div className="space-y-2">
                          {courseSections.map((s) => {
                            const sMeetings = sectionMeetings(s.id);
                            return (
                              <div key={s.id} className="flex items-center gap-3 text-xs py-1">
                                <span className="font-medium w-20">Sec {s.section_number}</span>
                                <span className="text-muted-foreground w-14">Cap: {s.enrollment_cap}</span>
                                <span className="capitalize text-muted-foreground w-16">{s.modality.replace("_", " ")}</span>

                                {/* Instructor dropdown */}
                                <select
                                  className="border border-border rounded px-1.5 py-0.5 text-xs w-40"
                                  value={s.instructor_id ?? ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || null;
                                    updateSectionMutation.mutate({ id: s.id, data: { instructor_id: val } });
                                  }}
                                >
                                  <option value="">TBD</option>
                                  {activeInstructors.map((i) => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                  ))}
                                </select>

                                {/* Meeting info or schedule button */}
                                {sMeetings.length > 0 ? (
                                  <span className="text-green-700 flex-1 truncate">
                                    {sMeetings.map((m) => meetingSummary(m)).join(" | ")}
                                  </span>
                                ) : (
                                  <span className="text-yellow-600 flex-1">Unscheduled</span>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-2 shrink-0">
                                  {selectedTerm && sMeetings.length === 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSchedulingSection(s);
                                        setEditingMeeting(null);
                                        setMeetingDialogOpen(true);
                                      }}
                                      className="text-primary hover:underline"
                                    >
                                      Schedule
                                    </button>
                                  )}
                                  {selectedTerm && sMeetings.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSchedulingSection(s);
                                        setEditingMeeting(sMeetings[0]);
                                        setMeetingDialogOpen(true);
                                      }}
                                      className="text-primary hover:underline"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("Delete section?")) deleteSectionMutation.mutate(s.id);
                                    }}
                                    className="text-destructive hover:underline"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Add section form */}
                          {selectedTerm && (
                            <div className="flex gap-2 items-center mt-2 pt-2 border-t border-border">
                              <input placeholder="Section #" className="border rounded px-2 py-1 text-xs w-20"
                                value={sectionForm.section_number ?? ""}
                                onChange={(e) => setSectionForm({ ...sectionForm, section_number: e.target.value })} />
                              <input type="number" placeholder="Cap" className="border rounded px-2 py-1 text-xs w-16"
                                value={sectionForm.enrollment_cap ?? 30}
                                onChange={(e) => setSectionForm({ ...sectionForm, enrollment_cap: parseInt(e.target.value) || 30 })} />
                              <select className="border rounded px-2 py-1 text-xs"
                                value={sectionForm.modality ?? "in_person"}
                                onChange={(e) => setSectionForm({ ...sectionForm, modality: e.target.value })}>
                                <option value="in_person">In Person</option>
                                <option value="online">Online</option>
                                <option value="hybrid">Hybrid</option>
                              </select>
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
                              <button onClick={() => createSectionMutation.mutate({
                                ...sectionForm, course_id: course.id, term_id: selectedTerm.id
                              })} className="text-primary text-xs hover:underline">+ Add Section</button>
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

      {/* Meeting dialog for scheduling/editing */}
      {meetingDialogOpen && selectedTerm && schedulingSection && (
        <MeetingDialog
          termId={selectedTerm.id}
          meeting={editingMeeting}
          sections={editingMeeting ? sections : [schedulingSection]}
          rooms={rooms}
          instructors={instructors}
          timeBlocks={timeBlocks}
          onClose={() => { setMeetingDialogOpen(false); setSchedulingSection(null); setEditingMeeting(null); }}
          onSaved={() => {
            setMeetingDialogOpen(false);
            setSchedulingSection(null);
            setEditingMeeting(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );
}
