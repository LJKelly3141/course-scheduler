import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import type { Course, Section, Term } from "../api/types";

export function CoursesPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Course>>({ credits: 3 });
  const [sectionForm, setSectionForm] = useState<Partial<Section>>({ enrollment_cap: 30, modality: "in_person" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const createCourseMutation = useMutation({
    mutationFn: (data: Partial<Course>) => api.post("/courses", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["courses"] }); setForm({ credits: 3 }); setShowAdd(false); },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: Partial<Section>) => api.post("/sections", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sections"] }); setSectionForm({ enrollment_cap: 30, modality: "in_person" }); },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

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
                          {courseSections.map((s) => (
                            <div key={s.id} className="flex items-center gap-4 text-xs">
                              <span>Section {s.section_number}</span>
                              <span>Cap: {s.enrollment_cap}</span>
                              <span className="capitalize">{s.modality.replace("_", " ")}</span>
                              <span className={s.status === "unscheduled" ? "text-yellow-600" : "text-green-600"}>
                                {s.status}
                              </span>
                              <button onClick={() => { if (confirm("Delete section?")) deleteSectionMutation.mutate(s.id); }}
                                className="text-destructive hover:underline">Delete</button>
                            </div>
                          ))}
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
    </div>
  );
}
