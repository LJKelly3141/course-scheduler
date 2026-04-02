import { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Term, Course } from "@/api/types";
import {
  InstructorSelectionStep,
  type TermInstructorsResult,
} from "@/components/rotation/InstructorSelectionStep";
import {
  type CellKey,
  type CellData,
  cellKey,
  SEMESTER_LABELS,
  MODALITY_LABELS,
} from "@/pages/CourseRotationPage";

// ── Types ──

export interface TermExtractEntry {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
  semester: string;
  year_parity: string;
  num_sections: number;
  enrollment_cap: number;
  modality: string;
  time_block_id: number | null;
  time_block_label: string | null;
  days_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  instructor_id: number | null;
  instructor_name: string | null;
  room_id: number | null;
  room_label: string | null;
  session: string | null;
}

interface TermExtractResult {
  term_id: number;
  term_name: string;
  semester: string;
  entries: TermExtractEntry[];
}

type WizardStep = "select-term" | "select-instructors" | "preview";

const STEP_LABELS: Record<WizardStep, string> = {
  "select-term": "Select Term",
  "select-instructors": "Instructors",
  preview: "Preview",
};
const STEPS: WizardStep[] = ["select-term", "select-instructors", "preview"];

// ── Step indicator ──

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
      {STEPS.map((step, i) => (
        <span key={step} className="flex items-center gap-1">
          {i > 0 && <span className="mx-1">&rarr;</span>}
          <span
            className={`px-2 py-0.5 rounded-full ${
              step === current
                ? "bg-primary text-primary-foreground font-medium"
                : STEPS.indexOf(current) > i
                  ? "bg-muted text-foreground"
                  : "bg-muted/50"
            }`}
          >
            {i + 1}. {STEP_LABELS[step]}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Main Dialog ──

export function ImportFromTermDialog({
  open,
  onOpenChange,
  terms,
  onImport,
  localGrid,
  courseMap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: Term[];
  onImport: (entries: TermExtractEntry[]) => void;
  localGrid: Map<CellKey, CellData>;
  courseMap: Map<number, Course>;
}) {
  const [step, setStep] = useState<WizardStep>("select-term");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Step 2: instructor selection
  const [instructorData, setInstructorData] =
    useState<TermInstructorsResult | null>(null);
  const [includedInstructorIds, setIncludedInstructorIds] = useState<
    Set<number>
  >(new Set());

  // Step 3: preview
  const [preview, setPreview] = useState<TermExtractResult | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(
    new Set()
  );
  const [duplicateWarning, setDuplicateWarning] = useState<{
    duplicates: { courseLabel: string; semester: string }[];
    entriesToImport: TermExtractEntry[];
  } | null>(null);

  // ── Step transitions ──

  const goToInstructors = async () => {
    if (!selectedTermId) return;
    setLoading(true);
    try {
      const result = await api.get<TermInstructorsResult>(
        `/rotation/from-term/${selectedTermId}/instructors`
      );
      setInstructorData(result);
      setIncludedInstructorIds(new Set()); // default: all TBD
      setStep("select-instructors");
    } finally {
      setLoading(false);
    }
  };

  const goToPreview = async () => {
    if (!selectedTermId) return;
    setLoading(true);
    try {
      const ids = Array.from(includedInstructorIds).join(",");
      const result = await api.get<TermExtractResult>(
        `/rotation/from-term/${selectedTermId}?include_instructor_ids=${ids}`
      );
      setPreview(result);
      setSelectedEntries(new Set(result.entries.map((_, i) => i)));
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const goBackToInstructors = () => {
    setPreview(null);
    setSelectedEntries(new Set());
    setStep("select-instructors");
  };

  const goBackToTerm = () => {
    setInstructorData(null);
    setIncludedInstructorIds(new Set());
    setStep("select-term");
  };

  // ── Instructor toggles ──

  const toggleInstructor = (id: number) => {
    setIncludedInstructorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: number[], include: boolean) => {
    setIncludedInstructorIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (include) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  // ── Preview actions ──

  const handleImport = () => {
    if (!preview) return;
    const entriesToImport = preview.entries.filter((_, i) =>
      selectedEntries.has(i)
    );

    // Check for duplicates against existing grid
    const duplicates: { courseLabel: string; semester: string }[] = [];
    const seen = new Set<string>();
    for (const e of entriesToImport) {
      const key = cellKey(e.course_id, e.semester);
      const dedupKey = `${e.course_id}:${e.semester}`;
      if (localGrid.has(key) && !seen.has(dedupKey)) {
        seen.add(dedupKey);
        const course = courseMap.get(e.course_id);
        duplicates.push({
          courseLabel: course
            ? `${course.department_code} ${course.course_number}`
            : `Course #${e.course_id}`,
          semester: SEMESTER_LABELS[e.semester] || e.semester,
        });
      }
    }

    if (duplicates.length > 0) {
      setDuplicateWarning({ duplicates, entriesToImport });
      return;
    }

    onImport(entriesToImport);
    handleClose();
  };

  const confirmImportWithDuplicates = () => {
    if (!duplicateWarning) return;
    onImport(duplicateWarning.entriesToImport);
    setDuplicateWarning(null);
    handleClose();
  };

  const toggleEntry = (index: number) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedEntries.size === preview.entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(preview.entries.map((_, i) => i)));
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("select-term");
    setSelectedTermId("");
    setInstructorData(null);
    setIncludedInstructorIds(new Set());
    setPreview(null);
    setSelectedEntries(new Set());
    setDuplicateWarning(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "select-term" && "Import from Term Schedule"}
            {step === "select-instructors" && "Select Instructors to Include"}
            {step === "preview" && "Preview Import Entries"}
          </DialogTitle>
          <DialogDescription>
            {step === "select-term" &&
              "Extract section patterns from an existing term and add them to the rotation plan."}
            {step === "select-instructors" &&
              "Choose which instructors to include by name. Unchecked instructors will appear as TBD."}
            {step === "preview" &&
              "Review the entries to import. Sections are grouped by course, modality, and time block."}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* Step 1: Select Term */}
        {step === "select-term" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="import-term-select"
                className="text-sm font-medium"
              >
                Select Term
              </label>
              <StyledSelect
                id="import-term-select"
                className="w-full h-9 text-sm"
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
              >
                <option value="">Choose a term...</option>
                {terms.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </StyledSelect>
              {terms.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No terms available.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={goToInstructors}
                disabled={!selectedTermId || loading}
              >
                {loading ? "Loading..." : "Next"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Select Instructors */}
        {step === "select-instructors" && instructorData && (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              <strong>{instructorData.term_name}</strong> &mdash;{" "}
              {instructorData.groups.reduce(
                (sum, g) => sum + g.instructors.length,
                0
              ) + instructorData.untyped_instructors.length}{" "}
              instructor
              {instructorData.groups.reduce(
                (sum, g) => sum + g.instructors.length,
                0
              ) +
                instructorData.untyped_instructors.length !==
                1 && "s"}{" "}
              found.{" "}
              <span className="text-muted-foreground">
                Check instructors to include by name; unchecked will be TBD.
              </span>
            </div>

            <InstructorSelectionStep
              data={instructorData}
              includedIds={includedInstructorIds}
              onToggleInstructor={toggleInstructor}
              onToggleGroup={toggleGroup}
            />

            <DialogFooter>
              <Button variant="outline" onClick={goBackToTerm}>
                Back
              </Button>
              <Button onClick={goToPreview} disabled={loading}>
                {loading ? "Loading..." : "Next"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              <strong>{preview.term_name}</strong> &mdash;{" "}
              {preview.entries.length} offering group
              {preview.entries.length !== 1 ? "s" : ""} found, mapped to{" "}
              <strong>{SEMESTER_LABELS[preview.semester]}</strong> semester
            </div>

            {preview.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sections found in this term.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-border rounded-md">
                <table className="text-sm w-full">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr className="border-b">
                      <th className="py-1.5 px-2 text-left w-8">
                        <input
                          type="checkbox"
                          checked={
                            selectedEntries.size === preview.entries.length
                          }
                          onChange={toggleAll}
                          className="rounded"
                          aria-label="Select all entries"
                        />
                      </th>
                      <th className="py-1.5 px-2 text-left">Course</th>
                      <th className="py-1.5 px-2 text-left">Sec</th>
                      <th className="py-1.5 px-2 text-left">Modality</th>
                      <th className="py-1.5 px-2 text-left">Time</th>
                      <th className="py-1.5 px-2 text-left">Instructor</th>
                      <th className="py-1.5 px-2 text-left">Room</th>
                      <th className="py-1.5 px-2 text-left">Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((entry, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/30 cursor-pointer hover:bg-muted/30 ${
                          selectedEntries.has(i) ? "" : "opacity-40"
                        }`}
                        onClick={() => toggleEntry(i)}
                      >
                        <td className="py-1.5 px-2">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(i)}
                            onChange={() => toggleEntry(i)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-1.5 px-2 font-medium">
                          {entry.department_code} {entry.course_number}
                        </td>
                        <td className="py-1.5 px-2">{entry.num_sections}</td>
                        <td className="py-1.5 px-2">
                          {MODALITY_LABELS[entry.modality] || entry.modality}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {entry.time_block_label || "\u2014"}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {entry.instructor_id ? (
                            entry.instructor_name
                          ) : (
                            <span className="italic">TBD</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {entry.room_label || "\u2014"}
                        </td>
                        <td className="py-1.5 px-2">
                          {entry.enrollment_cap}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={goBackToInstructors}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedEntries.size === 0}
              >
                <Download className="size-4 mr-1" />
                Import {selectedEntries.size} Offering
                {selectedEntries.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      {/* Duplicate confirmation dialog */}
      <Dialog
        open={duplicateWarning !== null}
        onOpenChange={(o) => {
          if (!o) setDuplicateWarning(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Entries</DialogTitle>
            <DialogDescription>
              The following courses already have offerings in the rotation plan
              for the same semester. Importing will add additional entries
              alongside the existing ones.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-y-auto border border-border rounded-md">
            <ul className="text-sm divide-y divide-border/30">
              {duplicateWarning?.duplicates.map((d, i) => (
                <li key={i} className="px-3 py-1.5">
                  <span className="font-medium">{d.courseLabel}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; {d.semester}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicateWarning(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmImportWithDuplicates}>
              Import Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
