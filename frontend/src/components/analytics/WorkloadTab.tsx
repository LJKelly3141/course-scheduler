import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { WorkloadResponse, InstructorWorkload, LoadAdjustment } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const ADJUSTMENT_TYPES = [
  { value: "research_release", label: "Research Release" },
  { value: "admin_release", label: "Admin Release" },
  { value: "course_release", label: "Course Release" },
  { value: "adhoc", label: "ADHOC" },
  { value: "overload", label: "Overload" },
  { value: "other", label: "Other" },
];

export function WorkloadTab({ termId }: { termId: number }) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [adjForm, setAdjForm] = useState({
    description: "",
    equivalent_credits: 3,
    adjustment_type: "other",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "workload", termId],
    queryFn: () =>
      api.get<WorkloadResponse>(
        `/analytics/instructor-workload?term_id=${termId}`
      ),
  });

  const createAdjMutation = useMutation({
    mutationFn: ({
      instructorId,
      payload,
    }: {
      instructorId: number;
      payload: { term_id: number; description: string; equivalent_credits: number; adjustment_type: string };
    }) => api.post<LoadAdjustment>(`/load-adjustments/${instructorId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analytics", "workload", termId],
      });
      setAddingFor(null);
      setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "other" });
    },
  });

  const deleteAdjMutation = useMutation({
    mutationFn: (adjId: number) => api.delete(`/load-adjustments/${adjId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analytics", "workload", termId],
      });
    },
  });

  const updateInstructorMutation = useMutation({
    mutationFn: ({ id, instructor_type }: { id: number; instructor_type: string | null }) =>
      api.put(`/instructors/${id}`, { instructor_type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "workload", termId] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const res = await api.getRaw(
      `/analytics/instructor-workload/export?term_id=${termId}`
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workload_report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-muted-foreground">
          Loading workload data...
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive py-4">
        Failed to load workload data.
      </p>
    );
  }

  const { instructors, unassigned_sections, term_totals } = data;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Instructors" value={term_totals.total_instructors} />
        <KpiCard
          label="Teaching Credits"
          value={term_totals.total_teaching_credits}
        />
        <KpiCard
          label="Total SCH"
          value={term_totals.total_sch.toLocaleString()}
        />
        <KpiCard
          label="Overloaded"
          value={term_totals.overloaded_count}
          warn={term_totals.overloaded_count > 0}
        />
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export to Excel
        </Button>
      </div>

      {/* Instructor table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2.5 w-8" />
              <th className="px-3 py-2.5">Instructor</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Dept</th>
              <th className="px-3 py-2.5 text-right">Sections</th>
              <th className="px-3 py-2.5 text-right">Equiv Credits</th>
              <th className="px-3 py-2.5 text-right">Total Load</th>
              <th className="px-3 py-2.5 text-right">Max</th>
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No instructors with assigned sections for this term.
                </td>
              </tr>
            )}
            {instructors.map((inst) => (
              <InstructorRow
                key={inst.instructor_id}
                inst={inst}
                expanded={expandedIds.has(inst.instructor_id)}
                onToggle={() => toggleExpand(inst.instructor_id)}
                addingAdj={addingFor === inst.instructor_id}
                onStartAdd={() => {
                  setAddingFor(
                    addingFor === inst.instructor_id
                      ? null
                      : inst.instructor_id
                  );
                  setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "other" });
                }}
                adjForm={adjForm}
                onAdjFormChange={setAdjForm}
                onSaveAdj={() =>
                  createAdjMutation.mutate({
                    instructorId: inst.instructor_id,
                    payload: {
                      term_id: termId,
                      ...adjForm,
                    },
                  })
                }
                onDeleteAdj={(adjId) => deleteAdjMutation.mutate(adjId)}
                savingAdj={createAdjMutation.isPending}
                onTypeChange={(instructorId, type) =>
                  updateInstructorMutation.mutate({ id: instructorId, instructor_type: type })
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Unassigned sections */}
      {unassigned_sections.length > 0 && (
        <UnassignedSection sections={unassigned_sections} />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        warn
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
          : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-0.5 flex items-center gap-1.5">
        {value}
        {warn && <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </p>
    </div>
  );
}

function InstructorRow({
  inst,
  expanded,
  onToggle,
  addingAdj,
  onStartAdd,
  adjForm,
  onAdjFormChange,
  onSaveAdj,
  onDeleteAdj,
  savingAdj,
  onTypeChange,
}: {
  inst: InstructorWorkload;
  expanded: boolean;
  onToggle: () => void;
  addingAdj: boolean;
  onStartAdd: () => void;
  adjForm: { description: string; equivalent_credits: number; adjustment_type: string };
  onAdjFormChange: (f: { description: string; equivalent_credits: number; adjustment_type: string }) => void;
  onSaveAdj: () => void;
  onDeleteAdj: (id: number) => void;
  savingAdj: boolean;
  onTypeChange: (instructorId: number, type: string | null) => void;
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-border cursor-pointer hover:bg-muted/30 ${
          inst.is_overloaded
            ? "bg-amber-50/50 dark:bg-amber-950/20"
            : ""
        }`}
        onClick={onToggle}
      >
        <td className="px-3 py-2.5">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium">
          {inst.last_name}, {inst.first_name}
        </td>
        <td className="px-3 py-2.5">
          <select
            className="uppercase text-xs bg-transparent border border-transparent hover:border-border rounded px-1 py-0.5 cursor-pointer focus:border-primary focus:outline-none"
            value={inst.instructor_type || ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              onTypeChange(inst.instructor_id, e.target.value || null)
            }
          >
            <option value="">—</option>
            <option value="Faculty">Faculty</option>
            <option value="IAS">IAS</option>
            <option value="Adjunct">Adjunct</option>
            <option value="NIAS">NIAS</option>
          </select>
        </td>
        <td className="px-3 py-2.5">{inst.department}</td>
        <td className="px-3 py-2.5 text-right">{inst.section_count}</td>
        <td className="px-3 py-2.5 text-right">
          {inst.total_equivalent_credits}
        </td>
        <td className="px-3 py-2.5 text-right font-medium">
          <span
            className={
              inst.is_overloaded ? "text-amber-600 dark:text-amber-400" : ""
            }
          >
            {inst.total_equivalent_credits}
            {inst.is_overloaded && (
              <AlertTriangle className="inline h-3.5 w-3.5 ml-1 -mt-0.5" />
            )}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-muted-foreground">
          {inst.max_credits}
        </td>
        <td className="px-3 py-2.5" />
      </tr>

      {/* Expanded detail rows */}
      {expanded && (
        <>
          {/* Section rows */}
          {inst.sections.map((sect) => (
            <tr
              key={sect.section_id}
              className="border-b border-border/50 bg-muted/20 text-xs"
            >
              <td />
              <td className="px-3 py-1.5 pl-8 text-muted-foreground">
                {sect.department_code} {sect.course_number}-
                {sect.section_number}
              </td>
              <td className="px-3 py-1.5" colSpan={2}>
                {sect.title}
              </td>
              <td className="px-3 py-1.5 text-right">
                {sect.actual_credits}cr
              </td>
              <td className="px-3 py-1.5 text-right">
                {sect.equivalent_credits}
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">
                SCH: {sect.sch}
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">
                {sect.enrollment_cap} cap
              </td>
              <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[150px]">
                {sect.schedule_info}
              </td>
            </tr>
          ))}

          {/* Adjustment rows */}
          {inst.adjustments.map((adj) => (
            <tr
              key={`adj-${adj.id}`}
              className="border-b border-border/50 bg-blue-50/30 dark:bg-blue-950/20 text-xs"
            >
              <td />
              <td className="px-3 py-1.5 pl-8 italic text-blue-700 dark:text-blue-400" colSpan={4}>
                {adj.description}
              </td>
              <td className="px-3 py-1.5 text-right font-medium text-blue-700 dark:text-blue-400">
                {adj.equivalent_credits}
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground capitalize">
                {adj.adjustment_type.replace("_", " ")}
              </td>
              <td />
              <td className="px-3 py-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAdj(adj.id);
                  }}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}

          {/* Add adjustment form */}
          {addingAdj && (
            <tr className="border-b border-border/50 bg-muted/10 text-xs">
              <td />
              <td className="px-3 py-2 pl-8" colSpan={2}>
                <input
                  placeholder="Description"
                  className="border border-border rounded px-2 py-1 text-xs w-full"
                  value={adjForm.description}
                  onChange={(e) =>
                    onAdjFormChange({
                      ...adjForm,
                      description: e.target.value,
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-3 py-2">
                <select
                  className="border border-border rounded px-1 py-1 text-xs w-full"
                  value={adjForm.adjustment_type}
                  onChange={(e) =>
                    onAdjFormChange({
                      ...adjForm,
                      adjustment_type: e.target.value,
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </td>
              <td />
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.5"
                  className="border border-border rounded px-2 py-1 text-xs w-16"
                  value={adjForm.equivalent_credits}
                  onChange={(e) =>
                    onAdjFormChange({
                      ...adjForm,
                      equivalent_credits: parseFloat(e.target.value) || 0,
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-3 py-2" colSpan={3}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  disabled={!adjForm.description || savingAdj}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAdj();
                  }}
                >
                  Save
                </Button>
              </td>
            </tr>
          )}

          {/* Add adjustment button row */}
          <tr className="border-b border-border bg-muted/10">
            <td />
            <td className="px-3 py-1.5 pl-8" colSpan={8}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartAdd();
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Release / ADHOC
              </button>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

function UnassignedSection({
  sections,
}: {
  sections: WorkloadResponse["unassigned_sections"];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-sm border-b border-border bg-muted/50 hover:bg-muted/70"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Unassigned Sections ({sections.length})
      </button>
      {open && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs">
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2 text-right">Credits</th>
              <th className="px-3 py-2 text-right">Cap</th>
              <th className="px-3 py-2">Schedule</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <tr
                key={s.section_id}
                className="border-b border-border/50 hover:bg-muted/20"
              >
                <td className="px-3 py-2">
                  {s.department_code} {s.course_number}
                </td>
                <td className="px-3 py-2">{s.section_number}</td>
                <td className="px-3 py-2">{s.title}</td>
                <td className="px-3 py-2 text-right">{s.actual_credits}</td>
                <td className="px-3 py-2 text-right">{s.enrollment_cap}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[200px]">
                  {s.schedule_info}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
