import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useMultiTermAdjustments, useInstructors } from "@/hooks/useInstructorHub";
import { downloadReleaseReport } from "@/utils/downloadExport";
import type { Instructor, Term, LoadAdjustment } from "@/api/types";

const ADJUSTMENT_TYPES = [
  { value: "research_release", label: "Research Reassignment" },
  { value: "admin_release", label: "Admin Reassignment" },
  { value: "course_release", label: "Course Reassignment" },
  { value: "adhoc", label: "ADHOC" },
  { value: "overload", label: "Overload" },
  { value: "other", label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  research_release: "bg-blue-900/30 text-blue-300",
  admin_release: "bg-emerald-900/30 text-emerald-300",
  course_release: "bg-orange-900/30 text-orange-300",
  adhoc: "bg-purple-900/30 text-purple-300",
  overload: "bg-yellow-900/30 text-yellow-300",
  other: "bg-muted text-muted-foreground",
};

interface ReleasesTabProps {
  instructor: Instructor;
  terms: Term[];
  selectedTermId: number | null;
}

type ViewMode = "instructor" | "department";

export function ReleasesTab({ instructor, terms, selectedTermId }: ReleasesTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("instructor");

  // Group terms by academic year
  const termsByYear = useMemo(() => {
    const groups: Record<string, Term[]> = {};
    for (const t of terms) {
      const key = t.academic_year?.label ?? "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [terms]);

  const yearLabels = useMemo(() => Object.keys(termsByYear).sort(), [termsByYear]);

  const selectedTermYear = useMemo(() => {
    if (selectedTermId) {
      const t = terms.find((t) => t.id === selectedTermId);
      if (t?.academic_year?.label) return t.academic_year.label;
    }
    return yearLabels[0] ?? "";
  }, [selectedTermId, terms, yearLabels]);

  const [selectedYear, setSelectedYear] = useState(selectedTermYear);
  const [checkedTermIds, setCheckedTermIds] = useState<Set<number>>(() => {
    const yearTerms = termsByYear[selectedTermYear] ?? [];
    return new Set(yearTerms.map((t) => t.id));
  });

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const yearTerms = termsByYear[year] ?? [];
    setCheckedTermIds(new Set(yearTerms.map((t) => t.id)));
  };

  const toggleTerm = (id: number) => {
    setCheckedTermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTerms = useMemo(
    () => terms.filter((t) => checkedTermIds.has(t.id)).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [terms, checkedTermIds]
  );

  const termIds = useMemo(() => selectedTerms.map((t) => t.id), [selectedTerms]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* View toggle + Term Selector */}
      <div className="flex items-center justify-between mb-4">
        <TermSelector
          yearLabels={yearLabels}
          selectedYear={selectedYear}
          onYearChange={handleYearChange}
          termsByYear={termsByYear}
          checkedTermIds={checkedTermIds}
          onToggleTerm={toggleTerm}
        />
        <div className="flex border border-border rounded-md overflow-hidden shrink-0">
          {(["instructor", "department"] as const).map((mode, i) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs ${i > 0 ? "border-l border-border" : ""} ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {mode === "instructor" ? "Instructor" : "Department"}
            </button>
          ))}
        </div>
      </div>

      {selectedTerms.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground mt-12">
          Select at least one term to view reassignments.
        </div>
      ) : viewMode === "instructor" ? (
        <InstructorView
          instructor={instructor}
          selectedTerms={selectedTerms}
          termIds={termIds}
        />
      ) : (
        <DepartmentView selectedTerms={selectedTerms} termIds={termIds} />
      )}
    </div>
  );
}

/* ================================================================
   Instructor View — per-instructor multi-term grid
   ================================================================ */

function InstructorView({
  instructor,
  selectedTerms,
  termIds,
}: {
  instructor: Instructor;
  selectedTerms: Term[];
  termIds: number[];
}) {
  const { data: adjustments = [], isLoading } = useMultiTermAdjustments(instructor.id, termIds);

  const adjByTerm = useMemo(() => {
    const map: Record<number, LoadAdjustment[]> = {};
    for (const tid of termIds) map[tid] = [];
    for (const adj of adjustments) {
      if (map[adj.term_id]) map[adj.term_id].push(adj);
    }
    return map;
  }, [adjustments, termIds]);

  const qc = useQueryClient();
  const createAdj = useMutation({
    mutationFn: (payload: { term_id: number; description: string; equivalent_credits: number; adjustment_type: string }) =>
      api.post<LoadAdjustment>(`/load-adjustments/${instructor.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["multi-term-adjustments"] });
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Reassignment added");
    },
  });

  const deleteAdj = useMutation({
    mutationFn: (adjId: number) => api.delete(`/load-adjustments/${adjId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["multi-term-adjustments"] });
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Reassignment removed");
    },
  });

  const copyToTerms = (adj: LoadAdjustment, targetTermIds: number[]) => {
    for (const tid of targetTermIds) {
      if (tid === adj.term_id) continue;
      createAdj.mutate({
        term_id: tid,
        description: adj.description,
        equivalent_credits: adj.equivalent_credits,
        adjustment_type: adj.adjustment_type,
      });
    }
  };

  const [addingForTerm, setAddingForTerm] = useState<number | null>(null);
  const [adjForm, setAdjForm] = useState({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" });
  const [copyingAdj, setCopyingAdj] = useState<LoadAdjustment | null>(null);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());

  const handleSaveAdj = (termId: number) => {
    if (!adjForm.description.trim()) return;
    createAdj.mutate(
      { term_id: termId, description: adjForm.description.trim(), equivalent_credits: adjForm.equivalent_credits, adjustment_type: adjForm.adjustment_type },
      { onSuccess: () => { setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" }); setAddingForTerm(null); } }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center text-muted-foreground py-12">Loading reassignments...</div>;
  }

  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {selectedTerms.map((t) => (
                <th key={t.id} className="text-center px-3 py-2.5 text-muted-foreground font-medium border-r border-border last:border-r-0" style={{ width: `${100 / selectedTerms.length}%` }}>
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50 align-top">
              {selectedTerms.map((t) => {
                const termAdjs = adjByTerm[t.id] ?? [];
                return (
                  <td key={t.id} className="px-3 py-3 border-r border-border/50 last:border-r-0">
                    {termAdjs.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-1 mb-2 last:mb-0">
                        <div className="flex-1 min-w-0">
                          <AdjBadge type={a.adjustment_type} />
                          <div className="text-xs text-foreground mt-0.5">{a.description} ({a.equivalent_credits} cr)</div>
                        </div>
                        <div className="flex gap-1 shrink-0 mt-0.5">
                          <button onClick={() => { setCopyingAdj(a); setCopyTargets(new Set()); }} className="text-muted-foreground hover:text-primary transition-colors text-[10px]" title="Copy to other terms">Copy</button>
                          <button onClick={() => deleteAdj.mutate(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors text-xs">&#x2715;</button>
                        </div>
                      </div>
                    ))}
                    {termAdjs.length === 0 && addingForTerm !== t.id && (
                      <div className="text-xs text-muted-foreground text-center py-2">No reassignments</div>
                    )}
                    {addingForTerm === t.id ? (
                      <InlineAddForm form={adjForm} setForm={setAdjForm} onSave={() => handleSaveAdj(t.id)} onCancel={() => setAddingForTerm(null)} isPending={createAdj.isPending} />
                    ) : (
                      <button onClick={() => { setAddingForTerm(t.id); setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" }); }} className="text-xs text-primary hover:underline mt-2 block">+ Add</button>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="bg-muted/20">
              {selectedTerms.map((t) => {
                const termAdjs = adjByTerm[t.id] ?? [];
                const releaseCr = termAdjs.reduce((sum, a) => sum + a.equivalent_credits, 0);
                const netAvail = instructor.max_credits - releaseCr;
                return (
                  <td key={t.id} className="px-3 py-2 border-r border-border/50 last:border-r-0">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reassignment credits</span><span className="font-medium text-foreground">{releaseCr || "\u2014"}</span></div>
                    <div className="flex justify-between text-xs mt-0.5"><span className="text-muted-foreground">Max credits</span><span className="text-foreground">{instructor.max_credits}</span></div>
                    <div className="flex justify-between text-xs mt-0.5"><span className="text-muted-foreground">Net available</span><span className={`font-medium ${netAvail < 0 ? "text-red-400" : "text-emerald-400"}`}>{netAvail}</span></div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {copyingAdj && (
        <CopyDialog
          adj={copyingAdj}
          terms={selectedTerms}
          targets={copyTargets}
          setTargets={setCopyTargets}
          onCopy={() => { copyToTerms(copyingAdj, Array.from(copyTargets)); setCopyingAdj(null); }}
          onCancel={() => setCopyingAdj(null)}
        />
      )}

      <ExportBar termIds={termIds} />
    </>
  );
}

/* ================================================================
   Department View — all instructors across selected terms
   ================================================================ */

function DepartmentView({
  selectedTerms,
  termIds,
}: {
  selectedTerms: Term[];
  termIds: number[];
}) {
  const { data: allInstructors = [] } = useInstructors();
  const { data: adjustments = [], isLoading } = useMultiTermAdjustments(null, termIds);

  const activeInstructors = useMemo(
    () => allInstructors.filter((i) => i.is_active).sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "")),
    [allInstructors]
  );

  // Group adjustments by (instructor_id, term_id)
  const adjGrid = useMemo(() => {
    const map: Record<string, LoadAdjustment[]> = {};
    for (const adj of adjustments) {
      const key = `${adj.instructor_id}-${adj.term_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(adj);
    }
    return map;
  }, [adjustments]);

  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Inline add state for department view
  const [addingCell, setAddingCell] = useState<{ instructorId: number; termId: number } | null>(null);
  const [adjForm, setAdjForm] = useState({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" });

  const qc = useQueryClient();
  const createAdj = useMutation({
    mutationFn: (payload: { instructorId: number; term_id: number; description: string; equivalent_credits: number; adjustment_type: string }) => {
      const { instructorId, ...body } = payload;
      return api.post<LoadAdjustment>(`/load-adjustments/${instructorId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["multi-term-adjustments"] });
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Reassignment added");
    },
  });

  const deleteAdj = useMutation({
    mutationFn: (adjId: number) => api.delete(`/load-adjustments/${adjId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["multi-term-adjustments"] });
      qc.invalidateQueries({ queryKey: ["instructor-workload"] });
      toast.success("Reassignment removed");
    },
  });

  const handleSaveAdj = (instructorId: number, termId: number) => {
    if (!adjForm.description.trim()) return;
    createAdj.mutate(
      { instructorId, term_id: termId, description: adjForm.description.trim(), equivalent_credits: adjForm.equivalent_credits, adjustment_type: adjForm.adjustment_type },
      { onSuccess: () => { setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" }); setAddingCell(null); } }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center text-muted-foreground py-12">Loading department reassignments...</div>;
  }

  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium sticky left-0 bg-card min-w-[160px]">Instructor</th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium w-16">Max Cr</th>
              {selectedTerms.map((t) => (
                <th key={t.id} className="text-center px-3 py-2.5 text-muted-foreground font-medium border-l border-border min-w-[120px]">{t.name}</th>
              ))}
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium border-l border-border w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {activeInstructors.map((inst) => {
              const isExpanded = expandedRow === inst.id;
              let totalRelease = 0;

              const termCells = selectedTerms.map((t) => {
                const key = `${inst.id}-${t.id}`;
                const cellAdjs = adjGrid[key] ?? [];
                const releaseCr = cellAdjs.reduce((sum, a) => sum + a.equivalent_credits, 0);
                totalRelease += releaseCr;
                return { term: t, adjs: cellAdjs, releaseCr };
              });

              const hasAnyRelease = totalRelease !== 0;

              return (
                <tr
                  key={inst.id}
                  className={`border-b border-border/50 align-top ${hasAnyRelease ? "" : "opacity-60"} ${isExpanded ? "bg-muted/10" : ""}`}
                >
                  <td className="px-3 py-2.5 sticky left-0 bg-card">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : inst.id)}
                      className="flex items-center gap-1.5 text-foreground hover:text-primary text-left w-full"
                    >
                      <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-90" : ""}`}>&#x25B6;</span>
                      <span className="font-medium">{inst.last_name}, {inst.first_name}</span>
                      {inst.instructor_type && (
                        <span className="text-[10px] text-muted-foreground uppercase">{inst.instructor_type}</span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-center text-foreground">{inst.max_credits}</td>
                  {termCells.map(({ term: t, adjs, releaseCr }) => (
                    <td key={t.id} className="px-3 py-2.5 border-l border-border/50">
                      {!isExpanded ? (
                        <div className="text-center">
                          {releaseCr ? (
                            <span className="font-medium text-foreground">{releaseCr}</span>
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          {adjs.map((a) => (
                            <div key={a.id} className="flex items-center justify-between gap-1 mb-1.5 last:mb-0">
                              <div className="flex-1 min-w-0">
                                <AdjBadge type={a.adjustment_type} />
                                <span className="text-xs text-foreground ml-1">{a.description} ({a.equivalent_credits})</span>
                              </div>
                              <button onClick={() => deleteAdj.mutate(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors text-xs shrink-0">&#x2715;</button>
                            </div>
                          ))}
                          {addingCell?.instructorId === inst.id && addingCell?.termId === t.id ? (
                            <InlineAddForm form={adjForm} setForm={setAdjForm} onSave={() => handleSaveAdj(inst.id, t.id)} onCancel={() => setAddingCell(null)} isPending={createAdj.isPending} />
                          ) : (
                            <button
                              onClick={() => { setAddingCell({ instructorId: inst.id, termId: t.id }); setAdjForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release" }); }}
                              className="text-[10px] text-primary hover:underline mt-1"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 text-center border-l border-border/50 font-medium ${totalRelease ? "text-foreground" : "text-muted-foreground"}`}>
                    {totalRelease || "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ExportBar termIds={termIds} />
    </>
  );
}

/* ================================================================
   Shared sub-components
   ================================================================ */

function AdjBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[type] ?? TYPE_COLORS.other}`}>
      {ADJUSTMENT_TYPES.find((at) => at.value === type)?.label ?? type}
    </span>
  );
}

function InlineAddForm({
  form,
  setForm,
  onSave,
  onCancel,
  isPending,
}: {
  form: { description: string; equivalent_credits: number; adjustment_type: string };
  setForm: (f: typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
      <input
        placeholder="Description"
        className="border border-input rounded px-2 py-1 text-xs w-full bg-background"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        autoFocus
      />
      <select
        className="border border-input rounded px-2 py-1 text-xs w-full bg-background"
        value={form.adjustment_type}
        onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}
      >
        {ADJUSTMENT_TYPES.map((at) => (
          <option key={at.value} value={at.value}>{at.label}</option>
        ))}
      </select>
      <input
        type="number"
        step="0.5"
        className="border border-input rounded px-2 py-1 text-xs w-full bg-background"
        value={form.equivalent_credits}
        onChange={(e) => setForm({ ...form, equivalent_credits: parseFloat(e.target.value) || 0 })}
      />
      <div className="flex gap-1">
        <button onClick={onSave} disabled={!form.description.trim() || isPending} className="text-xs text-primary hover:underline disabled:opacity-50">Save</button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
    </div>
  );
}

function CopyDialog({
  adj,
  terms,
  targets,
  setTargets,
  onCopy,
  onCancel,
}: {
  adj: LoadAdjustment;
  terms: Term[];
  targets: Set<number>;
  setTargets: React.Dispatch<React.SetStateAction<Set<number>>>;
  onCopy: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 bg-card border border-border rounded-lg p-4">
      <h4 className="text-sm font-medium text-foreground mb-2">Copy &ldquo;{adj.description}&rdquo; to:</h4>
      <div className="flex flex-wrap gap-2 mb-3">
        {terms.filter((t) => t.id !== adj.term_id).map((t) => (
          <label key={t.id} className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={targets.has(t.id)}
              onChange={() => setTargets((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}
              className="rounded"
            />
            {t.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCopy} disabled={targets.size === 0} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50">Copy</button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:underline px-3 py-1.5">Cancel</button>
      </div>
    </div>
  );
}

function ExportBar({ termIds }: { termIds: number[] }) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">Department-wide reassignment report for selected terms</span>
      <div className="flex gap-2">
        <button onClick={() => downloadReleaseReport(termIds, "xlsx")} className="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-muted/50 text-foreground">Export XLSX</button>
        <button onClick={() => downloadReleaseReport(termIds, "html")} className="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-muted/50 text-foreground">Export HTML</button>
      </div>
    </div>
  );
}

function TermSelector({
  yearLabels,
  selectedYear,
  onYearChange,
  termsByYear,
  checkedTermIds,
  onToggleTerm,
}: {
  yearLabels: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  termsByYear: Record<string, Term[]>;
  checkedTermIds: Set<number>;
  onToggleTerm: (id: number) => void;
}) {
  const yearTerms = termsByYear[selectedYear] ?? [];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Academic Year:</label>
        <select
          className="border border-input rounded px-2 py-1 text-xs bg-background text-foreground"
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
        >
          {yearLabels.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        {yearTerms.map((t) => (
          <label key={t.id} className="flex items-center gap-1.5 text-xs text-foreground">
            <input type="checkbox" checked={checkedTermIds.has(t.id)} onChange={() => onToggleTerm(t.id)} className="rounded" />
            {t.name}
          </label>
        ))}
      </div>
    </div>
  );
}
