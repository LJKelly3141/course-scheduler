import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Instructor } from "@/api/types";
import { useUpdateInstructor } from "@/hooks/useInstructorHub";

const TYPE_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
];

const RANK_OPTIONS = [
  { value: "", label: "Select rank" },
  { value: "professor", label: "Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "senior_lecturer", label: "Senior Lecturer" },
  { value: "lecturer", label: "Lecturer" },
  { value: "adjunct_instructor", label: "Adjunct Instructor" },
];

const TENURE_OPTIONS = [
  { value: "", label: "Select status" },
  { value: "tenured", label: "Tenured" },
  { value: "tenure_track", label: "Tenure Track" },
  { value: "non_tenure", label: "Non-Tenure" },
];

const MODALITY_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "online_only", label: "Online Only" },
  { value: "mwf_only", label: "MWF Only" },
  { value: "tth_only", label: "TTh Only" },
];

interface ProfileTabProps {
  instructor: Instructor;
}

export function ProfileTab({ instructor }: ProfileTabProps) {
  const [form, setForm] = useState<Partial<Instructor>>({});
  const updateMutation = useUpdateInstructor();

  useEffect(() => {
    setForm({
      first_name: instructor.first_name ?? "",
      last_name: instructor.last_name ?? "",
      email: instructor.email,
      phone: instructor.phone ?? "",
      office_location: instructor.office_location ?? "",
      emergency_contact: instructor.emergency_contact ?? "",
      department: instructor.department,
      instructor_type: instructor.instructor_type ?? "",
      rank: instructor.rank ?? "",
      tenure_status: instructor.tenure_status ?? "",
      hire_date: instructor.hire_date ?? "",
      modality_constraint: instructor.modality_constraint,
      max_credits: instructor.max_credits,
      is_active: instructor.is_active,
    });
  }, [instructor.id]);

  const set = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    updateMutation.mutate(
      { id: instructor.id, ...form },
      {
        onSuccess: () => toast.success("Instructor saved"),
        onError: () => toast.error("Failed to save"),
      }
    );
  };

  const handleCancel = () => {
    setForm({
      first_name: instructor.first_name ?? "",
      last_name: instructor.last_name ?? "",
      email: instructor.email,
      phone: instructor.phone ?? "",
      office_location: instructor.office_location ?? "",
      emergency_contact: instructor.emergency_contact ?? "",
      department: instructor.department,
      instructor_type: instructor.instructor_type ?? "",
      rank: instructor.rank ?? "",
      tenure_status: instructor.tenure_status ?? "",
      hire_date: instructor.hire_date ?? "",
      modality_constraint: instructor.modality_constraint,
      max_credits: instructor.max_credits,
      is_active: instructor.is_active,
    });
  };

  const inputClass =
    "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "text-xs text-secondary mb-1 block";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          Contact Information
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name</label>
            <input className={inputClass} value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input className={inputClass} value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="tel" className={inputClass} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Office Location</label>
            <input className={inputClass} value={form.office_location ?? ""} onChange={(e) => set("office_location", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Emergency Contact Number</label>
            <input type="tel" className={inputClass} value={form.emergency_contact ?? ""} onChange={(e) => set("emergency_contact", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Employment</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Department</label>
            <input className={inputClass} value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={form.instructor_type ?? ""} onChange={(e) => set("instructor_type", e.target.value)}>
              {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Rank</label>
            <select className={inputClass} value={form.rank ?? ""} onChange={(e) => set("rank", e.target.value)}>
              {RANK_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tenure Status</label>
            <select className={inputClass} value={form.tenure_status ?? ""} onChange={(e) => set("tenure_status", e.target.value)}>
              {TENURE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Hire Date</label>
            <input type="date" className={inputClass} value={form.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Active</label>
            <div className="flex items-center h-[38px]">
              <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} className="rounded" />
                Active
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Scheduling Preferences</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Modality Constraint</label>
            <select className={inputClass} value={form.modality_constraint ?? "any"} onChange={(e) => set("modality_constraint", e.target.value)}>
              {MODALITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Max Credits</label>
            <input type="number" className={inputClass} value={form.max_credits ?? 12} onChange={(e) => set("max_credits", parseInt(e.target.value) || 0)} />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <button onClick={handleCancel} className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface-alt">Cancel</button>
        <button onClick={handleSave} disabled={updateMutation.isPending} className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50">
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
