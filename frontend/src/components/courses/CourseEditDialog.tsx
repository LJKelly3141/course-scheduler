import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Course, CoursePrerequisite } from "../../api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  course: Course;
  onClose: () => void;
  onSaved: () => void;
}

export function CourseEditDialog({ course, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [departmentCode, setDepartmentCode] = useState(course.department_code);
  const [courseNumber, setCourseNumber] = useState(course.course_number);
  const [title, setTitle] = useState(course.title);
  const [credits, setCredits] = useState(course.credits);
  const [countsTowardLoad, setCountsTowardLoad] = useState(course.counts_toward_load ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Prerequisites
  const [addPrereqId, setAddPrereqId] = useState<string>("");
  const [addIsCoreq, setAddIsCoreq] = useState(false);

  const { data: allCourses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const { data: prereqs = [], refetch: refetchPrereqs } = useQuery({
    queryKey: ["prerequisites", course.id],
    queryFn: () => api.get<CoursePrerequisite[]>(`/courses/${course.id}/prerequisites`),
  });

  const addPrereqMutation = useMutation({
    mutationFn: (data: { prerequisite_id: number; is_corequisite: boolean }) =>
      api.post(`/courses/${course.id}/prerequisites`, data),
    onSuccess: () => {
      refetchPrereqs();
      setAddPrereqId("");
      setAddIsCoreq(false);
      queryClient.invalidateQueries({ queryKey: ["prerequisites"] });
    },
    onError: (err) => {
      setErrors([err instanceof Error ? err.message : "Failed to add prerequisite"]);
    },
  });

  const removePrereqMutation = useMutation({
    mutationFn: (linkId: number) =>
      api.delete(`/courses/${course.id}/prerequisites/${linkId}`),
    onSuccess: () => {
      refetchPrereqs();
      queryClient.invalidateQueries({ queryKey: ["prerequisites"] });
    },
  });

  const handleSave = async () => {
    setErrors([]);
    if (!departmentCode.trim()) { setErrors(["Department code is required"]); return; }
    if (!courseNumber.trim()) { setErrors(["Course number is required"]); return; }
    if (!title.trim()) { setErrors(["Title is required"]); return; }

    setSaving(true);
    try {
      await api.put(`/courses/${course.id}`, {
        department_code: departmentCode.trim(),
        course_number: courseNumber.trim(),
        title: title.trim(),
        credits,
        counts_toward_load: countsTowardLoad,
      });
      onSaved();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Save failed"]);
    }
    setSaving(false);
  };

  // Filter out courses that are already prereqs or the course itself
  const prereqIds = new Set(prereqs.map((p) => p.prerequisite_id));
  const availableCourses = allCourses.filter(
    (c) => c.id !== course.id && !prereqIds.has(c.id)
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
            {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Department Code</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Course Number</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={courseNumber} onChange={(e) => setCourseNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Credits</label>
            <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-sm"
              value={credits} onChange={(e) => setCredits(parseInt(e.target.value) || 3)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={countsTowardLoad}
              onChange={(e) => setCountsTowardLoad(e.target.checked)}
              className="rounded border-border"
            />
            Counts toward teaching load
          </label>

          {/* Prerequisites section */}
          <div className="border-t border-border pt-3">
            <label className="block text-sm font-medium mb-2">Prerequisites</label>

            {prereqs.length > 0 ? (
              <div className="space-y-1 mb-2">
                {prereqs.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <span className="font-medium">
                      {p.prerequisite_dept} {p.prerequisite_number}
                    </span>
                    <span className="text-muted-foreground text-xs truncate flex-1">
                      {p.prerequisite_title}
                    </span>
                    {p.is_corequisite && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 rounded px-1">
                        Coreq
                      </span>
                    )}
                    <button
                      onClick={() => removePrereqMutation.mutate(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove prerequisite"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">No prerequisites set.</p>
            )}

            <div className="flex gap-2 items-center">
              <select
                className="border border-border rounded-md px-2 py-1.5 text-sm flex-1 bg-background"
                value={addPrereqId}
                onChange={(e) => setAddPrereqId(e.target.value)}
              >
                <option value="">Select course...</option>
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department_code} {c.course_number} — {c.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={addIsCoreq}
                  onChange={(e) => setAddIsCoreq(e.target.checked)}
                  className="rounded border-border"
                />
                Coreq
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (addPrereqId) {
                    addPrereqMutation.mutate({
                      prerequisite_id: Number(addPrereqId),
                      is_corequisite: addIsCoreq,
                    });
                  }
                }}
                disabled={!addPrereqId || addPrereqMutation.isPending}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
