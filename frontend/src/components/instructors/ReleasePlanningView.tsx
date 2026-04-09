import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useReleaseRotation,
  useCreateReleaseRotation,
  useDeleteReleaseRotation,
  useApplyReleaseRotation,
  useExtractReleaseRotation,
  useBatchReleaseRotation,
  useInstructors,
} from "@/hooks/useInstructorHub";
import { useTerm } from "@/hooks/useTerm";
import type { ReleaseRotationEntry, ApplyReleaseRotationResult, Term } from "@/api/types";

const SEMESTERS = ["fall", "spring", "summer", "winter"] as const;
const SEMESTER_LABELS: Record<string, string> = { fall: "Fall", spring: "Spring", summer: "Summer", winter: "Winter" };

const ADJUSTMENT_TYPES = [
  { value: "research_release", label: "Research Reassignment" },
  { value: "admin_release", label: "Admin Reassignment" },
  { value: "course_release", label: "Course Reassignment" },
  { value: "adhoc", label: "ADHOC" },
  { value: "overload", label: "Overload" },
  { value: "other", label: "Other" },
];

const YEAR_PARITY_LABELS: Record<string, string> = {
  every_year: "Every Year",
  even_years: "Even Years",
  odd_years: "Odd Years",
};

const PARITY_COLORS: Record<string, string> = {
  every_year: "bg-emerald-900/30 text-emerald-300",
  even_years: "bg-blue-900/30 text-blue-300",
  odd_years: "bg-purple-900/30 text-purple-300",
};

const TYPE_COLORS: Record<string, string> = {
  research_release: "bg-blue-900/30 text-blue-300",
  admin_release: "bg-emerald-900/30 text-emerald-300",
  course_release: "bg-orange-900/30 text-orange-300",
  adhoc: "bg-purple-900/30 text-purple-300",
  overload: "bg-yellow-900/30 text-yellow-300",
  other: "bg-muted text-muted-foreground",
};

export function ReleasePlanningView() {
  const { data: entries = [], isLoading } = useReleaseRotation();
  const { data: allInstructors = [] } = useInstructors();
  const createEntry = useCreateReleaseRotation();
  const deleteEntry = useDeleteReleaseRotation();

  const [showApply, setShowApply] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Group entries by instructor_id
  const byInstructor = useMemo(() => {
    const map: Record<number, ReleaseRotationEntry[]> = {};
    for (const e of entries) {
      if (!map[e.instructor_id]) map[e.instructor_id] = [];
      map[e.instructor_id].push(e);
    }
    return map;
  }, [entries]);

  // Instructors who have entries + all active instructors
  const instructorIds = useMemo(() => {
    const ids = new Set(entries.map((e) => e.instructor_id));
    return Array.from(ids).sort((a, b) => {
      const aE = entries.find((e) => e.instructor_id === a);
      const bE = entries.find((e) => e.instructor_id === b);
      return (aE?.instructor_last_name ?? "").localeCompare(bE?.instructor_last_name ?? "");
    });
  }, [entries]);

  // For adding: instructors not yet in the grid
  const availableInstructors = useMemo(
    () => allInstructors.filter((i) => i.is_active).sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "")),
    [allInstructors]
  );

  // Inline add state
  const [addingCell, setAddingCell] = useState<{ instructorId: number; semester: string } | null>(null);
  const [addForm, setAddForm] = useState({ description: "", equivalent_credits: 3, adjustment_type: "admin_release", year_parity: "every_year" });

  // Add new instructor row
  const [addingInstructor, setAddingInstructor] = useState(false);
  const [newInstructorId, setNewInstructorId] = useState<number | null>(null);

  const handleSave = () => {
    if (!addingCell || !addForm.description.trim()) return;
    createEntry.mutate(
      {
        instructor_id: addingCell.instructorId,
        semester: addingCell.semester,
        year_parity: addForm.year_parity,
        description: addForm.description.trim(),
        equivalent_credits: addForm.equivalent_credits,
        adjustment_type: addForm.adjustment_type,
      },
      {
        onSuccess: () => {
          toast.success("Plan entry added");
          setAddForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release", year_parity: "every_year" });
          setAddingCell(null);
        },
      }
    );
  };

  const handleAddInstructorEntry = (semester: string) => {
    if (!newInstructorId) return;
    setAddingCell({ instructorId: newInstructorId, semester });
    setAddingInstructor(false);
    setNewInstructorId(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center text-muted-foreground py-12">Loading reassignment plan...</div>;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-muted/50 text-foreground">
            Import from Term
          </button>
          <button onClick={() => setShowApply(true)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md">
            Apply to Term
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2.5 text-muted-foreground font-medium min-w-[180px]">Instructor</th>
              {SEMESTERS.map((s) => (
                <th key={s} className="text-center px-3 py-2.5 text-muted-foreground font-medium border-l border-border">{SEMESTER_LABELS[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructorIds.map((instId) => {
              const instEntries = byInstructor[instId] ?? [];
              const sample = instEntries[0];
              return (
                <tr key={instId} className="border-b border-border/50 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{sample?.instructor_last_name}, {sample?.instructor_first_name}</div>
                    {sample?.instructor_type && (
                      <div className="text-[10px] text-muted-foreground uppercase">{sample.instructor_type}</div>
                    )}
                  </td>
                  {SEMESTERS.map((sem) => {
                    const cellEntries = instEntries.filter((e) => e.semester === sem);
                    const isAdding = addingCell?.instructorId === instId && addingCell?.semester === sem;
                    return (
                      <td key={sem} className="px-3 py-2.5 border-l border-border/50">
                        {cellEntries.map((e) => (
                          <div key={e.id} className="flex items-start justify-between gap-1 mb-1.5 last:mb-0">
                            <div className="flex-1 min-w-0">
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${PARITY_COLORS[e.year_parity] ?? PARITY_COLORS.every_year}`}>
                                {YEAR_PARITY_LABELS[e.year_parity] ?? e.year_parity}
                              </span>
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ml-0.5 ${TYPE_COLORS[e.adjustment_type] ?? TYPE_COLORS.other}`}>
                                {ADJUSTMENT_TYPES.find((t) => t.value === e.adjustment_type)?.label ?? e.adjustment_type}
                              </span>
                              <div className="text-xs text-foreground mt-0.5">{e.description} ({e.equivalent_credits} cr)</div>
                            </div>
                            <button
                              onClick={() => deleteEntry.mutate(e.id, { onSuccess: () => toast.success("Plan entry removed") })}
                              className="text-muted-foreground hover:text-red-400 text-xs shrink-0"
                            >&#x2715;</button>
                          </div>
                        ))}
                        {isAdding ? (
                          <div className="mt-1 space-y-1.5 border-t border-border/50 pt-1.5">
                            <input placeholder="Description" className="border border-input rounded px-2 py-1 text-xs w-full bg-background" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} autoFocus />
                            <select className="border border-input rounded px-2 py-1 text-xs w-full bg-background" value={addForm.adjustment_type} onChange={(e) => setAddForm({ ...addForm, adjustment_type: e.target.value })}>
                              {ADJUSTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <input type="number" step="0.5" className="border border-input rounded px-2 py-1 text-xs w-full bg-background" value={addForm.equivalent_credits} onChange={(e) => setAddForm({ ...addForm, equivalent_credits: parseFloat(e.target.value) || 0 })} />
                            <select className="border border-input rounded px-2 py-1 text-xs w-full bg-background" value={addForm.year_parity} onChange={(e) => setAddForm({ ...addForm, year_parity: e.target.value })}>
                              <option value="every_year">Every Year</option>
                              <option value="even_years">Even Years</option>
                              <option value="odd_years">Odd Years</option>
                            </select>
                            <div className="flex gap-1">
                              <button onClick={handleSave} disabled={!addForm.description.trim() || createEntry.isPending} className="text-xs text-primary hover:underline disabled:opacity-50">Save</button>
                              <button onClick={() => setAddingCell(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingCell({ instructorId: instId, semester: sem }); setAddForm({ description: "", equivalent_credits: 3, adjustment_type: "admin_release", year_parity: "every_year" }); }}
                            className="text-[10px] text-primary hover:underline mt-1"
                          >+ Add</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Add instructor row */}
            {instructorIds.length === 0 && !addingInstructor && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No planned reassignments yet. Add an instructor or import from a term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add instructor button */}
      <div className="mt-3">
        {addingInstructor ? (
          <div className="flex items-center gap-2">
            <select
              className="border border-input rounded px-2 py-1.5 text-xs bg-background text-foreground"
              value={newInstructorId ?? ""}
              onChange={(e) => setNewInstructorId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select instructor...</option>
              {availableInstructors.map((i) => (
                <option key={i.id} value={i.id}>{i.last_name}, {i.first_name} ({i.instructor_type ?? ""})</option>
              ))}
            </select>
            {newInstructorId && (
              <div className="flex gap-1">
                {SEMESTERS.map((s) => (
                  <button key={s} onClick={() => handleAddInstructorEntry(s)} className="text-xs border border-border px-2 py-1 rounded hover:bg-muted/50 text-foreground">{SEMESTER_LABELS[s]}</button>
                ))}
              </div>
            )}
            <button onClick={() => { setAddingInstructor(false); setNewInstructorId(null); }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingInstructor(true)} className="text-xs text-primary hover:underline">+ Add Instructor</button>
        )}
      </div>

      {/* Apply Dialog */}
      {showApply && <ApplyDialog onClose={() => setShowApply(false)} />}

      {/* Import Dialog */}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    </>
  );
}


/* ================================================================
   Apply to Term Dialog
   ================================================================ */

function ApplyDialog({ onClose }: { onClose: () => void }) {
  const { terms } = useTerm();
  const draftTerms = useMemo(() => terms.filter((t) => t.status === "draft"), [terms]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [result, setResult] = useState<ApplyReleaseRotationResult | null>(null);
  const applyMutation = useApplyReleaseRotation();

  const handleApply = () => {
    if (!selectedTermId) return;
    applyMutation.mutate(selectedTermId, {
      onSuccess: (r) => {
        setResult(r);
        toast.success(`${r.adjustments_created} reassignment(s) created`);
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Apply Reassignment Plan to Term</h3>

        {!result ? (
          <>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground block mb-1">Select a draft term:</label>
              <select
                className="border border-input rounded px-2 py-1.5 text-xs w-full bg-background text-foreground"
                value={selectedTermId ?? ""}
                onChange={(e) => setSelectedTermId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Choose term...</option>
                {draftTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-xs text-muted-foreground hover:underline px-3 py-1.5">Cancel</button>
              <button
                onClick={handleApply}
                disabled={!selectedTermId || applyMutation.isPending}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50"
              >
                {applyMutation.isPending ? "Applying..." : "Apply"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              <div className="text-xs text-foreground">
                <span className="font-medium">{result.entries_matched}</span> plan entries matched
              </div>
              <div className="text-xs text-emerald-400">
                <span className="font-medium">{result.adjustments_created}</span> reassignment(s) created
              </div>
              {result.skipped_duplicates > 0 && (
                <div className="text-xs text-yellow-400">
                  <span className="font-medium">{result.skipped_duplicates}</span> skipped (already exist)
                </div>
              )}
            </div>
            {result.details.length > 0 && (
              <div className="bg-muted/20 rounded p-3 mb-4 max-h-48 overflow-y-auto">
                {result.details.map((d, i) => (
                  <div key={i} className="text-xs text-foreground mb-1 last:mb-0">
                    {d.instructor_name}: {d.description} ({d.equivalent_credits} cr)
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ================================================================
   Import from Term Dialog
   ================================================================ */

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { terms } = useTerm();
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const { data: extractResult } = useExtractReleaseRotation(selectedTermId);
  const batchMutation = useBatchReleaseRotation();
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState(false);

  // When extract result arrives, select all entries by default
  const entries = extractResult?.entries ?? [];
  if (entries.length > 0 && selectedEntries.size === 0 && !imported) {
    setSelectedEntries(new Set(entries.map((_, i) => i)));
  }

  const toggleEntry = (idx: number) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = () => {
    const toImport = entries.filter((_, i) => selectedEntries.has(i));
    batchMutation.mutate(
      toImport.map((e) => ({
        instructor_id: e.instructor_id,
        semester: e.semester,
        year_parity: e.year_parity,
        description: e.description,
        equivalent_credits: e.equivalent_credits,
        adjustment_type: e.adjustment_type,
      })),
      {
        onSuccess: () => {
          toast.success(`${toImport.length} plan entry/entries imported`);
          setImported(true);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Import Plan from Term</h3>

        {imported ? (
          <>
            <p className="text-xs text-emerald-400 mb-4">Plan entries imported successfully.</p>
            <div className="flex justify-end">
              <button onClick={onClose} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground block mb-1">Select a term to import from:</label>
              <select
                className="border border-input rounded px-2 py-1.5 text-xs w-full bg-background text-foreground"
                value={selectedTermId ?? ""}
                onChange={(e) => { setSelectedTermId(e.target.value ? Number(e.target.value) : null); setSelectedEntries(new Set()); }}
              >
                <option value="">Choose term...</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {entries.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-2">
                  Found {entries.length} reassignment(s) in {extractResult?.term_name}:
                </div>
                <div className="bg-muted/20 rounded p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {entries.map((e, i) => (
                    <label key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <input type="checkbox" checked={selectedEntries.has(i)} onChange={() => toggleEntry(i)} className="rounded mt-0.5" />
                      <span>{e.instructor_last_name}, {e.instructor_first_name}: {e.description} ({e.equivalent_credits} cr) &mdash; {ADJUSTMENT_TYPES.find((t) => t.value === e.adjustment_type)?.label ?? e.adjustment_type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedTermId && entries.length === 0 && (
              <p className="text-xs text-muted-foreground mb-4">No reassignments found in this term.</p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-xs text-muted-foreground hover:underline px-3 py-1.5">Cancel</button>
              <button
                onClick={handleImport}
                disabled={selectedEntries.size === 0 || batchMutation.isPending}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50"
              >
                {batchMutation.isPending ? "Importing..." : `Import ${selectedEntries.size} Entry/Entries`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
