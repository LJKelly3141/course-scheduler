import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { InstructorWorkload, LoadAdjustment } from "@/api/types";

const ADJUSTMENT_TYPES = [
  { value: "research_release", label: "Research Reassignment" },
  { value: "admin_release", label: "Admin Reassignment" },
  { value: "course_release", label: "Course Reassignment" },
  { value: "adhoc", label: "ADHOC" },
  { value: "overload", label: "Overload" },
  { value: "other", label: "Other" },
];

interface WorkloadTabProps {
  workload: InstructorWorkload | undefined;
  isLoading: boolean;
  instructorId: number;
  termId: number | null;
}

export function WorkloadTab({ workload, isLoading, instructorId, termId }: WorkloadTabProps) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [adjForm, setAdjForm] = useState({
    description: "",
    equivalent_credits: 3,
    adjustment_type: "admin_release",
  });

  const createAdj = useMutation({
    mutationFn: (payload: { term_id: number; description: string; equivalent_credits: number; adjustment_type: string }) =>
      api.post<LoadAdjustment>(`/load-adjustments/${instructorId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Adjustment added");
      setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" });
      setShowAddForm(false);
    },
  });

  const deleteAdj = useMutation({
    mutationFn: (adjId: number) => api.delete(`/load-adjustments/${adjId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Adjustment deleted");
    },
  });

  const handleSaveAdj = () => {
    if (!termId || !adjForm.description.trim()) return;
    createAdj.mutate({
      term_id: termId,
      description: adjForm.description.trim(),
      equivalent_credits: adjForm.equivalent_credits,
      adjustment_type: adjForm.adjustment_type,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading workload...
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a term to view workload data.
      </div>
    );
  }

  const eqCredits = workload.total_equivalent_credits;
  const maxCredits = workload.max_credits;
  const overAmount = eqCredits - maxCredits;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Sections</div>
          <div className="text-2xl font-bold text-foreground mt-1">{workload.section_count}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Teaching Credits</div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {workload.total_teaching_credits}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Equivalent Credits</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              workload.is_overloaded ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {eqCredits}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">of {maxCredits} max</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Student Credit Hours</div>
          <div className="text-2xl font-bold text-foreground mt-1">{workload.total_sch}</div>
        </div>
      </div>

      {/* Sections Table */}
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Assigned Sections
        </h4>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Course</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Title</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Credits</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Equiv</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Cap</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Schedule</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Modality</th>
              </tr>
            </thead>
            <tbody>
              {workload.sections.map((s, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 text-foreground font-medium">
                    {s.department_code} {s.course_number}-{s.section_number}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{s.title}</td>
                  <td className="px-3 py-2.5 text-foreground text-center">{s.actual_credits}</td>
                  <td className="px-3 py-2.5 text-foreground text-center">
                    {s.equivalent_credits ?? s.actual_credits}
                  </td>
                  <td className="px-3 py-2.5 text-foreground text-center">{s.enrollment_cap}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.schedule_info ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.modality ?? "—"}</td>
                </tr>
              ))}
              {workload.sections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No sections assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Load Adjustments */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Load Reassignments
          </h4>
          {termId && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs text-primary hover:underline"
            >
              + Add Adjustment
            </button>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Description</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Type</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Equiv Credits</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {workload.adjustments.map((a) => (
                <tr key={a.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 text-foreground">{a.description}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {ADJUSTMENT_TYPES.find((t) => t.value === a.adjustment_type)?.label ?? a.adjustment_type}
                  </td>
                  <td className="px-3 py-2.5 text-foreground text-center">{a.equivalent_credits}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => deleteAdj.mutate(a.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}

              {/* Inline add form */}
              {showAddForm && (
                <tr className="border-b border-border/50 bg-muted/10">
                  <td className="px-3 py-2">
                    <input
                      placeholder="Description"
                      className="border border-input rounded px-2 py-1 text-xs w-full bg-background"
                      value={adjForm.description}
                      onChange={(e) => setAdjForm({ ...adjForm, description: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-input rounded px-2 py-1 text-xs w-full bg-background"
                      value={adjForm.adjustment_type}
                      onChange={(e) => setAdjForm({ ...adjForm, adjustment_type: e.target.value })}
                    >
                      {ADJUSTMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.5"
                      className="border border-input rounded px-2 py-1 text-xs w-20 mx-auto block bg-background text-center"
                      value={adjForm.equivalent_credits}
                      onChange={(e) => setAdjForm({ ...adjForm, equivalent_credits: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={handleSaveAdj}
                        disabled={!adjForm.description.trim() || createAdj.isPending}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {workload.adjustments.length === 0 && !showAddForm && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-sm">
                    No reassignments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Total bar */}
      <div
        className={`p-3 rounded-lg border flex justify-between items-center ${
          workload.is_overloaded
            ? "bg-red-900/20 border-red-800"
            : "bg-blue-900/20 border-blue-800"
        }`}
      >
        <div>
          <span
            className={`text-sm font-medium ${
              workload.is_overloaded ? "text-red-300" : "text-blue-300"
            }`}
          >
            Total Equivalent Credits: {eqCredits} / {maxCredits}
          </span>
          <span className="text-xs text-muted-foreground ml-3">
            ({workload.total_teaching_credits} teaching
            {workload.adjustments.length > 0
              ? ` + ${eqCredits - workload.total_teaching_credits} adjustments`
              : ""}
            )
          </span>
        </div>
        <span
          className={`text-xs font-medium ${
            workload.is_overloaded ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {workload.is_overloaded
            ? `⚠ Overloaded by ${overAmount} credit${overAmount !== 1 ? "s" : ""}`
            : "✓ Within limit"}
        </span>
      </div>
    </div>
  );
}
