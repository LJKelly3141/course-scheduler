import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term } from "../api/types";

type ImportType = "rooms" | "instructors" | "courses" | "schedule" | "enrollment";

interface InstructorMatchEntry {
  id: number;
  name: string;
  email: string;
  score: number;
}

interface InstructorMatch {
  name: string;
  matches: InstructorMatchEntry[];
}

interface SchedulePreview {
  rows: Record<string, string>[];
  errors: string[];
  valid_count: number;
  suggested_term?: { name: string; type: string; start_date: string; end_date: string } | null;
  instructor_matches?: InstructorMatch[];
  file_headers?: string[];
  column_mapping?: Record<string, string>;
}

interface ColumnDetectResponse {
  file_headers: string[];
  column_mapping: Record<string, string>;
  canonical_columns: string[];
  warnings: string[];
}

/** Convert rows to a CSV Blob for upload */
function rowsToCsvBlob(rows: Record<string, string>[]): Blob {
  if (rows.length === 0) return new Blob([""], { type: "text/csv" });
  const keys = Object.keys(rows[0]);
  const header = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((row) =>
    keys.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
}

export function ImportPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [importType, setImportType] = useState<ImportType>("rooms");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [editableRows, setEditableRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Term selection for schedule import
  const [termMode, setTermMode] = useState<"existing" | "new">("existing");
  const [newTerm, setNewTerm] = useState({ name: "", type: "fall", start_date: "", end_date: "" });
  const [importTermId, setImportTermId] = useState<number | null>(null);

  // Instructor mappings: imported name -> existing instructor id (null = create new)
  const [instructorMappings, setInstructorMappings] = useState<Record<string, number | null>>({});

  // Column mapping for schedule import
  const [columnDetect, setColumnDetect] = useState<ColumnDetectResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  const { data: terms = [] } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get<Term[]>("/terms"),
  });

  const isSchedule = importType === "schedule";
  const isEnrollment = importType === "enrollment";
  const effectiveTermId = isSchedule
    ? (termMode === "existing" ? (importTermId ?? selectedTerm?.id ?? null) : null)
    : null;

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    // For schedule XLSX imports, detect columns first and show mapping UI
    if (isSchedule && file.name.toLowerCase().endsWith(".xlsx") && !showColumnMapping) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.upload<ColumnDetectResponse>(
          "/import/schedule/detect-columns", formData
        );
        setColumnDetect(res);
        setColumnMapping(res.column_mapping);
        setShowColumnMapping(true);
      } catch (e) {
        setPreview({ rows: [], errors: [e instanceof Error ? e.message : "Column detection failed"], valid_count: 0 });
      }
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      // term_id is optional for preview — only needed at commit time
      const termParam = isSchedule && effectiveTermId ? `&term_id=${effectiveTermId}` : "";
      // Include column mapping for schedule imports
      const mappingParam = isSchedule && Object.keys(columnMapping).length > 0
        ? `&column_mapping=${encodeURIComponent(JSON.stringify(columnMapping))}`
        : "";
      const res = await api.upload<SchedulePreview>(
        `/import/${importType}?preview=true${termParam}${mappingParam}`, formData
      );
      setPreview(res);
      setShowColumnMapping(false);
      // Copy rows into editable state
      setEditableRows(res.rows.map((r) => ({ ...r })));

      if (isSchedule && res.suggested_term) {
        setNewTerm(res.suggested_term);
        // Auto-switch to "new term" if the suggested term name doesn't match any existing term
        const suggestedName = res.suggested_term.name.toLowerCase();
        const matchesExisting = terms.some((t) => t.name.toLowerCase() === suggestedName);
        if (!matchesExisting) {
          setTermMode("new");
        } else {
          // Pre-select the matching existing term
          const match = terms.find((t) => t.name.toLowerCase() === suggestedName);
          if (match) {
            setTermMode("existing");
            setImportTermId(match.id);
          }
        }
      }

      if (isSchedule && res.instructor_matches) {
        const initialMappings: Record<string, number | null> = {};
        for (const match of res.instructor_matches) {
          if (match.matches.length > 0 && match.matches[0].score === 1.0) {
            initialMappings[match.name] = match.matches[0].id;
          } else {
            initialMappings[match.name] = null;
          }
        }
        setInstructorMappings(initialMappings);
      }
    } catch (e) {
      setPreview({ rows: [], errors: [e instanceof Error ? e.message : "Upload failed"], valid_count: 0 });
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (editableRows.length === 0) return;
    setLoading(true);
    try {
      let termId = effectiveTermId;

      if (isSchedule && termMode === "new") {
        const created = await api.post<Term>("/terms", newTerm);
        termId = created.id;
        queryClient.invalidateQueries({ queryKey: ["terms"] });
      }

      if (isSchedule && !termId) {
        setResult({ created: 0, errors: ["No term selected"] });
        setLoading(false);
        return;
      }

      // Build form data for commit
      const formData = new FormData();
      if (isEnrollment && file) {
        // Enrollment needs the original XLSX (multi-sheet, sheet names = academic years)
        formData.append("file", file);
      } else {
        const csvBlob = rowsToCsvBlob(editableRows);
        const csvFile = new File([csvBlob], "edited_import.csv", { type: "text/csv" });
        formData.append("file", csvFile);
      }

      let url = `/import/${importType}?preview=false`;
      if (isSchedule) {
        url += `&term_id=${termId}`;
        const mappingsJson = JSON.stringify(instructorMappings);
        url += `&instructor_mappings=${encodeURIComponent(mappingsJson)}`;
        if (Object.keys(columnMapping).length > 0) {
          url += `&column_mapping=${encodeURIComponent(JSON.stringify(columnMapping))}`;
        }
      }

      const res = await api.upload<{ created: number; errors: string[] }>(url, formData);
      setResult(res);
      setPreview(null);
      setEditableRows([]);
      setFile(null);
      if (isSchedule) {
        queryClient.invalidateQueries({ queryKey: ["terms"] });
        queryClient.invalidateQueries({ queryKey: ["sections"] });
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        queryClient.invalidateQueries({ queryKey: ["instructors"] });
      }
    } catch (e) {
      setResult({ created: 0, errors: [e instanceof Error ? e.message : "Import failed"] });
    }
    setLoading(false);
  };

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setEditableRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  };

  const deleteRow = (rowIndex: number) => {
    setEditableRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const resetState = () => {
    setPreview(null);
    setEditableRows([]);
    setResult(null);
    setFile(null);
    setInstructorMappings({});
    setTermMode("existing");
    setNewTerm({ name: "", type: "fall", start_date: "", end_date: "" });
    setImportTermId(null);
    setColumnDetect(null);
    setColumnMapping({});
    setShowColumnMapping(false);
  };

  const columnKeys = editableRows.length > 0 ? Object.keys(editableRows[0]) : [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Data Import</h2>

      <div className="bg-white rounded-lg border border-border p-6 space-y-4">
        <div className="flex gap-4 items-center flex-wrap">
          <select className="border border-border rounded-md px-3 py-2 text-sm"
            value={importType} onChange={(e) => { setImportType(e.target.value as ImportType); resetState(); }}>
            <option value="rooms">Rooms</option>
            <option value="instructors">Instructors</option>
            <option value="courses">Courses</option>
            <option value="schedule">Schedule</option>
            <option value="enrollment">Enrollment History</option>
          </select>

          <input
            type="file"
            accept=".xlsx,.csv"
            className="text-sm"
            key={importType}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setEditableRows([]); setResult(null); }}
          />

          <button onClick={handleUpload} disabled={!file || loading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? "Processing..." : "Preview"}
          </button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 space-y-2">
          {importType === "rooms" && (
            <>
              <p className="font-semibold text-foreground">Rooms Import</p>
              <p>Upload an <strong>.xlsx</strong> or <strong>.csv</strong> file with the following columns (column names are auto-detected):</p>
              <table className="mt-1 text-xs">
                <tbody>
                  <tr><td className="pr-4 font-medium py-0.5">building_name</td><td>Full building name (e.g., "North Hall")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">building_abbreviation</td><td>Short code (e.g., "NH")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">room_number</td><td>Room number (e.g., "301")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">capacity</td><td>Max seating capacity (number)</td></tr>
                </tbody>
              </table>
              <p className="text-muted-foreground">Column names like "Building", "Room", "Seats", etc. are also recognized. Buildings are created automatically if they don't exist. Duplicate rooms (same building + room number) are skipped.</p>
            </>
          )}
          {importType === "instructors" && (
            <>
              <p className="font-semibold text-foreground">Instructors Import</p>
              <p>Upload an <strong>.xlsx</strong> or <strong>.csv</strong> file with the following columns (column names are auto-detected):</p>
              <table className="mt-1 text-xs">
                <tbody>
                  <tr><td className="pr-4 font-medium py-0.5">name</td><td>Full name (e.g., "Jane Smith")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">email</td><td>Email address</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">department</td><td>Department code (e.g., "ECON")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">modality_constraint</td><td>"any", "in_person_only", or "online_only" (default: "any")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">max_credits</td><td>Maximum teaching credit load (number, default: 12)</td></tr>
                </tbody>
              </table>
              <p className="text-muted-foreground">Column names like "Instructor Name", "Dept", "Credit Limit", etc. are also recognized. Duplicate instructors (same email) are skipped.</p>
            </>
          )}
          {importType === "courses" && (
            <>
              <p className="font-semibold text-foreground">Courses Import</p>
              <p>Upload an <strong>.xlsx</strong> or <strong>.csv</strong> file with the following columns (column names are auto-detected):</p>
              <table className="mt-1 text-xs">
                <tbody>
                  <tr><td className="pr-4 font-medium py-0.5">department_code</td><td>Department code (e.g., "ECON")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">course_number</td><td>Course number (e.g., "201")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">title</td><td>Course title</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">credits</td><td>Number of credits (number)</td></tr>
                </tbody>
              </table>
              <p className="text-muted-foreground">Column names like "Subject", "Catalog Number", "Credit Hours", etc. are also recognized. Duplicate courses (same department + course number) are skipped.</p>
            </>
          )}
          {importType === "schedule" && (
            <>
              <p className="font-semibold text-foreground">Schedule Import</p>
              <p>Upload an <strong>.xlsx</strong> or <strong>.csv</strong> spreadsheet (e.g., exported from your registrar system) with columns like:</p>
              <table className="mt-1 text-xs">
                <tbody>
                  <tr><td className="pr-4 font-medium py-0.5">Class</td><td>Course code (e.g., "ECON 201")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Course / Title</td><td>Course title</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Section</td><td>Section number, may include session info (e.g., "01", "51 Session A")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Days &amp; Times</td><td>Meeting pattern (e.g., "MWF 9:00AM - 9:50AM")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Room</td><td>Building and room (e.g., "NH 301") or "ONLINE"</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Instructor</td><td>Instructor name (fuzzy-matched to existing records)</td></tr>
                </tbody>
              </table>
              <p className="text-muted-foreground">
                Column names like "Meeting Pattern", "Faculty", "Location", etc. are also recognized.
                The importer parses day codes (M, T, W, Th, F), creates courses and buildings as needed,
                and matches instructors using fuzzy name matching. Sections with "Online" or "Asynchronous" are set to the appropriate modality.
                After preview, you can review instructor mappings and choose which term to import into.
              </p>
            </>
          )}
          {importType === "enrollment" && (
            <>
              <p className="font-semibold text-foreground">Enrollment History Import</p>
              <p>Upload an <strong>.xlsx</strong> file with multiple sheets (one per academic year, e.g., "AY25", "AY24") containing enrollment data. Expected columns:</p>
              <table className="mt-1 text-xs">
                <tbody>
                  <tr><td className="pr-4 font-medium py-0.5">Class Program Code</td><td>Department code (e.g., "ECON")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Catalog Nbr</td><td>Course number (e.g., "201")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Class Section</td><td>Section number</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Class Type</td><td>"Enrollment" rows are imported, others skipped</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Enrollment Total</td><td>Actual enrollment count</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Enrollment Max Cap</td><td>Maximum enrollment capacity</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Meeting Pattern</td><td>Day pattern (e.g., "T TH", "MWF")</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Meeting Time Start/End</td><td>Class times</td></tr>
                  <tr><td className="pr-4 font-medium py-0.5">Instructor Name</td><td>Instructor name</td></tr>
                </tbody>
              </table>
              <p className="text-muted-foreground">
                All sheets are imported at once. Records are automatically matched to existing courses in the scheduler.
                This data powers the Analytics page with enrollment trends, forecasts, and time slot analysis.
                Importing replaces any previously imported enrollment data.
              </p>
            </>
          )}
        </div>

        {/* Column mapping for schedule import — shown after file detection */}
        {isSchedule && showColumnMapping && columnDetect && (
          <div className="bg-indigo-50 border border-indigo-200 rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Column Mapping</p>
              <p className="text-xs text-muted-foreground">
                Map spreadsheet columns to schedule fields. Set unused columns to "— Ignore —".
              </p>
            </div>
            {columnDetect.warnings.length > 0 && (
              <div className="text-xs text-amber-700 space-y-0.5">
                {columnDetect.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
            <div className="grid gap-2">
              {columnDetect.file_headers.filter((h) => h.trim()).map((header) => (
                <div key={header} className="flex items-center gap-3 text-sm">
                  <span className="w-48 font-medium truncate font-mono text-xs bg-white border border-border rounded px-2 py-1" title={header}>
                    {header}
                  </span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <select
                    className={`border rounded px-2 py-1.5 text-sm flex-1 max-w-xs ${
                      columnMapping[header]
                        ? "border-indigo-300 bg-white"
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
                  </select>
                  {columnMapping[header] && (
                    <span className="text-xs text-indigo-600 font-medium">Mapped</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUpload}
                disabled={loading || !Object.values(columnMapping).includes("Course")}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Continue with Preview"}
              </button>
              <button
                onClick={() => { setShowColumnMapping(false); setColumnDetect(null); setColumnMapping({}); }}
                className="border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              {!Object.values(columnMapping).includes("Course") && (
                <span className="text-xs text-destructive self-center">
                  "Course" column is required
                </span>
              )}
            </div>
          </div>
        )}

        {/* Term selection for schedule import - shown after preview */}
        {isSchedule && preview && editableRows.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
            <p className="text-sm font-medium">Select Term for Import</p>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="termMode"
                  checked={termMode === "existing"}
                  onChange={() => setTermMode("existing")}
                />
                Existing term
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="termMode"
                  checked={termMode === "new"}
                  onChange={() => setTermMode("new")}
                />
                Create new term
              </label>
            </div>

            {termMode === "existing" ? (
              <select
                className="border border-border rounded px-3 py-2 text-sm"
                value={importTermId ?? selectedTerm?.id ?? ""}
                onChange={(e) => setImportTermId(Number(e.target.value))}
              >
                {terms.length === 0 && <option value="">No terms available</option>}
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.status === "final" ? "(Final)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <input
                  placeholder="Term name"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.name}
                  onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })}
                />
                <select
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.type}
                  onChange={(e) => setNewTerm({ ...newTerm, type: e.target.value })}
                >
                  <option value="fall">Fall</option>
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="winter">Winter</option>
                </select>
                <input
                  type="date"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.start_date}
                  onChange={(e) => setNewTerm({ ...newTerm, start_date: e.target.value })}
                />
                <input
                  type="date"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.end_date}
                  onChange={(e) => setNewTerm({ ...newTerm, end_date: e.target.value })}
                />
              </div>
            )}

            {preview.suggested_term && (
              <p className="text-xs text-blue-600">
                Detected from file dates: <strong>{preview.suggested_term.name}</strong> ({preview.suggested_term.start_date} to {preview.suggested_term.end_date}).
                {termMode === "existing" && (
                  <>
                    {" "}
                    <button
                      className="underline font-medium"
                      onClick={() => { setTermMode("new"); setNewTerm(preview.suggested_term!); }}
                    >
                      Create as new term instead
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Instructor matching section */}
        {isSchedule && preview && preview.instructor_matches && preview.instructor_matches.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-3">
            <p className="text-sm font-medium">Instructor Matching</p>
            <p className="text-xs text-muted-foreground">
              Review how imported instructors map to existing records. Adjust as needed before confirming.
            </p>
            <div className="space-y-2">
              {preview.instructor_matches.map((match) => (
                <div key={match.name} className="flex items-center gap-3 text-sm">
                  <span className="w-56 font-medium truncate" title={match.name}>{match.name}</span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <select
                    className="border border-border rounded px-2 py-1.5 text-sm flex-1 max-w-sm"
                    value={instructorMappings[match.name] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInstructorMappings({
                        ...instructorMappings,
                        [match.name]: val === "" ? null : Number(val),
                      });
                    }}
                  >
                    <option value="">Create new instructor</option>
                    {match.matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email}) — {Math.round(m.score * 100)}% match
                      </option>
                    ))}
                  </select>
                  {instructorMappings[match.name] === null && (
                    <span className="text-xs text-amber-600 font-medium">New</span>
                  )}
                  {instructorMappings[match.name] !== null && instructorMappings[match.name] !== undefined && (
                    <span className="text-xs text-green-600 font-medium">Linked</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enrollment summary view */}
        {isEnrollment && preview && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Enrollment Data Summary</p>
            {preview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                {preview.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              </div>
            )}
            <table className="text-sm w-full max-w-lg">
              <tbody>
                {editableRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-4 font-medium text-muted-foreground">{row.stat}</td>
                    <td className="py-1.5">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.valid_count > 0 && (
              <div className="flex gap-3">
                <button onClick={handleConfirm}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  Import {preview.valid_count} Records
                </button>
                <button onClick={resetState}
                  disabled={loading}
                  className="border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Editable preview table */}
        {!isEnrollment && preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{editableRows.length} rows to import</p>
              {editableRows.length !== preview.rows.length && (
                <p className="text-xs text-muted-foreground">
                  ({preview.rows.length - editableRows.length} row{preview.rows.length - editableRows.length !== 1 ? "s" : ""} removed)
                </p>
              )}
            </div>
            {preview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                {preview.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              </div>
            )}
            {editableRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-1 py-1 w-8"></th>
                      {columnKeys.map((k) => (
                        <th key={k} className="px-2 py-1 text-left">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editableRows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="px-1 py-0.5">
                          <button
                            onClick={() => deleteRow(i)}
                            className="text-destructive hover:text-destructive/80 text-xs font-bold px-1"
                            title="Remove row"
                          >
                            &times;
                          </button>
                        </td>
                        {columnKeys.map((k) => (
                          <td key={k} className="px-1 py-0.5">
                            <input
                              className="w-full border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-0.5 text-xs bg-transparent focus:bg-white"
                              value={row[k] ?? ""}
                              onChange={(e) => updateCell(i, k, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editableRows.length > 0 && (
              <div className="flex gap-3">
                <button onClick={handleConfirm}
                  disabled={loading || (isSchedule && termMode === "existing" && !effectiveTermId && terms.length === 0) || (isSchedule && termMode === "new" && !newTerm.name)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  Confirm Import ({editableRows.length} rows)
                </button>
                <button onClick={resetState}
                  disabled={loading}
                  className="border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className={`p-3 rounded ${result.errors.length > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
            <p className="text-sm font-medium">Import complete: {result.created} records created</p>
            {result.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
