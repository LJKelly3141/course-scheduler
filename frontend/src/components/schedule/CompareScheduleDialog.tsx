import { useState, useRef, useMemo } from "react";
import { api } from "../../api/client";
import type {
  CompareResult,
  ChangedSection,
  NewSection,
  RemovedSection,
  FieldDiff,
} from "../../api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StyledSelect } from "@/components/ui/styled-select";

interface ColumnDetectResponse {
  file_headers: string[];
  column_mapping: Record<string, string>;
  canonical_columns: string[];
  warnings: string[];
}

/** Replace TBA-like values with plain language. */
function humanizeValue(field: string, value: string): string {
  const lower = value.toLowerCase().trim();
  if (lower === "tba" || lower === "tbd" || lower === "" || lower === "no meetings") {
    if (field.toLowerCase() === "time" || field.toLowerCase() === "schedule")
      return "no meeting time";
    if (field.toLowerCase() === "room") return "no room assigned";
    if (field.toLowerCase() === "instructor") return "TBD";
    return "none";
  }
  return value;
}

function sectionLabel(dept: string, num: string, sec: string, title: string, crn?: number | null): string {
  const cls = crn ? `Class #${crn} — ` : "";
  return `${cls}${dept} ${num}-${sec} "${title}"`;
}

function buildReport(result: CompareResult): string {
  const lines: string[] = [];
  lines.push(`Schedule Change Requests — ${result.term_name}`);
  lines.push("");

  // Narrative summary
  const totalChanges = result.changed.length + result.new_sections.length + result.removed.length;
  if (totalChanges > 0) {
    const parts: string[] = [];
    if (result.changed.length > 0)
      parts.push(`${result.changed.length} section${result.changed.length !== 1 ? "s" : ""} that need${result.changed.length === 1 ? "s" : ""} to be updated`);
    if (result.new_sections.length > 0)
      parts.push(`${result.new_sections.length} new section${result.new_sections.length !== 1 ? "s" : ""} to add`);
    if (result.removed.length > 0)
      parts.push(`${result.removed.length} section${result.removed.length !== 1 ? "s" : ""} to remove`);
    lines.push(`We have ${parts.join(", and ")}. Details below.`);
    lines.push("");
  }

  if (result.changed.length > 0) {
    lines.push("CHANGED SECTIONS:");
    lines.push("");
    for (const sec of result.changed) {
      const label = sectionLabel(sec.department_code, sec.course_number, sec.section_number, sec.title, sec.crn);
      lines.push(`  ${label}`);
      for (const d of sec.diffs) {
        const curVal = humanizeValue(d.field, d.registrar_value);
        const newVal = humanizeValue(d.field, d.department_value);
        lines.push(`    ${d.field}:`);
        lines.push(`\tCurrently ${curVal}`);
        lines.push(`\tChange to ${newVal}`);
      }
      lines.push("");
    }
  }

  if (result.new_sections.length > 0) {
    lines.push("NEW SECTIONS (to be added):");
    lines.push("");
    for (const sec of result.new_sections) {
      const label = sectionLabel(sec.department_code, sec.course_number, sec.section_number, sec.title);
      lines.push(`  ${label}`);
      lines.push(`    ${sec.details}`);
      lines.push(`    Please add this section to the schedule.`);
      lines.push("");
    }
  }

  if (result.removed.length > 0) {
    lines.push("SECTIONS TO REMOVE:");
    lines.push("");
    for (const sec of result.removed) {
      const label = sectionLabel(sec.department_code, sec.course_number, sec.section_number, sec.title, sec.crn);
      lines.push(`  ${label}`);
      lines.push(`    Please remove this section from the schedule.`);
      lines.push("");
    }
  }

  if (totalChanges === 0) {
    lines.push("No differences found. Schedules match.");
  }

  lines.push("Thank you.");

  return lines.join("\n");
}

/** Build diffs for a manually matched new+removed pair. */
function buildManualDiffs(newSec: NewSection, remSec: RemovedSection): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  // Course change
  if (
    remSec.department_code !== newSec.department_code ||
    remSec.course_number !== newSec.course_number
  ) {
    diffs.push({
      field: "Course",
      registrar_value: `${remSec.department_code} ${remSec.course_number}`,
      department_value: `${newSec.department_code} ${newSec.course_number}`,
    });
  }

  // Section number change
  if (remSec.section_number !== newSec.section_number) {
    diffs.push({
      field: "Section",
      registrar_value: remSec.section_number,
      department_value: newSec.section_number,
    });
  }

  // Time change
  if (remSec.time !== newSec.time) {
    diffs.push({
      field: "Time",
      registrar_value: remSec.time || "TBA",
      department_value: newSec.time || "TBA",
    });
  }

  // Room change
  if (remSec.room !== newSec.room) {
    diffs.push({
      field: "Room",
      registrar_value: remSec.room || "TBA",
      department_value: newSec.room || "TBA",
    });
  }

  // Instructor change
  if (remSec.instructor !== newSec.instructor) {
    diffs.push({
      field: "Instructor",
      registrar_value: remSec.instructor || "TBD",
      department_value: newSec.instructor || "TBD",
    });
  }

  // Modality change
  if (remSec.modality !== newSec.modality) {
    diffs.push({
      field: "Modality",
      registrar_value: remSec.modality || "In Person",
      department_value: newSec.modality || "In Person",
    });
  }

  // If nothing differed (shouldn't happen, but just in case)
  if (diffs.length === 0) {
    diffs.push({
      field: "Details",
      registrar_value: remSec.details || "(none)",
      department_value: newSec.details || "(none)",
    });
  }

  return diffs;
}

type Step = "upload" | "columns" | "results";

export function CompareScheduleDialog({
  termId,
  termName,
  onClose,
}: {
  termId: number;
  termName: string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column mapping state
  const [columnDetect, setColumnDetect] = useState<ColumnDetectResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Results state
  const [result, setResult] = useState<CompareResult | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Manual matching: maps new section index → removed section index
  const [manualMatches, setManualMatches] = useState<Record<number, number>>({});

  // Compute effective result incorporating manual matches
  const effectiveResult = useMemo((): CompareResult | null => {
    if (!result) return null;

    const matchedNewIndices = new Set(
      Object.keys(manualMatches).map(Number)
    );
    const matchedRemovedIndices = new Set(Object.values(manualMatches));

    const manualChanged: ChangedSection[] = [];
    for (const [newIdxStr, removedIdx] of Object.entries(manualMatches)) {
      const newSec = result.new_sections[Number(newIdxStr)];
      const remSec = result.removed[removedIdx];
      if (!newSec || !remSec) continue;

      manualChanged.push({
        crn: remSec.crn,
        department_code: newSec.department_code,
        course_number: newSec.course_number,
        section_number: newSec.section_number,
        title: newSec.title || remSec.title,
        diffs: buildManualDiffs(newSec, remSec),
      });
    }

    return {
      ...result,
      changed: [...result.changed, ...manualChanged],
      new_sections: result.new_sections.filter(
        (_, i) => !matchedNewIndices.has(i)
      ),
      removed: result.removed.filter(
        (_, i) => !matchedRemovedIndices.has(i)
      ),
    };
  }, [result, manualMatches]);

  // Step 1: Upload file → detect columns
  async function handleUpload() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;

    setFile(f);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await api.upload<ColumnDetectResponse>(
        "/import/schedule/detect-columns",
        formData
      );
      setColumnDetect(res);
      setColumnMapping(res.column_mapping);
      setStep("columns");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Column detection failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Run comparison with mapped columns
  async function handleCompare() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const mappingParam = Object.keys(columnMapping).length > 0
        ? `?column_mapping=${encodeURIComponent(JSON.stringify(columnMapping))}`
        : "";

      const res = await api.upload<CompareResult>(
        `/terms/${termId}/compare-schedule${mappingParam}`,
        formData
      );
      setResult(res);
      setManualMatches({});
      setStep("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyReport() {
    if (!effectiveResult) return;
    const text = buildReport(effectiveResult);
    await navigator.clipboard.writeText(text);
    setCopyFeedback("Report copied to clipboard!");
    setTimeout(() => setCopyFeedback(null), 3000);
  }

  function handleReset() {
    setStep("upload");
    setFile(null);
    setResult(null);
    setError(null);
    setColumnDetect(null);
    setColumnMapping({});
    setCopyFeedback(null);
    setManualMatches({});
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleMatch(newIdx: number, removedIdx: number) {
    setManualMatches((prev) => ({ ...prev, [newIdx]: removedIdx }));
  }

  function handleUnmatch(newIdx: number) {
    setManualMatches((prev) => {
      const next = { ...prev };
      delete next[newIdx];
      return next;
    });
  }

  // Use effectiveResult for display
  const displayResult = effectiveResult;
  const totalDiffs =
    (displayResult?.changed.length ?? 0) +
    (displayResult?.new_sections.length ?? 0) +
    (displayResult?.removed.length ?? 0);

  // Available (unmatched) removed sections for the match dropdown
  const matchedRemovedIndices = new Set(Object.values(manualMatches));
  const availableRemoved = result
    ? result.removed
        .map((sec, idx) => ({ sec, idx }))
        .filter(({ idx }) => !matchedRemovedIndices.has(idx))
    : [];

  // Track which new section indices have been matched (using original indices)
  const matchedNewIndices = new Set(
    Object.keys(manualMatches).map(Number)
  );

  const mappedValues = Object.values(columnMapping);
  const hasCourseMapping = mappedValues.includes("Course");
  const hasSectionMapping = mappedValues.includes("Section");
  const hasRequiredMappings = hasCourseMapping && hasSectionMapping;

  // Count manual matches for display
  const manualMatchCount = Object.keys(manualMatches).length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle>Compare Schedule</DialogTitle>
          <DialogDescription>
            Upload the registrar's XLSX to compare against {termName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4" aria-live="polite">
          {/* Step 1: File upload */}
          {step === "upload" && (
            <div className="space-y-3">
              <div>
                <label htmlFor="compare-schedule-file" className="block text-sm font-medium mb-1">
                  Registrar Schedule (XLSX)
                </label>
                <input
                  id="compare-schedule-file"
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border file:border-border file:text-sm file:font-medium file:bg-background hover:file:bg-accent file:cursor-pointer"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Detecting columns...
                  </span>
                ) : (
                  "Upload & Map Columns"
                )}
              </button>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === "columns" && columnDetect && (
            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Column Mapping</p>
                  <p className="text-xs text-muted-foreground">
                    Map spreadsheet columns to schedule fields. Set unused columns to "— Ignore —".
                  </p>
                </div>
                {columnDetect.warnings.length > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                    {columnDetect.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                )}
                <div className="grid gap-2">
                  {columnDetect.file_headers.filter((h) => h.trim()).map((header) => (
                    <div key={header} className="flex items-center gap-3 text-sm">
                      <span
                        className="w-48 font-medium truncate font-mono text-xs bg-background border border-border rounded px-2 py-1"
                        title={header}
                      >
                        {header}
                      </span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <label htmlFor={`col-map-${header}`} className="sr-only">Map column {header}</label>
                      <StyledSelect
                        id={`col-map-${header}`}
                        className={`border rounded px-2 py-1.5 text-sm flex-1 max-w-xs ${
                          columnMapping[header]
                            ? "border-indigo-300 dark:border-indigo-700 bg-background"
                            : "border-border bg-muted/30 text-muted-foreground"
                        }`}
                        value={columnMapping[header] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumnMapping((prev) => {
                            const next = { ...prev };
                            if (val) {
                              next[header] = val;
                            } else {
                              delete next[header];
                            }
                            return next;
                          });
                        }}
                      >
                        <option value="">— Ignore —</option>
                        {columnDetect.canonical_columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </StyledSelect>
                      {columnMapping[header] && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Mapped</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {!hasRequiredMappings && (
                <p className="text-xs text-destructive">
                  {!hasCourseMapping && !hasSectionMapping
                    ? '"Course" and "Section" column mappings are required.'
                    : !hasCourseMapping
                      ? '"Course" column mapping is required.'
                      : '"Section" column mapping is required.'}
                </p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive rounded-md px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          {/* Step 3: Results */}
          {step === "results" && displayResult && (
            <>
              {/* Summary banner */}
              <div className="bg-accent/50 border border-border rounded-md px-4 py-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="font-semibold text-warning-foreground">{displayResult.changed.length}</span> changed
                  </span>
                  <span>
                    <span className="font-semibold text-success-foreground">{displayResult.new_sections.length}</span> new
                  </span>
                  <span>
                    <span className="font-semibold text-destructive">{displayResult.removed.length}</span> removed
                  </span>
                  <span>
                    <span className="font-semibold text-muted-foreground">{displayResult.unchanged_count}</span> unchanged
                  </span>
                  {manualMatchCount > 0 && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">
                      ({manualMatchCount} manually matched)
                    </span>
                  )}
                </div>
              </div>

              {totalDiffs === 0 && (
                <p className="text-sm text-muted-foreground">
                  No differences found. Your schedule matches the registrar's.
                </p>
              )}

              {/* Changed sections */}
              {displayResult.changed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-warning-foreground mb-2">
                    Changed Sections ({displayResult.changed.length})
                  </h4>
                  <div className="space-y-2">
                    {displayResult.changed.map((sec: ChangedSection, i: number) => {
                      // Check if this is a manually matched section (appears after original changed list)
                      const isManual = result ? i >= result.changed.length : false;
                      return (
                        <div key={i} className={`border rounded-md px-3 py-2 ${
                          isManual
                            ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/50"
                            : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50"
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                              {sec.crn ? <span className="text-muted-foreground">Class #{sec.crn} — </span> : null}
                              {sec.department_code} {sec.course_number}-{sec.section_number}
                              <span className="text-muted-foreground ml-1">"{sec.title}"</span>
                            </div>
                            {isManual && (
                              <button
                                onClick={() => {
                                  // Find and unmatch this pair
                                  const manualIdx = i - (result?.changed.length ?? 0);
                                  const entries = Object.entries(manualMatches);
                                  if (entries[manualIdx]) {
                                    handleUnmatch(Number(entries[manualIdx][0]));
                                  }
                                }}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline ml-2 shrink-0"
                              >
                                Unmatch
                              </button>
                            )}
                          </div>
                          {isManual && (
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Manually matched</div>
                          )}
                          <div className="mt-1 space-y-1.5">
                            {sec.diffs.map((d, j) => (
                              <div key={j} className="text-xs">
                                <span className="font-medium text-foreground">{d.field}</span>
                                <div className="ml-3 text-muted-foreground">
                                  Currently: <span className="text-destructive">{humanizeValue(d.field, d.registrar_value)}</span>
                                </div>
                                <div className="ml-3 text-muted-foreground">
                                  Change to: <span className="text-success-foreground font-medium">{humanizeValue(d.field, d.department_value)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New sections (with match dropdown) */}
              {displayResult.new_sections.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-success-foreground mb-2">
                    New Sections ({displayResult.new_sections.length})
                  </h4>
                  {availableRemoved.length > 0 && displayResult.new_sections.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      If a new section replaces a removed section, use the dropdown to match them.
                    </p>
                  )}
                  <div className="space-y-2">
                    {displayResult.new_sections.map((sec: NewSection, displayIdx: number) => {
                      // Map display index back to original index in result.new_sections
                      const originalIdx = result
                        ? result.new_sections.findIndex(
                            (s) =>
                              !matchedNewIndices.has(result.new_sections.indexOf(s)) &&
                              s.department_code === sec.department_code &&
                              s.course_number === sec.course_number &&
                              s.section_number === sec.section_number &&
                              s.title === sec.title
                          )
                        : displayIdx;

                      return (
                        <div key={displayIdx} className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50 rounded-md px-3 py-2">
                          <div className="text-sm font-medium">
                            {sec.department_code} {sec.course_number}-{sec.section_number}
                            <span className="text-muted-foreground ml-1">"{sec.title}"</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {sec.details}
                          </div>
                          {availableRemoved.length > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <label htmlFor={`match-section-${displayIdx}`} className="text-xs text-muted-foreground shrink-0">
                                Match with:
                              </label>
                              <StyledSelect
                                id={`match-section-${displayIdx}`}
                                className="text-xs border border-border rounded px-2 py-1 flex-1 max-w-sm h-auto"
                                value=""
                                onChange={(e) => {
                                  const removedOrigIdx = Number(e.target.value);
                                  if (!isNaN(removedOrigIdx)) {
                                    handleMatch(originalIdx, removedOrigIdx);
                                  }
                                }}
                              >
                                <option value="">— Select a removed section —</option>
                                {availableRemoved.map(({ sec: rem, idx: remIdx }) => (
                                  <option key={remIdx} value={remIdx}>
                                    {rem.crn ? `Class #${rem.crn} — ` : ""}
                                    {rem.department_code} {rem.course_number}-{rem.section_number} "{rem.title}"
                                  </option>
                                ))}
                              </StyledSelect>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Removed sections */}
              {displayResult.removed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-destructive mb-2">
                    Removed Sections ({displayResult.removed.length})
                  </h4>
                  <div className="space-y-2">
                    {displayResult.removed.map((sec: RemovedSection, i: number) => (
                      <div key={i} className="border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50 rounded-md px-3 py-2">
                        <div className="text-sm font-medium">
                          {sec.crn ? <span className="text-muted-foreground">Class #{sec.crn} — </span> : null}
                          {sec.department_code} {sec.course_number}-{sec.section_number}
                          <span className="text-muted-foreground ml-1">"{sec.title}"</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {sec.details}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t flex items-center gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            {copyFeedback && (
              <span className="text-sm text-success-foreground font-medium">
                {copyFeedback}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "columns" && (
              <>
                <Button variant="outline" onClick={() => { setStep("upload"); setColumnDetect(null); setColumnMapping({}); setError(null); }}>
                  Back
                </Button>
                <Button onClick={handleCompare} disabled={loading || !hasRequiredMappings}>
                  {loading ? "Comparing..." : "Compare"}
                </Button>
              </>
            )}

            {step === "results" && displayResult && totalDiffs > 0 && (
              <Button variant="outline" onClick={handleCopyReport}>
                Copy Report
              </Button>
            )}
            {step === "results" && (
              <Button variant="outline" onClick={handleReset}>
                Compare Another
              </Button>
            )}

            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
