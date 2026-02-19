import { useState } from "react";
import { api } from "../../api/client";
import type { Course } from "../../api/types";

interface Props {
  course: Course;
  onClose: () => void;
  onSaved: () => void;
}

export function CourseEditDialog({ course, onClose, onSaved }: Props) {
  const [departmentCode, setDepartmentCode] = useState(course.department_code);
  const [courseNumber, setCourseNumber] = useState(course.course_number);
  const [title, setTitle] = useState(course.title);
  const [credits, setCredits] = useState(course.credits);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
      });
      onSaved();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Save failed"]);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Edit Course</h3>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
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
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
